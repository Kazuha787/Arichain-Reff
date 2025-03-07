const axios = require("axios");
const { Solver } = require("@2captcha/captcha-solver");
const ac = require("@antiadmin/anticaptchaofficial");
const { simpleParser } = require("mailparser");
const { logMessage } = require("../utils/logger");
const { getProxyAgent } = require("./proxy");
const { authorize } = require("./authGmail");
const fs = require("fs");
const { EmailGenerator } = require("../utils/generator");
const path = require("path");
const configPath = path.resolve(__dirname, "../json/config.json");
const config = JSON.parse(fs.readFileSync(configPath));
const confEmail = config.email;
const confApi = config.geminiApi;
const gemeiniPrompt = config.prompt;
const captchaApi = config.captha2Apikey;
const apiCaptcha = config.apiCaptchakey;
ac.setAPIKey(apiCaptcha);
const qs = require("qs");
const { GoogleGenerativeAI } = require("@google/generative-ai");

class ariChain {
  constructor(refCode, proxy = null, currentNum, total) {
    this.refCode = refCode;
    this.proxy = proxy;
    this.axiosConfig = {
      ...(this.proxy && { httpsAgent: getProxyAgent(this.proxy) }),
      timeout: 60000,
    };
    this.baseEmail = confEmail;
    this.gemini = new GoogleGenerativeAI(confApi);
    this.model = this.gemini.getGenerativeModel({
      model: "gemini-1.5-flash",
    });
    this.twoCaptchaSolver = new Solver(captchaApi);
    this.currentNum = currentNum;
    this.total = total;
  }

  async makeRequest(method, url, config = {}) {
    try {
      const response = await axios({
        method,
        url,
        ...this.axiosConfig,
        ...config,
      });
      return response;
    } catch (error) {
      logMessage(
        this.currentNum,
        this.total,
        `Request failed: ${error.message}`,
        "error"
      );
      return null;
    }
  }

  generateTempEmail() {
    const emailGenerator = new EmailGenerator(this.baseEmail);
    const tempEmail = emailGenerator.generateRandomVariation();
    logMessage(
      this.currentNum,
      this.total,
      `Email using: ${tempEmail}`,
      "success"
    );
    return tempEmail;
  }

  async getCaptchaCode() {
    try {
      const headers = {
        accept: "*/*",
      };
      const response = await this.makeRequest(
        "POST",
        "https://arichain.io/api/captcha/create",
        { headers }
      );

      return response;
    } catch {
      console.error("Error create captcha :", error);
      return null;
    }
  }

  async getCaptchaImage(uniqueIdx) {
    try {
      const response = await this.makeRequest(
        "GET",
        `http://arichain.io/api/captcha/get?unique_idx=${uniqueIdx}`,
        { responseType: "arraybuffer" }
      );
      return response.data;
    } catch {
      console.error("Error get image captcha:", error);
      return null;
    }
  }

  async solveCaptchaWithGemini(imageBuffer) {
    try {
      const prompt = gemeiniPrompt;
      const image = {
        inlineData: {
          data: Buffer.from(imageBuffer).toString("base64"),
          mimeType: "image/png",
        },
      };

      const result = await this.model.generateContent([prompt, image]);
      const captchaText = result.response.text().trim();
      const cleanedCaptchaText = captchaText.replace(/\s/g, "");

      return cleanedCaptchaText;
    } catch (error) {
      if (error.message.includes("quota") || error.message.includes("limit")) {
        throw new Error(
          "Your gemini API key has reached the limit. Please wait for the quota to reset."
        );
      }

      return null;
    }
  }
  async solveCaptchaWith2Captcha(imageBuffer) {
    try {
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      const res = await this.twoCaptchaSolver.imageCaptcha({
        body: `data:image/png;base64,${base64Image}`,
        regsense: 1,
      });

      return res.data;
    } catch (error) {
      console.error("Error solving CAPTCHA with 2Captcha:", error);
      return null;
    }
  }

  async solveCaptchaWithAntiCaptcha(imageBuffer) {
    try {
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      const captchaText = await ac.solveImage(base64Image, true);
      return captchaText;
    } catch (error) {
      console.error("Error solving CAPTCHA with Anti-Captcha:", error);
      return null;
    }
  }

  async sendEmailCode(email, use2Captcha = false, useAntiCaptcha = false) {
    logMessage(
      this.currentNum,
      this.total,
      "Processing send email code...",
      "process"
    );

    let captchaResponse;
    let captchaText;
    let response;
    const maxAttempts = 3;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      logMessage(
        this.currentNum,
        this.total,
        `Attempt ${attempts} to solve captcha...`,
        "process"
      );

      captchaResponse = await this.getCaptchaCode();
      if (
        !captchaResponse ||
        !captchaResponse.data ||
        !captchaResponse.data.result
      ) {
        logMessage(
          this.currentNum,
          this.total,
          "Failed to get captcha",
          "error"
        );
        continue;
      }

      const uniqueIdx = captchaResponse.data.result.unique_idx;

      const captchaImageBuffer = await this.getCaptchaImage(uniqueIdx);
      if (!captchaImageBuffer) {
        logMessage(
          this.currentNum,
          this.total,
          "Failed to get captcha iamge",
          "error"
        );
        continue;
      }

      if (use2Captcha) {
        captchaText = await this.solveCaptchaWith2Captcha(captchaImageBuffer);
      } else if (useAntiCaptcha) {
        captchaText = await this.solveCaptchaWithAntiCaptcha(
          captchaImageBuffer
        );
      } else {
        captchaText = await this.solveCaptchaWithGemini(captchaImageBuffer);
      }

      if (!captchaText) {
        logMessage(
          this.currentNum,
          this.total,
          "Failed to solve captcha",
          "error"
        );
        continue;
      }

      const headers = {
        accept: "*/*",
        "content-type": "application/x-www-form-urlencoded",
      };

      const data = qs.stringify({
        email: email,
        unique_idx: uniqueIdx,
        captcha_string: captchaText,
      });

      response = await this.makeRequest(
        "POST",
        "https://arichain.io/api/Email/send_valid_email",
        { headers, data }
      );

      if (!response) {
        logMessage(
          this.currentNum,
          this.total,
          "Failed to send email",
          "error"
        );
        continue;
      }

      if (response.data.status === "fail") {
        if (response.data.msg === "captcha is not valid") {
          logMessage(
            this.currentNum,
            this.total,
            "Captcha is not valid, retrying...",
            "error"
          );
          continue;
        } else {
          logMessage(this.currentNum, this.total, response.data.msg, "error");
          return false;
        }
      }

      logMessage(
        this.currentNum,
        this.total,
        "Solve captcha done...",
        "success"
      );

      logMessage(
        this.currentNum,
        this.total,
        "Email sent successfully",
        "success"
      );
      return true;
    }

    logMessage(
      this.currentNum,
      this.total,
      "Failed to send email after multiple attempts",
      "error"
    );
    return false;
  }

  async getCodeVerification(tempEmail) {
    logMessage(
      this.currentNum,
      this.total,
      "Waiting for code verification...",
      "process"
    );
    const client = await authorize();
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      logMessage(
        this.currentNum,
        this.total,
        `Attempt ${attempt + 1}`,
        "process"
      );

      logMessage(
        this.currentNum,
        this.total,
        "Waiting for 10sec...",
        "process"
      );
      await new Promise((resolve) => setTimeout(resolve, 10000));

      try {
        const lock = await client.getMailboxLock("INBOX");
        try {
          const messages = await client.fetch("1:*", {
            envelope: true,
            source: true,
          });

          for await (const message of messages) {
            if (
              message.envelope.to &&
              message.envelope.to.some((to) => to.address === tempEmail)
            ) {
              const emailSource = message.source.toString();
              const parsedEmail = await simpleParser(emailSource);
              const verificationCode = this.extractVerificationCode(
                parsedEmail.html
              );
              if (verificationCode) {
                logMessage(
                  this.currentNum,
                  this.total,
                  `Verification code found: ${verificationCode}`,
                  "success"
                );
                return verificationCode;
              } else {
                logMessage(
                  this.currentNum,
                  this.total,
                  "No verification code found in the email body.",
                  "error"
                );
              }
            }
          }
        } finally {
          lock.release();
        }
      } catch (error) {
        console.error("Error fetching emails:", error);
      }

      logMessage(
        this.currentNum,
        this.total,
        "Verification code not found. Waiting for 5 sec...",
        "error"
      );
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    logMessage(
      this.currentNum,
      this.total,
      "Error get code verification.",
      "error"
    );
    return null;
  }

  extractVerificationCode(html) {
    if (!html) return null;
    const codeMatch = html.match(/\b\d{6}\b/);
    if (codeMatch) {
      return codeMatch[0];
    }

    return null;
  }

  async checkinDaily(address) {
    const headers = {
      accept: "*/*",
      "content-type": "application/x-www-form-urlencoded",
    };
    const data = qs.stringify({ address });
    const response = await this.makeRequest(
      "POST",
      "https://arichain.io/api/event/checkin",
      {
        headers,
        data,
      }
    );
    if (response.data.status === "fail") {
      logMessage(this.currentNum, this.total, response.data.msg, "error");
      return null;
    }
    return response.data;
  }

  async transferToken(email, toAddress, password, amount = 60) {
    const headers = {
      accept: "*/*",
      "content-type": "application/x-www-form-urlencoded",
    };
    const transferData = qs.stringify({
      email,
      to_address: toAddress,
      pw: password,
      amount,
    });
    const response = await this.makeRequest(
      "POST",
      "https://arichain.io/api/wallet/transfer_mobile",
      {
        headers,
        data: transferData,
      }
    );

    if (response.data.status === "fail") {
      logMessage(this.currentNum, this.total, response.data.msg, "error");
      return null;
    }

    return response.data;
  }

  async registerAccount(email, password) {
    logMessage(this.currentNum, this.total, "Register account...", "process");

    const verifyCode = await this.getCodeVerification(email);
    if (!verifyCode) {
      logMessage(
        this.currentNum,
        this.total,
        "Failed get code verification.",
        "error"
      );
      return null;
    }

    const headers = {
      accept: "*/*",
      "content-type": "application/x-www-form-urlencoded",
    };

    const registerData = qs.stringify({
      email: email,
      pw: password,
      pw_re: password,
      valid_code: verifyCode,
      invite_code: this.refCode,
    });

    const response = await this.makeRequest(
      "POST",
      "https://arichain.io/api/Account/signup",
      {
        headers,
        data: registerData,
      }
    );

    if (response.data.status === "fail") {
      logMessage(this.currentNum, this.total, response.data.msg, "error");
      return null;
    }

    logMessage(this.currentNum, this.total, "Register succesfully.", "success");

    return response.data;
  }
}

module.exports = ariChain;

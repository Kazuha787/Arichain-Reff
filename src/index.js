const { prompt, logMessage, rl } = require("./utils/logger");
const ariChain = require("./classes/ariChain");
const { generatePassword } = require("./utils/generator");
const { getRandomProxy, loadProxies } = require("./classes/proxy");
const chalk = require("chalk");
const fs = require("fs");

async function main() {
  console.log(
    chalk.cyan(`
𝐅 𝐎 𝐑 𝐄 𝐒 𝐓 𝐀 𝐑 𝐌 𝐘
     TG:- t.me/forestarmy
     YT:- youtube.com/forestarmy
  `)
  );

  const captchaSolverResponse = await prompt(
    chalk.yellow(
      `Choose CAPTCHA solver : \n1.2Captcha\n2.Anti-Captcha\n3.Gemini\nEnter number: `
    )
  );
  const use2Captcha = captchaSolverResponse === "1";
  const useAntiCaptcha = captchaSolverResponse === "2";
  const useGemini = captchaSolverResponse === "3";
  const refCode = await prompt(chalk.yellow("Enter Referral Code: "));
  // const toAddress = await prompt(
  //   chalk.yellow("Enter target address for token transfer: ")
  // );
  const count = parseInt(await prompt(chalk.yellow("How many do you want? ")));
  const proxiesLoaded = loadProxies();
  if (!proxiesLoaded) {
    logMessage(null, null, "No Proxy. Using default IP", "warning");
  }

  let successful = 0;
  const accountAri = fs.createWriteStream("accounts.txt", { flags: "a" });
  const accountsbot = fs.createWriteStream("accountsbot.txt", { flags: "a" });

  try {
    for (let i = 0; i < count; i++) {
      console.log(chalk.white("-".repeat(85)));
      logMessage(i + 1, count, "Processing register account", "process");

      const currentProxy = await getRandomProxy(i + 1, count);
      const generator = new ariChain(refCode, currentProxy, i + 1, count);

      try {
        const email = generator.generateTempEmail();
        const password = generatePassword();

        const emailSent = await generator.sendEmailCode(
          email,
          use2Captcha,
          useAntiCaptcha
        );
        if (!emailSent) continue;

        const account = await generator.registerAccount(email, password);

        if (account) {
          accountAri.write(`Email : ${email}\n`);
          accountAri.write(`Password : ${password}\n`);
          accountAri.write(`Address : ${account.result.address}\n`);
          accountAri.write(`Master Key : ${account.result.master_key}\n`);
          accountAri.write(`Invite Code : ${account.result.invite_code}\n`);
          accountAri.write(`Reff To: ${refCode}\n`);
          accountsbot.write(`${email}:${password}\n`);
          accountAri.write("-".repeat(85) + "\n");

          successful++;
          logMessage(i + 1, count, `Email: ${email}`, "success");
          logMessage(i + 1, count, `Password: ${password}`, "success");
          logMessage(i + 1, count, `Reff To : ${refCode}`, "success");

          const address = account.result.address;
          try {
            const checkinResult = await generator.checkinDaily(address);
            logMessage(i + 1, count, `Checkin Daily Done`, "success");
            if (!checkinResult) {
              throw new Error("Failed checkin daily");
            }
            // const transferResult = await generator.transferToken(
            //   email,
            //   toAddress,
            //   password,
            //   60
            // );
            // if (!transferResult) {
            //   throw new Error("Gagal transfer token");
            // }
            // logMessage(i + 1, count, `Transfer Token Done`, "success");
          } catch (error) {
            logMessage(i + 1, count, error.message, "error");
            continue;
          }
        } else {
          logMessage(i + 1, count, "Register Account Failed", "error");
        }
      } catch (error) {
        if (
          error.message ===
          "Your gemini API key has reached the limit. Please wait for the quota to reset."
        ) {
          logMessage(i + 1, count, `${error.message}`, "error");
          break;
        }
        logMessage(i + 1, count, `Error: ${error.message}`, "error");
      }
    }
  } finally {
    accountAri.end();
    accountsbot.end();

    console.log(chalk.magenta("\n[*] Dono bang!"));
    console.log(
      chalk.green(`[*] Account dono ${successful} dari ${count} akun`)
    );
    console.log(chalk.magenta("[*] Result in accounts.txt"));
    rl.close();
  }
}

module.exports = { main };

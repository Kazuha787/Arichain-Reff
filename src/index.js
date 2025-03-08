const { prompt, logMessage, rl } = require("./utils/logger");
const ariChain = require("./classes/ariChain");
const { generatePassword } = require("./utils/generator");
const { getRandomProxy, loadProxies } = require("./classes/proxy");
const chalk = require("chalk");
const fs = require("fs");
const ora = require("ora").default;

function print_banner() {
    console.log(chalk.cyan(`
╔════════════════════════════════════════════════════╗
║                 ARICHAIN IS BACK!                  ║
║         Automate your AriChain registration!       ║
║    Developed by: https://t.me/Offical_Im_kazuha    ║
║    GitHub: https://github.com/Kazuha787            ║
╠════════════════════════════════════════════════════╣
║                                                    ║
║  ██╗  ██╗ █████╗ ███████╗██╗   ██╗██╗  ██╗ █████╗  ║
║  ██║ ██╔╝██╔══██╗╚══███╔╝██║   ██║██║  ██║██╔══██╗ ║
║  █████╔╝ ███████║  ███╔╝ ██║   ██║███████║███████║ ║
║  ██╔═██╗ ██╔══██║ ███╔╝  ██║   ██║██╔══██║██╔══██║ ║
║  ██║  ██╗██║  ██║███████╗╚██████╔╝██║  ██║██║  ██║ ║
║  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ║
║                                                    ║
╚════════════════════════════════════════════════════╝
`));
}

async function main() {
    print_banner();

    console.log(chalk.green("🚀 AriChain Automation Starting... 🚀"));

    const captchaSolverResponse = await prompt(
        chalk.yellow("🔍 Choose CAPTCHA solver : \n1. 2Captcha\n2. Anti-Captcha\n3. Gemini\nEnter number: ")
    );
    const use2Captcha = captchaSolverResponse === "1";
    const useAntiCaptcha = captchaSolverResponse === "2";
    const useGemini = captchaSolverResponse === "3";
    
    const refCode = await prompt(chalk.yellow("🔗 Enter Referral Code: "));
    const count = parseInt(await prompt(chalk.yellow("🔢 How many accounts do you want to create? ")));
    
    const proxiesLoaded = loadProxies();
    if (!proxiesLoaded) {
        logMessage(null, null, "⚠️ No Proxy. Using default IP", "warning");
    }

    let successful = 0;
    const accountAri = fs.createWriteStream("accounts.txt", { flags: "a" });
    const accountsbot = fs.createWriteStream("accountsbot.txt", { flags: "a" });

    try {
        for (let i = 0; i < count; i++) {
            console.log(chalk.white("-".repeat(85)));
            logMessage(i + 1, count, "⏳ Processing register account", "process");

            const spinner = ora(`🔄 Registering account ${i + 1} of ${count}...`).start();
            const currentProxy = await getRandomProxy(i + 1, count);
            const generator = new ariChain(refCode, currentProxy, i + 1, count);

            try {
                const email = generator.generateTempEmail();
                const password = generatePassword();

                spinner.text = "📩 Sending email verification...";
                const emailSent = await generator.sendEmailCode(email, use2Captcha, useAntiCaptcha);
                if (!emailSent) {
                    spinner.fail("❌ Email verification failed");
                    continue;
                }

                spinner.text = "📝 Registering account...";
                const account = await generator.registerAccount(email, password);

                if (account) {
                    spinner.succeed("✅ Account registered successfully!");

                    accountAri.write(`Email : ${email}\n`);
                    accountAri.write(`Password : ${password}\n`);
                    accountAri.write(`Address : ${account.result.address}\n`);
                    accountAri.write(`Master Key : ${account.result.master_key}\n`);
                    accountAri.write(`Invite Code : ${account.result.invite_code}\n`);
                    accountAri.write(`Reff To: ${refCode}\n`);
                    accountsbot.write(`${email}:${password}\n`);
                    accountAri.write("-".repeat(85) + "\n");

                    successful++;
                    logMessage(i + 1, count, `📧 Email: ${email}`, "success");
                    logMessage(i + 1, count, `🔑 Password: ${password}`, "success");
                    logMessage(i + 1, count, `🔗 Reff To : ${refCode}`, "success");

                    const address = account.result.address;
                    try {
                        spinner.text = "🔄 Performing daily check-in...";
                        const checkinResult = await generator.checkinDaily(address);
                        if (checkinResult) {
                            spinner.succeed("✅ Daily check-in completed!");
                        } else {
                            throw new Error("⚠️ Failed check-in daily");
                        }
                    } catch (error) {
                        logMessage(i + 1, count, error.message, "error");
                        continue;
                    }
                } else {
                    spinner.fail("❌ Register Account Failed");
                }
            } catch (error) {
                if (
                    error.message ===
                    "Your gemini API key has reached the limit. Please wait for the quota to reset."
                ) {
                    spinner.fail(`❌ ${error.message}`);
                    break;
                }
                spinner.fail(`❌ Error: ${error.message}`);
            }
        }
    } finally {
        accountAri.end();
        accountsbot.end();

        console.log(chalk.magenta("\n🎉 Process Complete! 🎉"));
        console.log(chalk.green(`✅ Successfully created ${successful} out of ${count} accounts`));
        console.log(chalk.magenta("📁 Results saved in accounts.txt"));
        rl.close();
    }
}

module.exports = { main };

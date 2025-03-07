const readline = require("readline");
const chalk = require("chalk");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const prompt = (question) =>
  new Promise((resolve) => rl.question(question, resolve));

function logMessage(
  currentNum = null,
  total = null,
  message = "",
  messageType = "info"
) {
  const now = new Date();
  const timestamp = now
    .toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(/\./g, ":")
    .replace(/, /g, " ");
  const accountStatus = currentNum && total ? `[${currentNum}/${total}] ` : "";

  const colors = {
    info: chalk.white,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    process: chalk.cyan,
    debug: chalk.blue,
  };

  const logColor = colors[messageType] || chalk.white;

  let logText;
  switch (messageType) {
    case "success":
      logText = chalk.green(`[✓] ${message}`);
      break;
    case "error":
      logText = chalk.red(`[-] ${message}`);
      break;
    case "warning":
      logText = chalk.yellow(`[!] ${message}`);
      break;
    case "process":
      logText = chalk.blue(`[~] ${message}`);
      break;
    default:
      logText = chalk.white(`[?] ${message}`);
  }

  console.log(
    `${chalk.white("[")}${chalk.dim(timestamp)}${chalk.white(
      "]"
    )} ${accountStatus}${logText}`
  );
}

module.exports = {
  prompt,
  logMessage,
  rl,
};

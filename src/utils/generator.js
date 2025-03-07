class EmailGenerator {
  constructor(baseEmail) {
    this.baseEmail = baseEmail;
  }

  generateCaseVariations() {
    const [username, domain] = this.baseEmail.split("@");
    let newUsername = "";

    for (let char of username) {
      if (Math.random() < 0.5) {
        newUsername += char.toUpperCase();
      } else {
        newUsername += char.toLowerCase();
      }
    }

    return `${newUsername}@${domain}`;
  }

  generateRandomVariation() {
    return this.generateCaseVariations();
  }
}

function generatePassword() {
  const firstLetter = String.fromCharCode(Math.floor(Math.random() * 26) + 65);
  const otherLetters = Array.from({ length: 4 }, () =>
    String.fromCharCode(Math.floor(Math.random() * 26) + 97)
  ).join("");
  const numbers = Array.from({ length: 3 }, () =>
    Math.floor(Math.random() * 10)
  ).join("");
  return `${firstLetter}${otherLetters}@${numbers}!`;
}

module.exports = { EmailGenerator, generatePassword };

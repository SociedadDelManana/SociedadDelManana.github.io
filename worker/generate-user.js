

const crypto = require("crypto");

const password = process.argv[2];
if (!password) {
  console.error("Uso: node generate-user.js \"contraseña\"");
  process.exit(1);
}

const iterations = 100000;
const salt = crypto.randomBytes(16);
const derived = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");

const record = {
  salt: salt.toString("base64"),
  hash: derived.toString("base64"),
  iterations,
  algorithm: "PBKDF2-SHA256",
};

console.log(JSON.stringify(record));

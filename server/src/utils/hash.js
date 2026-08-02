const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

// One-way hash — this is what gets stored in the DB. There is no matching "decrypt".
async function hashSecret(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

// Compares a plaintext value against a stored bcrypt hash. Never compare plaintext-to-plaintext.
async function verifySecret(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

module.exports = { hashSecret, verifySecret };

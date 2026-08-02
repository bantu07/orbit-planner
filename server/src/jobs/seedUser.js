// Creates (or resets) the single app user with securely hashed credentials.
// Run with: npm run seed
// You will be prompted for username/password/master passphrase — nothing is hardcoded here.

require('dotenv').config();
const readline = require('readline');
const db = require('../db');
const { hashSecret } = require('../utils/hash');

function ask(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const username = await ask('Username: ');
  const password = await ask('Password: ');
  const passphrase = await ask('Master passphrase (used to unlock a locked account): ');

  const passwordHash = await hashSecret(password);
  const passphraseHash = await hashSecret(passphrase);

  const [existing] = await db.query('SELECT id FROM users WHERE username = ?', [username]);

  let userId;
  if (existing.length) {
    userId = existing[0].id;
    await db.query(
      `UPDATE users SET password_hash = ?, master_passphrase_hash = ?, failed_attempts = 0, locked = FALSE
       WHERE id = ?`,
      [passwordHash, passphraseHash, userId]
    );
    console.log(`Updated existing user "${username}" (id ${userId}).`);
  } else {
    const [result] = await db.query(
      'INSERT INTO users (username, password_hash, master_passphrase_hash) VALUES (?, ?, ?)',
      [username, passwordHash, passphraseHash]
    );
    userId = result.insertId;
    console.log(`Created user "${username}" (id ${userId}).`);

    const defaults = [
      ['Deep work', '#3DF5FF'],
      ['Meetings', '#A97BFF'],
      ['Movement', '#FF4FCB'],
      ['Wind down', '#FFC15E'],
    ];
    for (const [name, color] of defaults) {
      await db.query('INSERT IGNORE INTO categories (user_id, name, color, is_default) VALUES (?, ?, ?, TRUE)', [
        userId,
        name,
        color,
      ]);
    }
    console.log('Seeded default categories.');
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

const express = require('express');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { verifySecret } = require('../utils/hash');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '3', 10);

// Extra brute-force protection at the network level, on top of the account lockout below.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

// The cookie/JWT is a long-lived *safety backstop* only (so a stolen cookie can't be replayed
// forever). The actual 20-minute *idle* timeout is enforced in middleware/auth.js against
// last_activity_at in the database, and that check runs on every authenticated request —
// including a fresh page load after the browser was closed and reopened.
const SESSION_BACKSTOP_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function issueSessionCookie(res, user) {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  res.cookie('session_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_BACKSTOP_MS,
  });
}

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const [rows] = await db.query(
      'SELECT id, username, password_hash, failed_attempts, locked FROM users WHERE username = ?',
      [username]
    );
    const user = rows[0];

    // Same generic error whether the user exists or the password is wrong — don't leak which one.
    const genericError = () => res.status(401).json({ error: 'Incorrect username or password' });

    if (!user) return genericError();
    if (user.locked) {
      return res.status(423).json({ error: 'Account is locked. Enter the master passphrase to unlock.' });
    }

    const ok = await verifySecret(password, user.password_hash);
    if (!ok) {
      const attempts = user.failed_attempts + 1;
      const willLock = attempts >= MAX_ATTEMPTS;
      await db.query('UPDATE users SET failed_attempts = ?, locked = ? WHERE id = ?', [
        attempts,
        willLock,
        user.id,
      ]);
      if (willLock) {
        return res.status(423).json({ error: 'Account locked after too many failed attempts.' });
      }
      return res.status(401).json({
        error: 'Incorrect username or password',
        attemptsRemaining: MAX_ATTEMPTS - attempts,
      });
    }

    await db.query(
      'UPDATE users SET failed_attempts = 0, locked = FALSE, last_activity_at = NOW() WHERE id = ?',
      [user.id]
    );
    issueSessionCookie(res, user);
    res.json({ ok: true, username: user.username });
  } catch (err) {
    next(err);
  }
});

router.post('/unlock', loginLimiter, async (req, res, next) => {
  try {
    const { username, masterPassphrase } = req.body;
    if (!username || !masterPassphrase) {
      return res.status(400).json({ error: 'Username and master passphrase are required' });
    }

    const [rows] = await db.query(
      'SELECT id, master_passphrase_hash FROM users WHERE username = ?',
      [username]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Incorrect passphrase' });

    const ok = await verifySecret(masterPassphrase, user.master_passphrase_hash);
    if (!ok) return res.status(401).json({ error: 'Incorrect passphrase' });

    await db.query('UPDATE users SET failed_attempts = 0, locked = FALSE WHERE id = ?', [user.id]);
    res.json({ ok: true, message: 'Account unlocked. You can sign in again.' });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  res.clearCookie('session_token');
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ username: req.user.username });
});

module.exports = router;

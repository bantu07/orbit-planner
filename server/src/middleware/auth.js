const jwt = require('jsonwebtoken');
const db = require('../db');

const IDLE_MINUTES = parseInt(process.env.SESSION_IDLE_MINUTES || '20', 10);

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.session_token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      res.clearCookie('session_token');
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }

    const [rows] = await db.query(
      'SELECT id, username, locked, last_activity_at FROM users WHERE id = ?',
      [payload.userId]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Not authenticated' });
    if (user.locked) return res.status(423).json({ error: 'Account is locked' });

    // Server-side idle timeout — this is the real check; the JWT expiry above is a backstop.
    if (user.last_activity_at) {
      const lastActive = new Date(user.last_activity_at).getTime();
      const idleMs = Date.now() - lastActive;
      if (idleMs > IDLE_MINUTES * 60 * 1000) {
        res.clearCookie('session_token');
        return res.status(401).json({ error: 'Session timed out due to inactivity' });
      }
    }

    await db.query('UPDATE users SET last_activity_at = NOW() WHERE id = ?', [user.id]);

    req.user = { id: user.id, username: user.username };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };

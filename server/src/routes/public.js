const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = express.Router();

// PUBLIC, UNAUTHENTICATED ROUTE — anything returned here is visible to anyone who opens the
// site URL. Deliberately scoped to today's blocks only, and read-only: there is no POST/PUT/
// DELETE here, so nothing can be created, edited or removed without signing in.
//
// This app is single-user by design, so "the user" is resolved as the one seeded account
// rather than taking an id from the request (which would let a caller enumerate other rows).
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/today', publicLimiter, async (req, res, next) => {
  try {
    const [[user]] = await db.query('SELECT id FROM users ORDER BY id LIMIT 1');
    if (!user) return res.json([]);

    const [rows] = await db.query(
      `SELECT pb.title, pb.notes, pb.start_time, pb.end_time,
              c.name AS category_name, c.color AS category_color
       FROM planner_blocks pb
       LEFT JOIN categories c ON c.id = pb.category_id
       WHERE pb.user_id = ? AND pb.block_date = CURDATE()
       ORDER BY pb.start_time`,
      [user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

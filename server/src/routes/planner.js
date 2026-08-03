const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// ---- Categories ----
router.get('/categories', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM categories WHERE user_id = ? ORDER BY id', [
      req.user.id,
    ]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Same palette used for the 4 seeded defaults (cyan/violet/magenta/amber), extended so
// custom categories keep getting a genuinely distinct color instead of all defaulting to cyan.
const CATEGORY_PALETTE = ['#3DF5FF', '#A97BFF', '#FF4FCB', '#FFC15E', '#4ADE80', '#60A5FA', '#FB923C', '#F472B6'];

router.post('/categories', async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    let assignedColor = color;
    if (!assignedColor) {
      const [[{ count }]] = await db.query(
        'SELECT COUNT(*) AS count FROM categories WHERE user_id = ?',
        [req.user.id]
      );
      assignedColor = CATEGORY_PALETTE[count % CATEGORY_PALETTE.length];
    }

    const [result] = await db.query(
      'INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)',
      [req.user.id, name.trim(), assignedColor]
    );
    res.status(201).json({ id: result.insertId, name, color: assignedColor });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'That category already exists' });
    }
    next(err);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    await db.query('DELETE FROM categories WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ---- Time blocks ----
// range=today | range=YYYY-MM-DD..YYYY-MM-DD (past week view etc.)
router.get('/blocks', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    let sql = `SELECT pb.*, c.name AS category_name, c.color AS category_color
               FROM planner_blocks pb
               LEFT JOIN categories c ON c.id = pb.category_id
               WHERE pb.user_id = ?`;
    const params = [req.user.id];
    if (from && to) {
      sql += ' AND pb.block_date BETWEEN ? AND ?';
      params.push(from, to);
    }
    sql += ' ORDER BY pb.block_date, pb.start_time';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/blocks', async (req, res, next) => {
  try {
    const { title, notes, category_id, block_date, start_time, end_time } = req.body;
    if (!title || !block_date || !start_time || !end_time) {
      return res.status(400).json({ error: 'title, block_date, start_time and end_time are required' });
    }
    const [result] = await db.query(
      `INSERT INTO planner_blocks (user_id, category_id, title, notes, block_date, start_time, end_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, category_id || null, title, notes || null, block_date, start_time, end_time]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.put('/blocks/:id', async (req, res, next) => {
  try {
    const { title, notes, category_id, block_date, start_time, end_time } = req.body;
    const [result] = await db.query(
      `UPDATE planner_blocks
       SET title = COALESCE(?, title),
           notes = COALESCE(?, notes),
           category_id = COALESCE(?, category_id),
           block_date = COALESCE(?, block_date),
           start_time = COALESCE(?, start_time),
           end_time = COALESCE(?, end_time)
       WHERE id = ? AND user_id = ?`,
      [title, notes, category_id, block_date, start_time, end_time, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Block not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/blocks/:id', async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM planner_blocks WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Block not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

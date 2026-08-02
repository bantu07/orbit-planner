const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function getTagsForEntry(entryId) {
  const [rows] = await db.query(
    `SELECT jt.id, jt.name FROM journal_entry_tags jet
     JOIN journal_tags jt ON jt.id = jet.tag_id
     WHERE jet.entry_id = ?`,
    [entryId]
  );
  return rows;
}

router.get('/entries', async (req, res, next) => {
  try {
    const [entries] = await db.query(
      'SELECT * FROM journal_entries WHERE user_id = ? ORDER BY entry_date DESC, id DESC',
      [req.user.id]
    );
    const withTags = await Promise.all(
      entries.map(async (e) => ({ ...e, tags: await getTagsForEntry(e.id) }))
    );
    res.json(withTags);
  } catch (err) {
    next(err);
  }
});

router.post('/entries', async (req, res, next) => {
  const conn = await db.getConnection();
  try {
    const { entry_date, mood, content, tags } = req.body;
    if (!entry_date || !mood || !content) {
      return res.status(400).json({ error: 'entry_date, mood and content are required' });
    }
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO journal_entries (user_id, entry_date, mood, content) VALUES (?, ?, ?, ?)',
      [req.user.id, entry_date, mood, content]
    );
    const entryId = result.insertId;

    if (Array.isArray(tags)) {
      for (const tagName of tags) {
        const clean = tagName.trim();
        if (!clean) continue;
        await conn.query('INSERT IGNORE INTO journal_tags (user_id, name) VALUES (?, ?)', [
          req.user.id,
          clean,
        ]);
        const [[tagRow]] = await conn.query(
          'SELECT id FROM journal_tags WHERE user_id = ? AND name = ?',
          [req.user.id, clean]
        );
        await conn.query('INSERT IGNORE INTO journal_entry_tags (entry_id, tag_id) VALUES (?, ?)', [
          entryId,
          tagRow.id,
        ]);
      }
    }

    await conn.commit();
    res.status(201).json({ id: entryId });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
});

router.put('/entries/:id', async (req, res, next) => {
  try {
    const { mood, content } = req.body;
    const [result] = await db.query(
      `UPDATE journal_entries SET mood = COALESCE(?, mood), content = COALESCE(?, content)
       WHERE id = ? AND user_id = ?`,
      [mood, content, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/entries/:id', async (req, res, next) => {
  try {
    const [result] = await db.query('DELETE FROM journal_entries WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Entry not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.get('/tags', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM journal_tags WHERE user_id = ? ORDER BY name', [
      req.user.id,
    ]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

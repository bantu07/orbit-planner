const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Hours spent per category, for a given range: daily | weekly | monthly
// For monthly, an optional ?month=YYYY-MM lets the user browse a specific calendar month
// (e.g. last month) instead of only the rolling last-30-days window.
router.get('/breakdown/:range', async (req, res, next) => {
  try {
    const { range } = req.params;
    const { month } = req.query;

    let whereClause;
    const params = [req.user.id];
    if (range === 'daily') {
      whereClause = 'pb.block_date = CURDATE()';
    } else if (range === 'weekly') {
      whereClause = 'pb.block_date >= CURDATE() - INTERVAL 6 DAY'; // last 7 days, inclusive of today
    } else if (range === 'monthly' && /^\d{4}-\d{2}$/.test(month || '')) {
      // a specific calendar month, e.g. "2026-07" → all of July 2026
      whereClause = 'pb.block_date >= ? AND pb.block_date < DATE_ADD(?, INTERVAL 1 MONTH)';
      params.push(`${month}-01`, `${month}-01`);
    } else {
      whereClause = 'pb.block_date >= CURDATE() - INTERVAL 29 DAY'; // last 30 days, inclusive of today
    }

    const [rows] = await db.query(
      `SELECT c.name, c.color,
              ROUND(SUM(TIME_TO_SEC(TIMEDIFF(pb.end_time, pb.start_time))) / 3600, 2) AS hours
       FROM planner_blocks pb
       JOIN categories c ON c.id = pb.category_id
       WHERE pb.user_id = ? AND ${whereClause}
       GROUP BY c.id, c.name, c.color
       ORDER BY hours DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Planned vs. completed hours per day, for the current week (Mon–Sun)
// NOTE: "completed" assumes a `completed` flag would exist on planner_blocks in a fuller version.
// For simplicity here, all logged blocks count as both planned and completed once their end_time has passed.
router.get('/week', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT block_date,
              ROUND(SUM(TIME_TO_SEC(TIMEDIFF(end_time, start_time))) / 3600, 2) AS planned_hours,
              ROUND(SUM(
                CASE WHEN TIMESTAMP(block_date, end_time) <= NOW()
                     THEN TIME_TO_SEC(TIMEDIFF(end_time, start_time)) ELSE 0 END
              ) / 3600, 2) AS completed_hours
       FROM planner_blocks
       WHERE user_id = ? AND block_date >= CURDATE() - INTERVAL WEEKDAY(CURDATE()) DAY
       GROUP BY block_date
       ORDER BY block_date`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Completion-rate trend across the last 4 weeks
router.get('/month', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT
         WEEK(block_date) AS week_number,
         ROUND(100 * SUM(
           CASE WHEN TIMESTAMP(block_date, end_time) <= NOW()
                THEN TIME_TO_SEC(TIMEDIFF(end_time, start_time)) ELSE 0 END
         ) / NULLIF(SUM(TIME_TO_SEC(TIMEDIFF(end_time, start_time))), 0), 1) AS completion_pct
       FROM planner_blocks
       WHERE user_id = ? AND block_date >= CURDATE() - INTERVAL 28 DAY
       GROUP BY WEEK(block_date)
       ORDER BY week_number`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

// Deletes planner_blocks older than 7 days, so new plans effectively "overwrite" the oldest day
// on a rolling basis, as requested. Run this on a schedule (cron / hosting provider's scheduled
// jobs feature) — see the deployment guide for wiring this up for free on your chosen host.
//
// Example cron (daily at 00:05):
//   5 0 * * * cd /path/to/server && node src/jobs/archiveOldBlocks.js >> logs/archive.log 2>&1

require('dotenv').config();
const db = require('../db');

async function main() {
  const [result] = await db.query(
    'DELETE FROM planner_blocks WHERE block_date < CURDATE() - INTERVAL 7 DAY'
  );
  console.log(`Archived (deleted) ${result.affectedRows} planner block(s) older than 7 days.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

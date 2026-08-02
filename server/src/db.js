const mysql = require('mysql2/promise');
require('dotenv').config();

// Aiven (and most managed MySQL hosts) require an SSL/TLS connection. Locally against your
// own MySQL install you likely don't set DB_SSL_CA, so this stays undefined and the
// connection is plain — exactly like before. In production, DB_SSL_CA holds Aiven's CA
// certificate (pasted as an env var), which turns SSL on.
const sslConfig = process.env.DB_SSL_CA
  ? { ca: process.env.DB_SSL_CA, rejectUnauthorized: true }
  : undefined;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  ssl: sslConfig,
});

module.exports = pool;

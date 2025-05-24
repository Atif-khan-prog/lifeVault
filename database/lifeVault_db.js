const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10, // Adjust based on your hosting plan
  queueLimit: 0,
  connectTimeout: 10000, // 10 seconds
});

// Promisify for async/await
const promisePool = pool.promise();

// Debug connection pool status
pool.on('connection', () => {
  console.log('New MySQL connection established');
});

pool.on('acquire', () => {
  console.log('MySQL connection acquired from pool');
});

pool.on('release', () => {
  console.log('MySQL connection released back to pool');
});

pool.on('error', (err) => {
  console.error('MySQL Pool Error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Connection lost, pool will attempt to reconnect');
  } else {
    throw err; // Rethrow unexpected errors
  }
});

// Test initial connection
promisePool
  .query('SELECT 1')
  .then(() => console.log('Connected to remote MySQL DB!'))
  .catch((err) => console.error('Initial DB connection failed:', err));

module.exports = promisePool;
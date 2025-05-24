const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 1, // Reduced to 1 to minimize connections
  queueLimit: 0,
  connectTimeout: 10000,
});

const promisePool = pool.promise();

pool.on('connection', () => console.log('New MySQL connection established'));
pool.on('acquire', () => console.log('MySQL connection acquired from pool'));
pool.on('release', () => console.log('MySQL connection released back to pool'));
pool.on('enqueue', () => console.log('MySQL connection request enqueued'));
pool.on('error', (err) => {
  console.error('MySQL Pool Error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    console.log('Connection lost, pool will attempt to reconnect');
  } else {
    throw err;
  }
});

// Skip initial query to avoid connection errors
console.log('Database pool initialized, skipping initial query due to connection limits');

module.exports = promisePool;
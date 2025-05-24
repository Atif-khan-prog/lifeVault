const mysql = require('mysql2');

// Create the connection pool for better performance & automatic reconnection
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'lifeVault_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;

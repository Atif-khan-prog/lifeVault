const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user:'root',
    password: 'atif12341',
    database: 'lifeVault'
});


module.exports = connection;
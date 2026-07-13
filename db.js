require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    user: String(process.env.DB_USER || 'postgres'),
    password: String(process.env.DB_PASSWORD || 'niftypassword123'),
    host: String(process.env.DB_HOST || 'localhost'),
    port: Number(process.env.DB_PORT || 5432),
    database: String(process.env.DB_NAME || 'postgres'),
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database client', err);
    process.exit(-1);
});

module.exports = pool;
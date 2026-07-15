require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing');
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Direct database connection test
pool.query('SELECT NOW()')
    .then((result) => {
        console.log('✅ DATABASE CONNECTED');
        console.log('🕒 DATABASE TIME:', result.rows[0].now);
    })
    .catch((err) => {
        console.error('❌ DATABASE CONNECTION FAILED');
        console.error(err.message);
    });

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err.message);
});

module.exports = pool;

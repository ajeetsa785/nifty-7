require('dotenv').config();
const { Pool } = require('pg');

let pool;

if (process.env.DATABASE_URL) {
    console.log('🌐 Using Render PostgreSQL');
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });
} else {
    console.log('💻 Using Local PostgreSQL');
    pool = new Pool({
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME
    });
}

// Optional connection test for local dev
if (!process.env.DATABASE_URL) {
    pool.query('SELECT NOW()')
        .then((result) => {
            console.log('✅ DATABASE CONNECTED');
            console.log('🕒 DATABASE TIME:', result.rows[0].now);
        })
        .catch((err) => {
            console.error('❌ DATABASE CONNECTION FAILED');
            console.error(err.message);
        });
}

pool.on('error', (err) => {
    console.error('❌ PostgreSQL pool error:', err.message || err);
});

module.exports = pool;

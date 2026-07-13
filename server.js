const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const axios = require('axios');

const yahooFinanceLib = require('yahoo-finance2');
const YahooFinance = yahooFinanceLib.default || yahooFinanceLib.YahooFinance || yahooFinanceLib;
const yahooFinance = typeof YahooFinance === 'function' 
    ? new YahooFinance({ suppressNotices: ['yahooSurvey'] }) 
    : YahooFinance;

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL Database Connection Pool (Cloud Ready)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:niftypassword123@localhost:5432/postgres',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

let latestMarketData = {};
let isMarketSyncing = false;

// Automation Governance States
let isContestLocked = false; 

// Full Nifty 50 Asset List
const nifty50Symbols = [
    'ADANIENT', 'ADANIPORTS', 'APOLLOHOSP', 'ASIANPAINT', 'AXISBANK', 
    'BAJAJ-AUTO', 'BAJFINANCE', 'BAJAJFINSV', 'BHARTIARTL', 'BPCL', 
    'BRITANNIA', 'CIPLA', 'COALINDIA', 'DIVISLAB', 'DRREDDY', 
    'EICHERMOT', 'GRASIM', 'HCLTECH', 'HDFCBANK', 'HDFCLIFE', 
    'HEROMOTOCO', 'HINDALCO', 'HINDUNILVR', 'ICICIBANK', 'INDUSINDBK', 
    'INFY', 'ITC', 'JSWSTEEL', 'KOTAKBANK', 'LT', 
    'LTIM', 'M&M', 'MARUTI', 'NESTLEIND', 'NTPC', 
    'ONGC', 'POWERGRID', 'RELIANCE', 'SBILIFE', 'SBIN', 
    'SUNPHARMA', 'TATACONSUM', 'TATAMOTORS', 'TATASTEEL', 'TCS', 
    'TECHM', 'TITAN', 'ULTRACEMCO', 'WIPRO', 'ZEEL'
];

// ============================================================================
// 0. AUTO-SCHEMA SETUP & SELF-HEALING DATABASE ENGINE
// ============================================================================
async function initDatabase() {
    try {
        console.log("🛠️ [DATABASE] Checking and auto-creating required tables...");
        
        await pool.query(`
            DROP TABLE IF EXISTS auth_otps CASCADE;
            
            CREATE TABLE auth_otps (
                phone VARCHAR(15) PRIMARY KEY,
                otp VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(15) UNIQUE NOT NULL,
                referral_code VARCHAR(20),
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS wallets (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                balance DECIMAL(10,2) DEFAULT 0.00
            );

            CREATE TABLE IF NOT EXISTS contests (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                entry_fee DECIMAL(10,2) DEFAULT 100.00,
                prize_pool DECIMAL(10,2) DEFAULT 0.00,
                status VARCHAR(20) DEFAULT 'active',
                created_at TIMESTAMP DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS entries (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                contest_id INT REFERENCES contests(id) ON DELETE CASCADE DEFAULT 1,
                bull_stock VARCHAR(50),
                calf_stock VARCHAR(50),
                normal_stocks TEXT,
                total_points INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);

        const contestCheck = await pool.query(`SELECT COUNT(*) FROM contests;`);
        if (parseInt(contestCheck.rows[0].count) === 0) {
            await pool.query(`
                INSERT INTO contests (id, name, entry_fee, prize_pool, status) 
                VALUES (1, 'Nifty Mega League', 100.00, 0.00, 'active'),
                       (2, 'High Roller Arena', 500.00, 0.00, 'active'),
                       (3, 'Free Practice Match', 0.00, 0.00, 'active');
            `);
            console.log("🏆 [DATABASE] Seeded 3 default active contests into lobby.");
        }

        console.log("✅ [DATABASE] All tables (auth_otps, users, wallets, contests, entries) are verified and ready!");

        await pool.query(`
            UPDATE entries 
            SET normal_stocks = REPLACE(REPLACE(REPLACE(normal_stocks, '"SBI"', '"SBIN"'), '"HDFC"', '"HDFCBANK"'), '"ICICI"', '"ICICIBANK"'),
                bull_stock = CASE WHEN bull_stock = 'SBI' THEN 'SBIN' WHEN bull_stock = 'HDFC' THEN 'HDFCBANK' WHEN bull_stock = 'ICICI' THEN 'ICICIBANK' ELSE bull_stock END,
                calf_stock = CASE WHEN calf_stock = 'SBI' THEN 'SBIN' WHEN calf_stock = 'HDFC' THEN 'HDFCBANK' WHEN calf_stock = 'ICICI' THEN 'ICICIBANK' ELSE calf_stock END;
        `);
    } catch (err) {
        console.error("❌ [DATABASE INIT ERROR]:", err.message);
    }
}
initDatabase();

// ============================================================================
// 1. AUTHENTICATION & REAL SMS GATEWAY DISPATCH
// ============================================================================
app.post('/api/request-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone || phone.length !== 10) {
        return res.status(400).json({ success: false, message: 'Invalid 10-digit mobile number.' });
    }
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    try {
        await pool.query(
            `INSERT INTO auth_otps (phone, otp, created_at) VALUES ($1, $2, NOW()) 
             ON CONFLICT (phone) DO UPDATE SET otp = EXCLUDED.otp, created_at = NOW();`,
            [phone, otp]
        );
        
        const FAST2SMS_API_KEY = "YOUR_FAST2SMS_API_KEY_HERE";
        const SEND_REAL_SMS = false; 

        if (SEND_REAL_SMS && FAST2SMS_API_KEY !== "YOUR_FAST2SMS_API_KEY_HERE") {
            try {
                await axios.post("https://www.fast2sms.com/dev/bulkV2", {
                    route: "otp",
                    variables_values: otp,
                    numbers: phone
                }, {
                    headers: {
                        "authorization": FAST2SMS_API_KEY,
                        "Content-Type": "application/json"
                    }
                });
                console.log(`📱 [LIVE SMS GATEWAY] Real text SMS dispatched to mobile: ${phone}`);
            } catch (smsErr) {
                console.error(`⚠️ [SMS DISPATCH FAILED]: Check API Key or balance. Fallback OTP for ${phone}: >>> ${otp} <<<`);
            }
        } else {
            console.log(`🔑 [SIMULATED SMS GATEWAY] SEND_REAL_SMS is false. Generated random OTP for ${phone}: >>> ${otp} <<<`);
        }

        res.json({ success: true, message: 'OTP verification code sent!' });
    } catch (err) {
        console.error("❌ [OTP REQUEST ERROR]:", err.message);
        res.status(500).json({ success: false, message: 'Database error: ' + err.message });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    const { phone, otp } = req.body;
    try {
        const otpResult = await pool.query(`SELECT * FROM auth_otps WHERE phone = $1 AND otp = $2;`, [phone, otp]);
        if (otpResult.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
        }
        await pool.query(`DELETE FROM auth_otps WHERE phone = $1;`, [phone]);

        let userResult = await pool.query(`SELECT * FROM users WHERE phone_number = $1;`, [phone]);
        let user;

        if (userResult.rows.length === 0) {
            const refCode = 'REF' + Math.floor(1000 + Math.random() * 9000);
            const insertUser = await pool.query(
                `INSERT INTO users (phone_number, referral_code) VALUES ($1, $2) RETURNING *;`,
                [phone, refCode]
            );
            user = insertUser.rows[0];
            await pool.query(`INSERT INTO wallets (user_id, balance) VALUES ($1, 500.00);`, [user.id]);
            console.log(`🎉 [NEW REGISTER] User #${user.id} created with ₹500 welcome bonus.`);
        } else {
            user = userResult.rows[0];
        }

        const walletResult = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1;`, [user.id]);
        const balance = walletResult.rows[0] ? walletResult.rows[0].balance : 0.00;

        res.json({ success: true, user: { id: user.id, phone: user.phone_number, balance } });
    } catch (err) {
        console.error("❌ [OTP VERIFY ERROR]:", err.message);
        res.status(500).json({ success: false, message: 'Login verification failed.' });
    }
});

// ============================================================================
// 2. WALLET & UPI DEPOSITS
// ============================================================================
app.post('/api/wallet/deposit', async (req, res) => {
    const { userId, amount } = req.body;
    try {
        const updateWallet = await pool.query(
            `UPDATE wallets SET balance = balance + $1 WHERE user_id = $2 RETURNING balance;`,
            [amount, userId]
        );
        res.json({ success: true, balance: updateWallet.rows[0].balance });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Deposit failed.' });
    }
});

// ============================================================================
// 3. CONTEST LOBBY & ENTRY ENGINE
// ============================================================================
app.get('/api/contests', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT c.id, c.name, c.entry_fee, c.prize_pool, c.status, COUNT(e.id) as total_entries
            FROM contests c
            LEFT JOIN entries e ON c.id = e.contest_id
            WHERE c.status = 'active'
            GROUP BY c.id
            ORDER BY c.id ASC;
        `);
        res.json({ success: true, contests: result.rows, isLocked: isContestLocked });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch contests.' });
    }
});

app.post('/api/contests/join', async (req, res) => {
    const { userId, contestId, bullStock, calfStock, normalStocks } = req.body;
    
    if (isContestLocked) {
        return res.status(400).json({ 
            success: false, 
            message: 'Contest Locked: Market is currently open. Squad creation opens daily after 3:30 PM.' 
        });
    }

    try {
        const contestCheck = await pool.query(`SELECT entry_fee, status FROM contests WHERE id = $1;`, [contestId || 1]);
        if (contestCheck.rows.length === 0 || contestCheck.rows[0].status !== 'active') {
            return res.status(400).json({ success: false, message: 'This contest is no longer active.' });
        }
        const requiredFee = parseFloat(contestCheck.rows[0].entry_fee);

        const walletCheck = await pool.query(`SELECT balance FROM wallets WHERE user_id = $1;`, [userId]);
        const currentBalance = parseFloat(walletCheck.rows[0]?.balance || 0);

        if (currentBalance < requiredFee) {
            return res.status(400).json({ success: false, message: `Insufficient balance. This match requires ₹${requiredFee}. Please deposit funds.` });
        }

        await pool.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2;`, [requiredFee, userId]);
        await pool.query(`UPDATE contests SET prize_pool = prize_pool + $1 WHERE id = $2;`, [requiredFee, contestId || 1]);
        
        await pool.query(
            `INSERT INTO entries (user_id, contest_id, bull_stock, calf_stock, normal_stocks, total_points)
             VALUES ($1, $2, $3, $4, $5, 0);`,
            [userId, contestId || 1, bullStock, calfStock, JSON.stringify(normalStocks)]
        );
        res.json({ success: true, message: 'Basket entered successfully!' });
    } catch (err) {
        console.error("❌ [CONTEST JOIN ERROR]:", err.message);
        res.status(500).json({ success: false, message: 'Failed to enter contest.' });
    }
});

// ============================================================================
// 4. LIVE LEADERBOARD FEED
// ============================================================================
app.get('/api/contests/:id/leaderboard', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT e.user_id, u.phone_number AS phone, e.bull_stock, e.calf_stock, e.normal_stocks, e.total_points
            FROM entries e JOIN users u ON e.user_id = u.id WHERE e.contest_id = $1 ORDER BY e.total_points DESC;
        `, [req.params.id]);
        res.json({ success: true, leaderboard: result.rows, prices: latestMarketData, isLocked: isContestLocked });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch leaderboard.' });
    }
});

// ============================================================================
// 5. PRIZE DISTRIBUTION (MANUAL BACKUP)
// ============================================================================
app.post('/api/contests/:id/payout', async (req, res) => {
    try {
        await pool.query('SELECT distribute_prizes($1)', [req.params.id]);
        res.json({ success: true, message: `Prizes distributed successfully for Contest #${req.params.id}!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 6. ADMIN COMMAND CENTER APIS (SECURED)
// ============================================================================
const ADMIN_SECRET_KEY = "ajeet_admin_secret_99"; 

const requireAdmin = (req, res, next) => {
    const adminHeader = req.headers['x-admin-secret'];
    if (!adminHeader || adminHeader !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ success: false, message: 'Unauthorized access denied.' });
    }
    next();
};

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id, u.phone_number, u.referral_code, u.created_at, COALESCE(w.balance, 0.00) as balance
            FROM users u 
            LEFT JOIN wallets w ON u.id = w.user_id 
            ORDER BY u.id ASC;
        `);
        res.json({ success: true, users: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

app.post('/api/admin/wallet/adjust', requireAdmin, async (req, res) => {
    const { userId, amount, type } = req.body;
    try {
        const operator = type === 'debit' ? '-' : '+';
        const updateWallet = await pool.query(
            `UPDATE wallets SET balance = balance ${operator} $1 WHERE user_id = $2 RETURNING balance;`,
            [Math.abs(amount), userId]
        );
        if (updateWallet.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User wallet not found.' });
        }
        res.json({ success: true, balance: updateWallet.rows[0].balance, message: `Successfully ${type}ed ₹${amount} to User #${userId}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Wallet adjustment failed.' });
    }
});

app.post('/api/admin/contests/create', requireAdmin, async (req, res) => {
    const { name, entryFee } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Contest name is required.' });
    try {
        const newContest = await pool.query(
            `INSERT INTO contests (name, entry_fee, prize_pool, status) VALUES ($1, $2, 0.00, 'active') RETURNING *;`,
            [name, parseFloat(entryFee || 100)]
        );
        res.json({ success: true, contest: newContest.rows[0], message: `Successfully created league: ${name}!` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to create contest.' });
    }
});

app.post('/api/admin/contests/reset', requireAdmin, async (req, res) => {
    const { contestId } = req.body;
    try {
        if (contestId) {
            await pool.query(`DELETE FROM entries WHERE contest_id = $1;`, [contestId]);
            await pool.query(`UPDATE contests SET prize_pool = 0.00 WHERE id = $1;`, [contestId]);
        } else {
            await pool.query(`DELETE FROM entries;`);
            await pool.query(`UPDATE contests SET prize_pool = 0.00;`);
        }
        res.json({ success: true, message: 'Contest squads cleared and prize pool reset for new match!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to reset contest.' });
    }
});

app.post('/api/admin/contests/toggle-lock', requireAdmin, (req, res) => {
    isContestLocked = !isContestLocked;
    console.log(`🔒 [ADMIN ACTION] Contest execution lock status manually flipped to: ${isContestLocked}`);
    res.json({ success: true, isLocked: isContestLocked });
});

// ============================================================================
// 7. REAL LIVE MARKET DATA ENGINE
// ============================================================================
async function updateFantasyScores() {
    if (isMarketSyncing) return;
    isMarketSyncing = true;
    try {
        const entriesResult = await pool.query(`SELECT id, bull_stock, calf_stock, normal_stocks FROM entries;`);
        const entries = entriesResult.rows;

        const allSymbolsSet = new Set(nifty50Symbols.map(s => `${s}.NS`));
        entries.forEach(entry => {
            if (entry.bull_stock) allSymbolsSet.add(`${entry.bull_stock}.NS`);
            if (entry.calf_stock) allSymbolsSet.add(`${entry.calf_stock}.NS`);
            try {
                let normalList = typeof entry.normal_stocks === 'string' ? JSON.parse(entry.normal_stocks) : entry.normal_stocks;
                if (Array.isArray(normalList)) normalList.forEach(s => allSymbolsSet.add(`${s}.NS`));
            } catch(e) {}
        });

        const symbolsArray = Array.from(allSymbolsSet);
        const quotes = await yahooFinance.quote(symbolsArray);
        const tempMarketData = {};

        const processQuote = (q) => {
            if (!q || !q.symbol) return;
            const cleanSymbol = q.symbol.replace('.NS', '');
            const currentPrice = q.regularMarketPrice || 0;
            const openPrice = q.regularMarketOpen || q.regularMarketPreviousClose || currentPrice;
            const pctChange = openPrice ? ((currentPrice - openPrice) / openPrice) * 100 : 0;
            
            tempMarketData[cleanSymbol] = {
                price: currentPrice.toFixed(2),
                change: pctChange.toFixed(2)
            };
        };

        if (Array.isArray(quotes)) { quotes.forEach(processQuote); } 
        else { processQuote(quotes); }

        latestMarketData = tempMarketData;

        for (const entry of entries) {
            const bullChange = parseFloat(latestMarketData[entry.bull_stock]?.change || 0);
            const calfChange = parseFloat(latestMarketData[entry.calf_stock]?.change || 0);
            let normalChangeSum = 0;
            try {
                let normalList = typeof entry.normal_stocks === 'string' ? JSON.parse(entry.normal_stocks) : entry.normal_stocks;
                if (Array.isArray(normalList)) {
                    normalList.forEach(s => { normalChangeSum += parseFloat(latestMarketData[s]?.change || 0); });
                }
            } catch(e) {}

            const finalScore = Math.round(((bullChange * 2) + (calfChange * 1.5) + normalChangeSum) * 10);
            await pool.query(`UPDATE entries SET total_points = $1 WHERE id = $2;`, [finalScore, entry.id]);
        }
        console.log(`📈 [MARKET ENGINE] Sync complete for all active contest entries.`);
    } catch (err) {
        console.error(`❌ [MARKET ERROR]:`, err.message);
    } finally {
        isMarketSyncing = false;
    }
}

setInterval(updateFantasyScores, 30000);
setTimeout(updateFantasyScores, 2000);

// ============================================================================
// 8. CRON AUTOMATED TIMING SCHEDULER
// ============================================================================
cron.schedule('15 9 * * 1-5', async () => {
    isContestLocked = true;
    console.log("🔒 [CRON ENGINE] 09:15 AM reached. Market is OPEN. Entry matrix locked permanently.");
}, { scheduled: true, timezone: "Asia/Kolkata" });

cron.schedule('30 15 * * 1-5', async () => {
    console.log("⏳ [CRON ENGINE] 03:30 PM reached. Market is CLOSED. Initializing final score sync...");
    await updateFantasyScores(); 
    
    try {
        console.log("🏆 [CRON ENGINE] Distributing pool prizes automatically across all active contests...");
        const activeContests = await pool.query(`SELECT id FROM contests WHERE status = 'active';`);
        for (const c of activeContests.rows) {
            await pool.query('SELECT distribute_prizes($1)', [c.id]);
            console.log(`✅ [CRON ENGINE] Automated payout distribution successful for Contest #${c.id}.`);
        }
    } catch (err) {
        console.error("❌ [CRON EXECUTOR CRITICAL FAILURE]:", err.message);
    }
    
    isContestLocked = false; 
    console.log("🔓 [CRON ENGINE] Contest windows reset and unlocked for next match session.");
}, { scheduled: true, timezone: "Asia/Kolkata" });


const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Nifty-7 Multi-Contest Server is LIVE on Port ${PORT}`);
});
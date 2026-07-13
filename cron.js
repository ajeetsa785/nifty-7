const cron = require('node-cron');
const db = require('./db');

console.log("⏰ Nifty-7 Automated Master Clock initialized (IST Timezone)");

// ---------------------------------------------------------
// JOB 1: Lock Contests at 08:55 AM IST Everyday
// ---------------------------------------------------------
cron.schedule('55 8 * * *', async () => {
    console.log("🔒 [08:55 AM] Locking all open contests...");
    try {
        const result = await db.query(`
            UPDATE contests 
            SET status = 'LOCKED' 
            WHERE status = 'OPEN';
        `);
        console.log(`✅ Successfully locked ${result.rowCount} contests.`);
    } catch (err) {
        console.error("❌ Error locking contests:", err.message);
    }
}, { timezone: "Asia/Kolkata" });

// ---------------------------------------------------------
// JOB 2: Split Pool Money (90% Prize, 10% Comm) at 09:00 AM IST
// ---------------------------------------------------------
cron.schedule('0 9 * * *', async () => {
    console.log("💰 [09:00 AM] Calculating 90% prize pools & 10% commissions...");
    try {
        // Set Prize Pool to 90%, Platform Commission to 9%, Referral Pool to 1%
        const result = await db.query(`
            UPDATE contests 
            SET prize_pool = total_pool * 0.90,
                platform_commission = total_pool * 0.09,
                referral_pool = total_pool * 0.01
            WHERE status = 'LOCKED';
        `);
        console.log(`✅ Pool distribution calculated for ${result.rowCount} locked contests.`);
    } catch (err) {
        console.error("❌ Error distributing pool money:", err.message);
    }
}, { timezone: "Asia/Kolkata" });

// ---------------------------------------------------------
// JOB 3: Settle Contests & Pay Winners at 03:45 PM IST
// ---------------------------------------------------------
cron.schedule('45 15 * * *', async () => {
    console.log("🏆 [03:45 PM] Market closed! Calculating final leaderboards and paying winners...");
    try {
        // 1. Get all LOCKED contests
        const contestsRes = await db.query("SELECT id, prize_pool FROM contests WHERE status = 'LOCKED';");
        
        for (let contest of contestsRes.rows) {
            // Fetch leaderboard for this specific contest
            const entriesRes = await db.query(`
                SELECT ce.user_id, b.bull_stock, b.calf_stock, b.stock_3, b.stock_4, b.stock_5, b.stock_6, b.stock_7
                FROM contest_entries ce
                JOIN baskets b ON ce.basket_id = b.id
                WHERE ce.contest_id = $1;
            `, [contest.id]);

            if (entriesRes.rows.length === 0) continue;

            // Fetch current stock prices to calculate points
            const stocksRes = await db.query('SELECT symbol, prev_close_price, current_price FROM stocks;');
            const stockMap = {};
            stocksRes.rows.forEach(s => {
                const prev = Number(s.prev_close_price);
                const curr = Number(s.current_price);
                stockMap[s.symbol] = prev > 0 ? ((curr - prev) / prev) * 10000 : 0;
            });

            // Calculate scores
            const leaderboard = entriesRes.rows.map(entry => {
                let totalPoints = 0;
                const symbols = [entry.bull_stock, entry.calf_stock, entry.stock_3, entry.stock_4, entry.stock_5, entry.stock_6, entry.stock_7];
                symbols.forEach((sym, index) => {
                    let pts = stockMap[sym] || 0;
                    if (index === 0) pts *= 2.0;       // BULL x2
                    else if (index === 1) pts *= 1.5;  // CALF x1.5
                    totalPoints += pts;
                });
                return { user_id: entry.user_id, points: totalPoints };
            });

            // Sort by highest points
            leaderboard.sort((a, b) => b.points - a.points);
            const winner = leaderboard[0]; // Top scorer wins the Mega/1v1 pool!

            if (winner) {
                // Deposit 90% prize pool directly into the winner's wallet
                await db.query('BEGIN');
                await db.query('UPDATE wallets SET balance = balance + $1 WHERE user_id = $2;', [contest.prize_pool, winner.user_id]);
                await db.query("UPDATE contests SET status = 'SETTLED' WHERE id = $1;", [contest.id]);
                await db.query('COMMIT');
                console.log(`🎉 Contest ${contest.id} settled! User ID ${winner.user_id} won ₹${contest.prize_pool}`);
            }
        }
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("❌ Error settling contests:", err.message);
    }
}, { timezone: "Asia/Kolkata" });

module.exports = cron;
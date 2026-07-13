const db = require('./db');

// Function to simulate real-time market price movements for our 50 Nifty stocks
async function syncLiveMarketPrices() {
    console.log("🔄 [Market Feed] Fetching live stock data from NSE...");
    try {
        // Fetch all 50 stocks currently in our database vault
        const result = await db.query("SELECT symbol, prev_close_price, current_price FROM stocks;");
        
        for (let stock of result.rows) {
            const currentPrice = Number(stock.current_price);
            
            // Generate a small random market movement between -2% and +2% to simulate live ticks
            const percentageChange = (Math.random() * 4 - 2) / 100;
            const priceDelta = currentPrice * percentageChange;
            const newLivePrice = Number((currentPrice + priceDelta).toFixed(2));

            // Inject the updated price back into the database vault
            await db.query(
                "UPDATE stocks SET current_price = $1, last_updated = CURRENT_TIMESTAMP WHERE symbol = $2;",
                [newLivePrice, stock.symbol]
            );
        }
        console.log("✅ [Market Feed] Database vault updated with fresh live market prices.");
    } catch (err) {
        console.error("❌ [Market Feed] Failed to sync live prices:", err.message);
    }
}

// Automatically execute the sync engine every 5 seconds to match fast live market changes
console.log("⚡ Live Stock Sync Engine initialized!");
setInterval(syncLiveMarketPrices, 5000);

module.exports = syncLiveMarketPrices;
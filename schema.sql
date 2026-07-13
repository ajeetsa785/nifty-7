-- 1. USERS & REFERRALS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(15) UNIQUE NOT NULL,
    referral_code VARCHAR(10) UNIQUE NOT NULL,
    referred_by_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. WALLETS TABLE (For UPI Deposits, Winnings & Referral Income)
CREATE TABLE IF NOT EXISTS wallets (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    balance DECIMAL(12, 2) DEFAULT 0.00,
    referral_earnings DECIMAL(12, 2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. NIFTY 50 STOCKS TABLE (Tracks Previous Day Close for % Change)
CREATE TABLE IF NOT EXISTS stocks (
    symbol VARCHAR(20) PRIMARY KEY,
    company_name VARCHAR(100) NOT NULL,
    prev_close_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. BASKETS TABLE (Exactly 7 Stocks: 1 Bull [2x], 1 Calf [1.5x], 5 Normal [1x])
CREATE TABLE IF NOT EXISTS baskets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    basket_name VARCHAR(50) NOT NULL,
    bull_stock VARCHAR(20) REFERENCES stocks(symbol),
    calf_stock VARCHAR(20) REFERENCES stocks(symbol),
    stock_3 VARCHAR(20) REFERENCES stocks(symbol),
    stock_4 VARCHAR(20) REFERENCES stocks(symbol),
    stock_5 VARCHAR(20) REFERENCES stocks(symbol),
    stock_6 VARCHAR(20) REFERENCES stocks(symbol),
    stock_7 VARCHAR(20) REFERENCES stocks(symbol),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CONTESTS / LEAGUES TABLE (Mega League ₹100 & 1v1 Leagues)
CREATE TABLE IF NOT EXISTS contests (
    id SERIAL PRIMARY KEY,
    contest_name VARCHAR(100) NOT NULL,
    contest_type VARCHAR(10) CHECK (contest_type IN ('MEGA', '1v1')),
    entry_fee DECIMAL(10, 2) NOT NULL,
    total_pool DECIMAL(12, 2) DEFAULT 0.00,
    platform_commission DECIMAL(12, 2) DEFAULT 0.00, -- Your 10% (minus referrals)
    referral_pool DECIMAL(12, 2) DEFAULT 0.00,        -- 1% to referrers
    prize_pool DECIMAL(12, 2) DEFAULT 0.00,           -- 90% to winners
    entry_deadline TIMESTAMP WITH TIME ZONE NOT NULL, -- 08:55 AM lock
    status VARCHAR(15) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LOCKED', 'SETTLED'))
);

-- 6. CONTEST ENTRIES TABLE (Links Users & Baskets to Leagues)
CREATE TABLE IF NOT EXISTS contest_entries (
    id SERIAL PRIMARY KEY,
    contest_id INTEGER REFERENCES contests(id),
    user_id INTEGER REFERENCES users(id),
    basket_id INTEGER REFERENCES baskets(id),
    current_rank INTEGER DEFAULT 0,
    total_points DECIMAL(10, 2) DEFAULT 0.00,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
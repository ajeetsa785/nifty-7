-- 1. Create a Test User (Phone: 9876543210, Referral Code: NIFTYUSER1)
INSERT INTO users (id, phone_number, referral_code) 
VALUES (1, '9876543210', 'NIFTYUSER1') 
ON CONFLICT (id) DO NOTHING;

-- 2. Give the Test User ₹1,000 in their UPI Wallet
INSERT INTO wallets (user_id, balance) 
VALUES (1, 1000.00) 
ON CONFLICT (user_id) DO UPDATE SET balance = 1000.00;

-- 3. Create an OPEN Mega League Contest with a ₹100 Entry Fee
INSERT INTO contests (id, contest_name, contest_type, entry_fee, entry_deadline, status) 
VALUES (1, 'Nifty Mega League - Daily ₹10,000 Pool', 'MEGA', 100.00, CURRENT_TIMESTAMP + INTERVAL '1 day', 'OPEN')
ON CONFLICT (id) DO UPDATE SET status = 'OPEN', entry_deadline = CURRENT_TIMESTAMP + INTERVAL '1 day';
let selectedStocks = [];
let liveStocksData = {};
let currentUser = null;
let selectedDepositAmount = 100;
const TEST_CONTEST_ID = 1;
let isInitialRender = true;

// 1. AUTHENTICATION LOGIC
async function handleAuth() {
    const phoneInput = document.getElementById('phone-input');
    const otpInput = document.getElementById('otp-input');
    const authBtn = document.getElementById('auth-btn');
    const subtext = document.getElementById('login-subtext');

    if (otpInput.style.display === 'none') {
        // Step 1: Request OTP
        if (phoneInput.value.length !== 10) {
            alert('Please enter a valid 10-digit mobile number.');
            return;
        }
        authBtn.innerText = 'Sending OTP...';
        authBtn.disabled = true;

        try {
            const res = await fetch('/api/auth/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone_number: phoneInput.value })
            });
            const data = await res.json();

            if (data.success) {
                otpInput.style.display = 'block';
                phoneInput.disabled = true;
                subtext.innerText = 'Enter the 6-digit OTP printed in your server terminal.';
                authBtn.innerText = 'Verify & Login';
                authBtn.disabled = false;
            } else {
                alert(data.error);
                authBtn.disabled = false;
                authBtn.innerText = 'Get OTP';
            }
        } catch (err) {
            alert('Error connecting to server.');
            authBtn.disabled = false;
            authBtn.innerText = 'Get OTP';
        }
    } else {
        // Step 2: Verify OTP
        if (otpInput.value.length !== 6) {
            alert('Please enter a valid 6-digit OTP.');
            return;
        }
        authBtn.innerText = 'Verifying...';
        authBtn.disabled = true;

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone_number: phoneInput.value, otp: otpInput.value })
            });
            const data = await res.json();

            if (data.success) {
                currentUser = data.user;
                document.getElementById('wallet-balance').innerText = currentUser.wallet_balance.toFixed(2);
                document.getElementById('login-modal').style.display = 'none';
                alert(`${data.message}\nWelcome to Nifty-7! Click the Wallet button top-right to add test funds via UPI.`);
            } else {
                alert(data.error);
                authBtn.disabled = false;
                authBtn.innerText = 'Verify & Login';
            }
        } catch (err) {
            alert('Verification failed.');
            authBtn.disabled = false;
            authBtn.innerText = 'Verify & Login';
        }
    }
}

// 2. UPI DEPOSIT MODAL LOGIC
function openDepositModal() {
    if (!currentUser) { alert('Please log in first!'); return; }
    document.getElementById('deposit-modal').style.display = 'flex';
}

function closeDepositModal() {
    document.getElementById('deposit-modal').style.display = 'none';
}

function selectAmount(amount, chipEl) {
    selectedDepositAmount = amount;
    document.querySelectorAll('.amount-chip').forEach(el => el.classList.remove('active'));
    chipEl.classList.add('active');
    document.getElementById('deposit-btn').innerText = `Pay ₹${amount} via UPI`;
}

async function processDeposit() {
    const btn = document.getElementById('deposit-btn');
    btn.innerText = 'Opening UPI App...';
    btn.disabled = true;

    try {
        const res = await fetch('/api/wallets/deposit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, amount: selectedDepositAmount })
        });
        const data = await res.json();

        if (data.success) {
            currentUser.wallet_balance = data.new_balance;
            document.getElementById('wallet-balance').innerText = data.new_balance.toFixed(2);
            closeDepositModal();
            alert(`🎉 Successfully added ₹${selectedDepositAmount} via UPI!`);
        } else {
            alert('Deposit failed: ' + data.error);
        }
    } catch (err) {
        alert('Transaction error.');
    } finally {
        btn.disabled = false;
        btn.innerText = `Pay ₹${selectedDepositAmount} via UPI`;
    }
}

// 3. TAB SWITCHING
function switchTab(tab) {
    document.getElementById('tab-market').className = tab === 'market' ? 'tab-btn active' : 'tab-btn';
    document.getElementById('tab-leaderboard').className = tab === 'leaderboard' ? 'tab-btn active' : 'tab-btn';
    
    document.getElementById('view-market').style.display = tab === 'market' ? 'block' : 'none';
    document.getElementById('view-leaderboard').style.display = tab === 'leaderboard' ? 'block' : 'none';
    document.getElementById('bottom-bar').style.display = tab === 'market' ? 'flex' : 'none';

    if (tab === 'leaderboard') { loadLeaderboard(); }
}

// 4. LIVE MARKET FEED
async function loadLiveMarketFeed() {
    try {
        const response = await fetch('/api/stocks');
        const data = await response.json();

        if (data.success) {
            const container = document.getElementById('stock-container');
            if (isInitialRender) { container.innerHTML = ''; isInitialRender = false; }
            data.stocks.forEach(stock => {
                liveStocksData[stock.symbol] = stock;
                updateOrCreateStockCard(stock);
            });
        }
    } catch (err) { console.error("Error loading stocks:", err); }
}

function updateOrCreateStockCard(stock) {
    const container = document.getElementById('stock-container');
    const prev = Number(stock.prev_close_price);
    const curr = Number(stock.current_price);
    const change = curr - prev;
    const percentChange = prev > 0 ? ((change / prev) * 100).toFixed(2) : '0.00';
    const changeClass = change >= 0 ? 'up' : 'down';
    const sign = change >= 0 ? '+' : '';

    let card = document.getElementById(`card-${stock.symbol}`);
    if (!card) {
        card = document.createElement('div');
        card.id = `card-${stock.symbol}`;
        card.className = 'stock-card';
        card.onclick = () => toggleStockSelection(stock.symbol);
        const avatarText = stock.symbol.substring(0, 2);
        
        card.innerHTML = `
            <div class="stock-left">
                <div class="stock-avatar">${avatarText}</div>
                <div class="stock-name">
                    <h4><span class="symbol-text">${stock.symbol}</span> <span class="badge-slot"></span></h4>
                    <span>${stock.company_name}</span>
                </div>
            </div>
            <div class="stock-right">
                <div class="price" id="price-${stock.symbol}">₹${curr.toFixed(2)}</div>
                <div class="change ${changeClass}" id="change-${stock.symbol}">${sign}${percentChange}%</div>
            </div>
        `;
        container.appendChild(card);
    } else {
        const priceEl = document.getElementById(`price-${stock.symbol}`);
        const changeEl = document.getElementById(`change-${stock.symbol}`);
        if (priceEl && changeEl) {
            priceEl.innerText = `₹${curr.toFixed(2)}`;
            changeEl.innerText = `${sign}${percentChange}%`;
            changeEl.className = `change ${changeClass}`;
        }
    }
    applySelectionStyles(stock.symbol);
}

function toggleStockSelection(symbol) {
    if (!currentUser) { alert('Please log in first!'); return; }
    const index = selectedStocks.indexOf(symbol);
    if (index > -1) {
        selectedStocks.splice(index, 1);
    } else {
        if (selectedStocks.length < 7) {
            selectedStocks.push(symbol);
        } else {
            alert("Your squad is full! Deselect a stock to add another.");
            return;
        }
    }
    Object.keys(liveStocksData).forEach(sym => applySelectionStyles(sym));
    updateBottomBar();
}

function applySelectionStyles(symbol) {
    const card = document.getElementById(`card-${symbol}`);
    if (!card) return;
    const badgeSlot = card.querySelector('.badge-slot');
    const selIndex = selectedStocks.indexOf(symbol);
    card.classList.remove('selected-bull', 'selected-calf', 'selected-normal');

    if (selIndex === 0) {
        card.classList.add('selected-bull');
        badgeSlot.innerHTML = `<span class="role-badge badge-bull">👑 BULL (2X)</span>`;
    } else if (selIndex === 1) {
        card.classList.add('selected-calf');
        badgeSlot.innerHTML = `<span class="role-badge badge-calf">🚀 CALF (1.5X)</span>`;
    } else if (selIndex > 1) {
        card.classList.add('selected-normal');
        badgeSlot.innerHTML = `<span class="role-badge badge-norm">✅ IN SQUAD</span>`;
    } else {
        badgeSlot.innerHTML = '';
    }
}

function updateBottomBar() {
    const count = selectedStocks.length;
    document.getElementById('selection-status').innerText = `${count} / 7`;
    document.getElementById('tab-market').innerText = `1. Build Squad (${count}/7)`;
    const btnEl = document.getElementById('join-btn');
    if (count === 7) {
        btnEl.disabled = false;
        btnEl.innerText = "🚀 Enter Mega League (₹100)";
    } else {
        btnEl.disabled = true;
        btnEl.innerText = `Pick ${7 - count} more stock${7 - count === 1 ? '' : 's'} to enter`;
    }
}

// 5. SUBMIT & JOIN CONTEST
async function submitBasketAndJoin() {
    if (!currentUser) { alert('Please log in first!'); return; }
    if (currentUser.wallet_balance < 100) {
        alert('Insufficient funds! Please click the Wallet button top-right to add ₹100 via UPI.');
        openDepositModal();
        return;
    }

    const btnEl = document.getElementById('join-btn');
    btnEl.disabled = true;
    btnEl.innerText = "Joining League...";

    const bull = selectedStocks[0];
    const calf = selectedStocks[1];
    const others = selectedStocks.slice(2, 7);

    try {
        const basketRes = await fetch('/api/baskets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                basket_name: `Squad (${currentUser.phone_number.slice(-4)})`,
                bull_stock: bull,
                calf_stock: calf,
                other_stocks: others
            })
        });
        const basketData = await basketRes.json();

        if (!basketData.success) {
            alert("Error: " + basketData.error);
            btnEl.disabled = false;
            return;
        }

        const joinRes = await fetch('/api/contests/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                contest_id: TEST_CONTEST_ID,
                basket_id: basketData.basket.id
            })
        });
        const joinData = await joinRes.json();

        if (joinData.success) {
            currentUser.wallet_balance -= 100;
            document.getElementById('wallet-balance').innerText = currentUser.wallet_balance.toFixed(2);
            alert("🎉 Squad Entered! ₹100 deducted. Switching to Live Leaderboard.");
            switchTab('leaderboard');
        } else {
            alert("Failed to join: " + joinData.error);
            btnEl.disabled = false;
        }
    } catch (err) {
        console.error("Transaction Error:", err);
        alert("Something went wrong.");
        btnEl.disabled = false;
    }
}

// 6. LEADERBOARD
async function loadLeaderboard() {
    try {
        const response = await fetch(`/api/contests/${TEST_CONTEST_ID}/leaderboard`);
        const data = await response.json();
        const container = document.getElementById('leaderboard-container');
        container.innerHTML = '';

        if (data.success && data.leaderboard.length > 0) {
            data.leaderboard.forEach(player => {
                const card = document.createElement('div');
                card.className = 'rank-card';
                card.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 14px;">
                        <div class="rank-number">#${player.rank}</div>
                        <div>
                            <h4 style="font-size: 1rem; font-weight: 800; color: #fff;">📱 ${player.phone_number}</h4>
                            <span style="font-size: 0.75rem; color: var(--text-sub); font-weight: 600;">${player.basket_name}</span>
                        </div>
                    </div>
                    <div style="text-align: right; font-weight: 900; font-size: 1.15rem; color: var(--accent-green);">
                        ${player.points} <span style="font-size: 0.7rem; color: var(--text-sub); font-weight: 700;">PTS</span>
                    </div>
                `;
                container.appendChild(card);
            });
        } else {
            container.innerHTML = `<p style="color: var(--text-sub); text-align: center; padding: 40px 0; font-weight: 600;">No players yet. Be the first to join!</p>`;
        }
    } catch (err) { console.error("Leaderboard Error:", err); }
}

loadLiveMarketFeed();
setInterval(() => {
    loadLiveMarketFeed();
    if (document.getElementById('view-leaderboard').style.display === 'block') {
        loadLeaderboard();
    }
}, 3000);
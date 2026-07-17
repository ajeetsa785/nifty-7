require('dotenv').config();
const express = require('express');
const path = require('path');
const http = require('http');

const persist = require('./persist');
const market = require('./market');
const arena = require('./arena');

const { router: authRouter, authOptional } = require('./routes/auth');
const contestsRouter = require('./routes/contests');
const paymentsRouter = require('./routes/payments');
const adminRouter = require('./routes/admin');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 0 }));
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('X-Powered-By', 'Nifty-7');
  next();
});

app.use('/api/auth', authRouter);
app.use('/api/contests', contestsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/admin', adminRouter);
app.use(authOptional);

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    store: persist.state.mode,
    market: market.getSource(),
    users: Object.keys(persist.state.users).length,
    contests: Object.keys(persist.state.contests).length
  });
});

async function boot() {
  await persist.init();
  await arena.seedFakeArena(persist);
  arena.startFakeJoinTicker(persist);
  market.startMarketEngine();
  server.listen(PORT, () => {
    console.log(`🚀 NIFTY-7 → http://localhost:${PORT}`);
    console.log(`Store mode: ${persist.state.mode}`);
    console.log(`Market: ${market.getSource()}`);
  });
}

boot().catch((err) => { console.error('Fatal boot error:', err); process.exit(1); });

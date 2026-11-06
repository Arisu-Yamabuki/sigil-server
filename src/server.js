const http = require('http');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { port, corsOrigin } = require('./config');
const { connectDb } = require('./db');
const { initRealtime } = require('./realtime');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const blockRoutes = require('./routes/blocks');
const callRoutes = require('./routes/calls');
const pushRoutes = require('./routes/push');
const { initSignaling } = require('./signaling');
const push = require('./push');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
    },
  },
}));
app.use(cors({ origin: corsOrigin === '*' ? true : corsOrigin.split(','), credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get('/health', (req, res) => res.json({ ok: true, name: 'sigil' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/blocks', blockRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/push', pushRoutes);

app.get('/privacy', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'privacy.html')));
app.get('/call', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'call.html')));
app.use('/vendor', express.static(path.join(__dirname, '..', 'node_modules', 'openpgp', 'dist')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('[sigil] error:', err.message);
  res.status(500).json({ error: 'Server error' });
});

(async () => {
  await connectDb();
  push.init();
  if (!require('./config').turnSecret) {
    console.warn('[sigil] calls: TURN_SECRET is not set. Calls will fail between most networks.');
  }
  const server = http.createServer(app);
  initRealtime(server);
  initSignaling(server);
  server.listen(port, () => console.log(`[sigil] listening on :${port}`));
})().catch((err) => {
  console.error('[sigil] failed to start:', err.message);
  process.exit(1);
});

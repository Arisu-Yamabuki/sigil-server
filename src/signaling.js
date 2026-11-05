const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Block = require('./models/Block');
const PendingCall = require('./models/PendingCall');
const push = require('./push');
const { jwtSecret } = require('./config');

// Relays call setup. Payloads are PGP ciphertext made on the sender's phone.
// The server reads only routing fields (to, callId, kind) and never decrypts anything.
const MAX_FRAME_BYTES = 64 * 1024;
const MAX_BODY_CHARS = 32 * 1024;
const RATE_WINDOW_MS = 10 * 1000;
const RATE_MAX = 30;
const AUTH_TIMEOUT_MS = 5000;
const PENDING_TTL_MS = 60 * 1000;
const KINDS = new Set(['offer', 'answer', 'ice', 'hangup', 'busy']);

const sockets = new Map(); // userId -> Set<WebSocket>

function track(userId, ws) {
  if (!sockets.has(userId)) sockets.set(userId, new Set());
  sockets.get(userId).add(ws);
}

function untrack(userId, ws) {
  const set = sockets.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) sockets.delete(userId);
}

// Deliver offers that arrived while this user's phone was asleep.
async function deliverPending(userId, ws) {
  const rows = await PendingCall.find({ to: userId, expiresAt: { $gt: new Date() } }).lean();
  if (rows.length) await PendingCall.deleteMany({ _id: { $in: rows.map((r) => r._id) } });
  for (const r of rows) {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({ type: 'call', kind: 'offer', from: r.from, callId: r.callId, video: r.video, body: r.body }));
  }
}

function initSignaling(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_FRAME_BYTES });

  server.on('upgrade', (req, socket, head) => {
    if (!req.url || req.url.split('?')[0] !== '/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });

  wss.on('connection', (ws) => {
    let userId = null;
    let username = null;
    let windowStart = Date.now();
    let count = 0;

    // Authenticate with the first message, not the URL, so tokens never reach access logs.
    const authTimer = setTimeout(() => ws.close(4001, 'auth timeout'), AUTH_TIMEOUT_MS);

    ws.on('message', async (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;

      if (!userId) {
        if (msg.type !== 'auth' || typeof msg.token !== 'string') return ws.close(4001, 'auth required');
        try {
          const payload = jwt.verify(msg.token, jwtSecret, { algorithms: ['HS256'] });
          userId = String(payload.sub);
          username = payload.username;
        } catch {
          return ws.close(4001, 'bad token');
        }
        clearTimeout(authTimer);
        track(userId, ws);
        ws.send(JSON.stringify({ type: 'ready' }));
        deliverPending(userId, ws).catch(() => {});
        return;
      }

      const now = Date.now();
      if (now - windowStart > RATE_WINDOW_MS) {
        windowStart = now;
        count = 0;
      }
      if (++count > RATE_MAX) return;

      if (msg.type !== 'call') return;
      if (!KINDS.has(msg.kind)) return;
      if (typeof msg.to !== 'string' || !/^[a-z0-9_]{3,24}$/.test(msg.to)) return;
      if (typeof msg.callId !== 'string' || msg.callId.length === 0 || msg.callId.length > 64) return;
      if (typeof msg.body !== 'string' || msg.body.length > MAX_BODY_CHARS) return;

      const target = await User.findOne({ username: msg.to }).select('_id fcmTokens').lean();
      // Blocked, unknown, and offline all look the same to the sender.
      const unavailable = () =>
        ws.send(JSON.stringify({ type: 'error', code: 'unavailable', callId: msg.callId }));
      if (!target || String(target._id) === userId) return unavailable();

      const blocked = await Block.exists({
        $or: [
          { blocker: target._id, blocked: userId },
          { blocker: userId, blocked: target._id },
        ],
      });
      if (blocked) return unavailable();

      const targets = sockets.get(String(target._id));
      if (!targets || targets.size === 0) {
        // Recipient is asleep: queue an offer and send a push. Other signals are dropped quietly.
        if (msg.kind === 'offer') {
          const tokens = target.fcmTokens || [];
          if (!push.enabled() || tokens.length === 0) return unavailable();
          await PendingCall.create({
            to: target._id,
            from: username,
            callId: msg.callId,
            video: msg.video === true,
            body: msg.body,
            expiresAt: new Date(Date.now() + PENDING_TTL_MS),
          });
          await push.notifyIncomingCall(tokens, {
            type: 'call',
            from: username,
            callId: msg.callId,
            video: msg.video === true ? '1' : '0',
          }).catch(() => {});
          return;
        }
        if (msg.kind === 'hangup') {
          await PendingCall.deleteMany({ to: target._id, from: username, callId: msg.callId });
        }
        return;
      }

      const out = JSON.stringify({
        type: 'call',
        kind: msg.kind,
        from: username,
        callId: msg.callId,
        video: msg.video === true,
        body: msg.body,
      });
      for (const s of targets) s.send(out);
    });

    ws.on('close', () => {
      clearTimeout(authTimer);
      if (userId) untrack(userId, ws);
    });
    ws.on('error', () => {});
  });

  return wss;
}

module.exports = { initSignaling };

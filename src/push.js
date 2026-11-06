const User = require('./models/User');

// Firebase Cloud Messaging. Disabled unless FIREBASE_SERVICE_ACCOUNT points to the
// service-account JSON file. Push payloads carry routing data only, never call contents.
let messaging = null;

function init() {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!path) {
    console.log('[sigil] push disabled: FIREBASE_SERVICE_ACCOUNT is not set');
    return;
  }
  try {
    const admin = require('firebase-admin');
    admin.initializeApp({ credential: admin.credential.cert(require(path)) });
    messaging = admin.messaging();
    console.log('[sigil] push enabled');
  } catch (err) {
    console.error('[sigil] push init failed:', err.message);
  }
}

function enabled() {
  return messaging !== null;
}

// Sends a data message to each token. Returns how many arrived and any error codes.
async function sendData(tokens, data) {
  if (!messaging || tokens.length === 0) return { delivered: 0, errors: [] };
  const res = await messaging.sendEachForMulticast({
    tokens,
    data,
    android: { priority: 'high', ttl: 60 * 1000 },
  });
  const dead = [];
  const errors = new Set();
  res.responses.forEach((r, i) => {
    if (r.success) return;
    const code = (r.error && r.error.code) || 'unknown';
    errors.add(code);
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
      dead.push(tokens[i]);
    }
  });
  // Forget tokens the device no longer uses.
  if (dead.length) await User.updateMany({ fcmTokens: { $in: dead } }, { $pull: { fcmTokens: { $in: dead } } });
  return { delivered: res.successCount, errors: [...errors] };
}

async function notifyIncomingCall(tokens, data) {
  const r = await sendData(tokens, data);
  return r.delivered > 0;
}

module.exports = { init, enabled, sendData, notifyIncomingCall };

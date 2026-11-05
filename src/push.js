const User = require('./models/User');

// Firebase Cloud Messaging for incoming calls. Disabled unless FIREBASE_SERVICE_ACCOUNT points
// to a service-account JSON file. Push payloads carry routing data only, never call contents.
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

async function notifyIncomingCall(tokens, data) {
  if (!messaging || tokens.length === 0) return false;
  const res = await messaging.sendEachForMulticast({
    tokens,
    data,
    android: { priority: 'high', ttl: 60 * 1000 },
  });
  // Forget tokens the device no longer uses.
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')) {
      dead.push(tokens[i]);
    }
  });
  if (dead.length) await User.updateMany({ fcmTokens: { $in: dead } }, { $pull: { fcmTokens: { $in: dead } } });
  return res.successCount > 0;
}

module.exports = { init, enabled, notifyIncomingCall };

const express = require('express');
const User = require('../models/User');
const push = require('../push');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Is Firebase configured on the server? Shows nothing secret.
router.get('/status', (req, res) => {
  res.json({ enabled: push.enabled() });
});

// Sends a test push to your own registered phones. Use it to check Firebase end to end.
router.post('/test', requireAuth, async (req, res) => {
  if (!push.enabled()) {
    return res.status(503).json({ error: 'Push is not configured: FIREBASE_SERVICE_ACCOUNT is missing or invalid' });
  }
  const u = await User.findById(req.userId).select('+fcmTokens').lean();
  const tokens = (u && u.fcmTokens) || [];
  if (tokens.length === 0) {
    return res.status(404).json({ error: 'No phone is registered. Open the Sigil app while signed in, wait 10 seconds, then try again.' });
  }
  const result = await push.sendData(tokens, {
    type: 'test',
    text: 'Firebase push works. Calls will ring with the app closed.',
  });
  res.json({ devices: tokens.length, delivered: result.delivered, errors: result.errors });
});

module.exports = router;

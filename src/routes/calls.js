const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { turnSecret, turnUrls, stunUrls } = require('../config');

const router = express.Router();
const TTL_SECONDS = 3600;

// Short-lived TURN credentials (TURN REST API). The shared secret never leaves the server.
router.get('/ice', requireAuth, (req, res) => {
  const iceServers = [{ urls: stunUrls }];
  if (turnSecret && turnUrls.length) {
    const username = `${Math.floor(Date.now() / 1000) + TTL_SECONDS}:${req.userId}`;
    const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');
    iceServers.push({ urls: turnUrls, username, credential });
  }
  res.set('Cache-Control', 'no-store').json({ iceServers, ttl: TTL_SECONDS });
});

module.exports = router;

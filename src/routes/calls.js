const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { turnSecret, turnUrls, stunUrls, cfTurnKeyId, cfTurnApiToken, meteredApp, meteredKey } = require('../config');

const router = express.Router();
const TTL = 3600;
let cfCache = { at: 0, servers: null };
let meteredCache = { at: 0, servers: null };

// Metered returns ready-to-use TURN servers (free tier available at metered.ca).
async function meteredIceServers() {
  if (meteredCache.servers && Date.now() - meteredCache.at < (TTL - 600) * 1000) return meteredCache.servers;
  const r = await fetch(`https://${meteredApp}.metered.live/api/v1/turn/credentials?apiKey=${meteredKey}`);
  if (!r.ok) throw new Error(`Metered returned ${r.status}`);
  const servers = await r.json();
  meteredCache = { at: Date.now(), servers };
  return servers;
}

// Cloudflare issues relay credentials that expire after `ttl` seconds.
// Cached for most of their lifetime so each call does not hit the API.
async function cloudflareIceServers() {
  if (cfCache.servers && Date.now() - cfCache.at < (TTL - 600) * 1000) return cfCache.servers;
  const r = await fetch(
    `https://rtc.live.cloudflare.com/v1/turn/keys/${cfTurnKeyId}/credentials/generate-ice-servers`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfTurnApiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: TTL }),
    }
  );
  if (!r.ok) throw new Error(`Cloudflare TURN returned ${r.status}`);
  const body = await r.json();
  cfCache = { at: Date.now(), servers: body.iceServers };
  return cfCache.servers;
}

router.get('/ice', requireAuth, async (req, res) => {
  try {
    if (meteredApp && meteredKey) {
      const iceServers = await meteredIceServers();
      return res.set('Cache-Control', 'no-store').json({ iceServers, ttl: TTL });
    }

    if (cfTurnKeyId && cfTurnApiToken) {
      const iceServers = await cloudflareIceServers();
      return res.set('Cache-Control', 'no-store').json({ iceServers, ttl: TTL });
    }

    // Fallback: a self-hosted coturn, if one is configured.
    const iceServers = [{ urls: stunUrls }];
    if (turnSecret && turnUrls.length) {
      const username = `${Math.floor(Date.now() / 1000) + TTL}:${req.userId}`;
      const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');
      iceServers.push({ urls: turnUrls, username, credential });
    }
    res.set('Cache-Control', 'no-store').json({ iceServers, ttl: TTL });
  } catch (err) {
    console.error('[sigil] ice:', err.message);
    res.status(502).json({ error: 'Calling service is temporarily unavailable' });
  }
});

module.exports = router;

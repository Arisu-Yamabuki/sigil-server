const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Search by username prefix. Returns username only, never a picture.
router.get('/search', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
  if (q.length < 2) return res.json({ results: [] });
  const users = await User.find({ username: new RegExp('^' + q) })
    .select('username publicKey')
    .limit(20)
    .lean();
  res.json({
    results: users.map((u) => ({ username: u.username, hasPublicKey: !!u.publicKey })),
  });
});

// Only the public key is ever returned. The client loads it in the background.
router.get('/:username/public-key', requireAuth, async (req, res) => {
  const user = await User.findOne({ username: req.params.username.toLowerCase() })
    .select('username publicKey fingerprint')
    .lean();
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.publicKey) return res.status(404).json({ error: 'This user has no key yet' });
  res.json({ username: user.username, publicKey: user.publicKey, fingerprint: user.fingerprint });
});

// Upload or replace your own public key.
router.put('/me/public-key', requireAuth, async (req, res) => {
  const armored = String(req.body.publicKey || '');
  const fingerprint = String(req.body.fingerprint || '').toUpperCase().replace(/\s+/g, '');
  if (!armored.startsWith('-----BEGIN PGP PUBLIC KEY BLOCK-----')) {
    return res.status(400).json({ error: 'Not an armored PGP public key' });
  }
  if (armored.length > 20000) return res.status(413).json({ error: 'Key too large' });
  if (!/^[A-F0-9]{40}$/.test(fingerprint)) {
    return res.status(400).json({ error: 'Fingerprint must be 40 hex characters' });
  }
  await User.updateOne({ _id: req.userId }, { $set: { publicKey: armored, fingerprint } });
  res.json({ ok: true });
});

module.exports = router;

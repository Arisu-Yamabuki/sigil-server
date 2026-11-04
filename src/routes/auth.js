const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const { jwtSecret, jwtExpiresIn } = require('../config');

const router = express.Router();
const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

function issueToken(user) {
  return jwt.sign({ sub: String(user._id), username: user.username }, jwtSecret, {
    algorithm: 'HS256',
    expiresIn: jwtExpiresIn,
  });
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Username: 3-24 chars, a-z, 0-9, underscore' });
    }
    if (password.length < 8 || password.length > 256) {
      return res.status(400).json({ error: 'Password must be 8 to 256 characters' });
    }
    if (await User.exists({ username })) {
      return res.status(409).json({ error: 'Username taken' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ username, passwordHash });
    res.status(201).json({ token: issueToken(user), user: { id: user._id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const username = String(req.body.username || '').toLowerCase().trim();
    const password = String(req.body.password || '');
    const user = await User.findOne({ username }).select('+passwordHash');
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Wrong username or password' });
    res.json({
      token: issueToken(user),
      user: { id: user._id, username: user.username, hasPublicKey: !!user.publicKey },
    });
  } catch {
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;

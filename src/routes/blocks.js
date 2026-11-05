const express = require('express');
const User = require('../models/User');
const Block = require('../models/Block');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const rows = await Block.find({ blocker: req.userId }).lean();
  const users = await User.find({ _id: { $in: rows.map((r) => r.blocked) } }).select('username').lean();
  res.json({ blocked: users.map((u) => u.username) });
});

router.post('/:username', requireAuth, async (req, res) => {
  const target = await User.findOne({ username: String(req.params.username).toLowerCase() }).select('_id').lean();
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (String(target._id) === req.userId) return res.status(400).json({ error: 'You cannot block yourself' });
  await Block.updateOne(
    { blocker: req.userId, blocked: target._id },
    { $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  res.json({ ok: true });
});

router.delete('/:username', requireAuth, async (req, res) => {
  const target = await User.findOne({ username: String(req.params.username).toLowerCase() }).select('_id').lean();
  if (target) await Block.deleteOne({ blocker: req.userId, blocked: target._id });
  res.json({ ok: true });
});

module.exports = router;

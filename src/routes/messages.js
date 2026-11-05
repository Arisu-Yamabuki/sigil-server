const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Block = require('../models/Block');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { maxCiphertextBytes, maxTimerSeconds } = require('../config');
const { emitToUser } = require('../realtime');

const router = express.Router();

function pairKey(a, b) {
  return [String(a), String(b)].sort().join(':');
}

function isPgpMessage(s) {
  return typeof s === 'string' && s.startsWith('-----BEGIN PGP MESSAGE-----');
}

function validTtl(v) {
  return Number.isInteger(v) && v >= 0 && v <= maxTimerSeconds;
}

// Read the chat-wide timer.
router.get('/conversation/:username/timer', requireAuth, async (req, res) => {
  const other = await User.findOne({ username: req.params.username.toLowerCase() }).select('_id').lean();
  if (!other) return res.status(404).json({ error: 'User not found' });
  const conv = await Conversation.findOne({ pairKey: pairKey(req.userId, other._id) }).lean();
  res.json({ ttlSeconds: conv?.ttlSeconds || 0, timerSetAt: conv?.timerSetAt || null });
});

// Set the chat-wide timer. Applies only to messages sent after this moment.
router.put('/conversation/:username/timer', requireAuth, async (req, res) => {
  const ttl = Number(req.body.ttlSeconds);
  if (!validTtl(ttl)) return res.status(400).json({ error: 'ttlSeconds must be an integer 0 to ' + maxTimerSeconds });
  const other = await User.findOne({ username: req.params.username.toLowerCase() }).select('_id').lean();
  if (!other) return res.status(404).json({ error: 'User not found' });
  const conv = await Conversation.findOneAndUpdate(
    { pairKey: pairKey(req.userId, other._id) },
    { $set: { ttlSeconds: ttl, timerSetAt: new Date(), timerSetBy: req.userId } },
    { upsert: true, new: true }
  ).lean();
  emitToUser(String(other._id), 'timer:changed', { from: req.username, ttlSeconds: conv.ttlSeconds });
  res.json({ ttlSeconds: conv.ttlSeconds, timerSetAt: conv.timerSetAt });
});

// Inbox: one row per person you have talked to, newest first.
router.get('/inbox', requireAuth, async (req, res) => {
  const me = new mongoose.Types.ObjectId(req.userId);
  const rows = await Message.aggregate([
    { $match: { $or: [{ from: me }, { to: me }] } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: { $cond: [{ $eq: ['$from', me] }, '$to', '$from'] },
        lastAt: { $first: '$createdAt' },
        lastBody: { $first: '$body' },
        lastFromMe: { $first: { $eq: ['$from', me] } },
        count: { $sum: 1 },
      },
    },
    { $sort: { lastAt: -1 } },
    { $limit: 100 },
  ]);
  const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('username').lean();
  const names = new Map(users.map((u) => [String(u._id), u.username]));
  const hidden = new Set(
    (await Block.find({ $or: [{ blocker: me }, { blocked: me }] }).lean()).map((b) =>
      String(b.blocker) === String(me) ? String(b.blocked) : String(b.blocker)
    )
  );
  res.json({
    conversations: rows
      .filter((r) => names.has(String(r._id)) && !hidden.has(String(r._id)))
      .map((r) => ({
        username: names.get(String(r._id)),
        lastAt: r.lastAt,
        lastBody: r.lastBody,
        lastFromMe: r.lastFromMe,
        count: r.count,
      })),
  });
});

// Fetch ciphertext for one conversation. The server cannot read it.
router.get('/with/:username', requireAuth, async (req, res) => {
  const other = await User.findOne({ username: req.params.username.toLowerCase() }).select('_id').lean();
  if (!other) return res.status(404).json({ error: 'User not found' });
  const messages = await Message.find({
    $or: [
      { from: req.userId, to: other._id },
      { from: other._id, to: req.userId },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json({
    messages: messages.reverse().map((m) => ({
      id: m._id,
      mine: String(m.from) === String(req.userId),
      body: m.body,
      createdAt: m.createdAt,
      expiresAt: m.expiresAt,
      edited: !!m.editedAt,
    })),
  });
});

// Send ciphertext. A per-message timer can be given; otherwise the chat timer applies.
router.post('/', requireAuth, async (req, res) => {
  const to = String(req.body.to || '').toLowerCase();
  const body = req.body.body;
  if (!isPgpMessage(body)) return res.status(400).json({ error: 'Body must be a PGP armored message' });
  if (Buffer.byteLength(body, 'utf8') > maxCiphertextBytes) {
    return res.status(413).json({ error: 'Message too large' });
  }
  const recipient = await User.findOne({ username: to }).select('_id fingerprint').lean();
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
  const blocked = await Block.exists({
    $or: [
      { blocker: recipient._id, blocked: req.userId },
      { blocker: req.userId, blocked: recipient._id },
    ],
  });
  if (blocked) return res.status(403).json({ error: 'You cannot message this user' });

  const now = Date.now();
  let ttl = 0;
  if (req.body.messageTtlSeconds !== undefined) {
    ttl = Number(req.body.messageTtlSeconds);
  } else {
    const conv = await Conversation.findOne({ pairKey: pairKey(req.userId, recipient._id) }).lean();
    if (conv && conv.ttlSeconds > 0) ttl = conv.ttlSeconds;
  }
  if (!validTtl(ttl)) return res.status(400).json({ error: 'Invalid timer' });

  const msg = await Message.create({
    from: req.userId,
    to: recipient._id,
    body,
    recipientFingerprint: req.body.recipientFingerprint || recipient.fingerprint || null,
    createdAt: new Date(now),
    expiresAt: ttl > 0 ? new Date(now + ttl * 1000) : null,
  });

  emitToUser(String(recipient._id), 'message:new', {
    id: msg._id,
    from: req.username,
    body: msg.body,
    createdAt: msg.createdAt,
    expiresAt: msg.expiresAt,
  });

  res.status(201).json({ id: msg._id, expiresAt: msg.expiresAt });
});

// The sender can replace the ciphertext of a message they sent. The recipient sees it on refresh.
router.put('/:id', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const body = req.body.body;
  if (!isPgpMessage(body)) return res.status(400).json({ error: 'Body must be a PGP armored message' });
  if (Buffer.byteLength(body, 'utf8') > maxCiphertextBytes) {
    return res.status(413).json({ error: 'Message too large' });
  }
  const msg = await Message.findOneAndUpdate(
    { _id: req.params.id, from: req.userId },
    { $set: { body, editedAt: new Date() } },
    { new: true }
  ).lean();
  if (!msg) return res.status(404).json({ error: 'Not found' });
  emitToUser(String(msg.to), 'message:updated', { id: msg._id });
  res.json({ ok: true, editedAt: msg.editedAt });
});

// The sender can delete a message they sent.
router.delete('/:id', requireAuth, async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
  const result = await Message.deleteOne({ _id: req.params.id, from: req.userId });
  if (result.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;

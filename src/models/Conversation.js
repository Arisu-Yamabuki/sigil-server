const mongoose = require('mongoose');

// One document per pair of users. Stores the chat-wide timer.
// The timer only affects messages created AFTER timerSetAt. Older messages are untouched.
const conversationSchema = new mongoose.Schema(
  {
    pairKey: { type: String, required: true, unique: true }, // "smallerId:largerId"
    ttlSeconds: { type: Number, default: 0 },                 // 0 = off
    timerSetAt: { type: Date, default: null },
    timerSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { versionKey: false }
);

module.exports = mongoose.model('Conversation', conversationSchema);

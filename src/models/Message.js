const mongoose = require('mongoose');

// The server stores ciphertext only. "body" is a PGP armored message that
// was encrypted on the sender's phone with the recipient's public key.
const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, required: true },
    recipientFingerprint: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
    // Null = keep until deleted. Set when a per-message or chat timer applies.
    expiresAt: { type: Date, default: null },
    // Set when the sender edits the message.
    editedAt: { type: Date, default: null },
  },
  { versionKey: false }
);

// MongoDB removes a document automatically once expiresAt has passed.
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Message', messageSchema);

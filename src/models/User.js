const mongoose = require('mongoose');

// No profile picture field exists on purpose. Sigil never stores avatars.
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    // Public key only. The private key never leaves the user's device.
    publicKey: { type: String, default: null },
    fingerprint: { type: String, default: null, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

module.exports = mongoose.model('User', userSchema);

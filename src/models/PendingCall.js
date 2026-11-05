const mongoose = require('mongoose');

// An offer kept for up to 60 seconds while the recipient's phone wakes from a push.
// The body is ciphertext, so holding it does not expose the call.
const pendingCallSchema = new mongoose.Schema(
  {
    to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    from: { type: String, required: true },
    callId: { type: String, required: true, index: true },
    video: { type: Boolean, default: false },
    body: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false }
);
pendingCallSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PendingCall', pendingCallSchema);

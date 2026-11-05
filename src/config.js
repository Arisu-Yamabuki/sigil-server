require('dotenv').config();

const required = ['JWT_SECRET', 'MONGO_URI'];
for (const key of required) {
  if (!process.env[key] || process.env[key].startsWith('change_me')) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing or unsafe ${key}. Set it in .env before starting.`);
    }
  }
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sigil',
  jwtSecret: process.env.JWT_SECRET || 'dev_only_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://sigil.adnand.com',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  maxCiphertextBytes: 64 * 1024,
  maxTimerSeconds: 60 * 60 * 24 * 365,
  // TURN relay for calls behind strict NATs. The secret must match coturn's static-auth-secret.
  turnSecret: process.env.TURN_SECRET || '',
  turnUrls: (process.env.TURN_URLS || '').split(',').map((u) => u.trim()).filter(Boolean),
  stunUrls: (process.env.STUN_URLS || 'stun:sigil.adnand.com:3478').split(',').map((u) => u.trim()),
};

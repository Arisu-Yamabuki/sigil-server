# Sigil Server

An OpenSource Secure messaging Platform 

## Tech Stack

Node.js + Express + MongoDB backend for the Sigil messaging app.

Sigil stores public keys and PGP ciphertext only. Private keys never reach the server, and plaintext is never sent to it.

## Run locally

```bash
cp .env.example .env          # then edit JWT_SECRET
npm install
# MongoDB must be running on MONGO_URI (e.g. sudo systemctl start mongodb)
npm start                     # http://localhost:3000
```

Arch Linux: install Node with `sudo pacman -S nodejs npm`. Install MongoDB from the AUR (`yay -S mongodb-bin`) or use the Docker setup below.

## Run with Docker

```bash
cp .env.example .env
docker compose up -d --build
```

## Security notes

- Passwords are hashed with bcrypt (cost 12).
- Auth uses HS256 JWTs. Use a long random `JWT_SECRET`.
- Login and registration are rate-limited.
- Message bodies must be armored PGP messages and are capped at 64 KB.
- Public key uploads are capped at 20 KB and must be armored public keys.
- Timers use MongoDB TTL indexes, so expired messages are deleted automatically.
- No profile pictures or avatars are stored.

Server metadata (who talks to whom, and when) is still visible to the server operator. End-to-end encryption protects message content, not metadata.

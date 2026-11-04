const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { jwtSecret, corsOrigin } = require('./config');

let io = null;

function initRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: corsOrigin === '*' ? true : corsOrigin.split(','), credentials: true },
    maxHttpBufferSize: 100 * 1024,
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      socket.data.userId = String(payload.sub);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join('user:' + socket.data.userId);
  });
}

function emitToUser(userId, event, payload) {
  if (io) io.to('user:' + userId).emit(event, payload);
}

module.exports = { initRealtime, emitToUser };

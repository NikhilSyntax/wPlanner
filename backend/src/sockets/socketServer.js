const http = require('http');
const { Server: IoServer } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/config')();

// Map to track active connections
const activeConnections = new Map();
let ioInstance = null;

exports.getIO = () => ioInstance;

exports.createServer = (app) => {
  const server = http.createServer(app);
  const ioServer = new IoServer(server, {
    cors: config.socket?.cors || config.cors
  });
  ioInstance = ioServer;
  server.io = ioServer;

  ioServer.on('connection', (socket) => {
    // Extract token from Authorization header or query param
    const authHeader = socket.handshake.headers.authorization;
    let token = authHeader?.split(' ')[1];
    if (!token && socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token;
    }

    if (!token) {
      socket.disconnect(true);
      return;
    }

    try {
      const decoded = jwt.verify(token, config.secrets.jwtSecret);
      socket.userId = decoded.userId;
      socket.isAdmin = !!decoded.isAdmin;
      socket.approvalStatus = decoded.approvalStatus || 'approved';
    } catch (error) {
      socket.disconnect(true);
      return;
    }

    // Track connection
    activeConnections.set(socket.id, { socket, userId: socket.userId });

    // Handle room events
    socket.on('joinRoom', ({ eventId }) => {
      if (!eventId) return;
      if (
        socket.approvalStatus === 'pending' ||
        socket.approvalStatus === 'rejected'
      ) {
        socket.emit('error', { message: 'Unauthorized to join room' });
        return;
      }

      socket.join(eventId);
      socket.emit('roomJoined', { eventId });
      ioServer.to(eventId).emit('updatePresence', {
        userId: socket.userId,
        status: 'joined',
      });
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      activeConnections.delete(socket.id);
      ioServer.emit('updatePresence', { userId: socket.userId, status: 'left' });
    });
  });

  return server;
};

exports.activeConnections = activeConnections;

const http = require('http');
const { Server: IoServer } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/config')();
const LiveDisplay = require('../models/LiveDisplay');
const LiveSession = require('../models/LiveSession');
const { processLiveCommand } = require('../controllers/liveController');

// Map to track active connections
const activeConnections = new Map();
// Map to track live viewer sockets per event: eventId -> Set(socketId)
const liveViewerSockets = new Map();

let ioInstance = null;

exports.getIO = () => ioInstance;

exports.createServer = (app) => {
  const server = http.createServer(app);
  const ioServer = new IoServer(server, {
    cors: config.socket?.cors || config.cors,
  });
  ioInstance = ioServer;
  server.io = ioServer;

  ioServer.on('connection', async (socket) => {
    // Extract token or displayToken from Authorization header or query param
    const authHeader = socket.handshake.headers.authorization;
    let token = authHeader?.split(' ')[1];
    if (!token && socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token;
    }

    const displayToken = socket.handshake.query && socket.handshake.query.displayToken;
    const eventIdParam = socket.handshake.query && socket.handshake.query.eventId;
    const isPopoutViewer = socket.handshake.query && socket.handshake.query.isViewer === 'true';

    // Direct Pop-out TV Viewer connection (No token needed, pre-linked to event)
    if (eventIdParam && (isPopoutViewer || (!token && !displayToken))) {
      socket.isLiveViewer = true;
      socket.eventId = eventIdParam.toString();
      const room = `live_session_${socket.eventId}`;
      socket.join(room);

      if (!liveViewerSockets.has(socket.eventId)) {
        liveViewerSockets.set(socket.eventId, new Set());
      }
      liveViewerSockets.get(socket.eventId).add(socket.id);

      const viewerCount = liveViewerSockets.get(socket.eventId).size;
      ioServer.to(`live_operator_${socket.eventId}`).emit('live:viewer:count', { count: viewerCount });
      console.log(`[LiveSocket] Direct Pop-out TV viewer connected to room ${room}. Total viewers: ${viewerCount}`);
      return;
    }

    if (!token && !displayToken) {
      socket.disconnect(true);
      return;
    }

    if (displayToken) {
      // Viewer TV connection
      try {
        const display = await LiveDisplay.findOne({ token: displayToken });
        if (!display) {
          socket.disconnect(true);
          return;
        }
        socket.isLiveViewer = true;
        socket.displayToken = displayToken;
        socket.churchId = display.churchId;

        if (display.eventId) {
          const eventIdStr = display.eventId.toString();
          socket.eventId = eventIdStr;
          const room = `live_session_${eventIdStr}`;
          socket.join(room);

          if (!liveViewerSockets.has(eventIdStr)) {
            liveViewerSockets.set(eventIdStr, new Set());
          }
          liveViewerSockets.get(eventIdStr).add(socket.id);

          const viewerCount = liveViewerSockets.get(eventIdStr).size;
          ioServer.to(`live_operator_${eventIdStr}`).emit('live:viewer:count', { count: viewerCount });
          console.log(`[LiveSocket] Viewer TV auto-joined room ${room}. Total viewers: ${viewerCount}`);
        }
      } catch (err) {
        socket.disconnect(true);
        return;
      }
    } else {
      // Standard logged-in user connection
      try {
        const decoded = jwt.verify(token, config.secrets.jwtSecret);
        socket.userId = decoded.userId;
        socket.churchId = decoded.churchId;
        socket.isAdmin = !!decoded.isAdmin || !!decoded.isSubAdmin;
        socket.isSubAdmin = !!decoded.isSubAdmin;
        socket.approvalStatus = decoded.approvalStatus || 'approved';
      } catch (error) {
        socket.disconnect(true);
        return;
      }

      // Track connection and join private user room
      activeConnections.set(socket.id, { socket, userId: socket.userId });
      socket.join(`user_${socket.userId}`);
    }

    // ==========================================
    // Live Presentation Handlers
    // ==========================================

    // Operator joins live session
    socket.on('live:operator:join', async ({ eventId }) => {
      if (!eventId || socket.isLiveViewer) return;
      if (socket.approvalStatus === 'pending' || socket.approvalStatus === 'rejected') {
        socket.emit('error', { message: 'Unauthorized for live presentation' });
        return;
      }

      const room = `live_session_${eventId}`;
      const operatorRoom = `live_operator_${eventId}`;
      socket.join(room);
      socket.join(operatorRoom);

      const viewersSet = liveViewerSockets.get(eventId) || new Set();
      socket.emit('live:viewer:count', { count: viewersSet.size });
      console.log(`[LiveSocket] Operator joined ${eventId}. Current viewers: ${viewersSet.size}`);
    });

    // Viewer (TV/Display) joins live session
    socket.on('live:viewer:join', async ({ eventId, token: vToken } = {}) => {
      const activeToken = vToken || socket.displayToken;
      if (!activeToken) return;

      try {
        const display = await LiveDisplay.findOne({ token: activeToken });
        if (!display) {
          socket.emit('error', { message: 'Invalid display token' });
          return;
        }

        const targetEventId = eventId || (display.eventId ? display.eventId.toString() : null);
        if (!targetEventId) return;

        socket.eventId = targetEventId;
        socket.isLiveViewer = true;

        const room = `live_session_${targetEventId}`;
        socket.join(room);

        // Track viewer count
        if (!liveViewerSockets.has(targetEventId)) {
          liveViewerSockets.set(targetEventId, new Set());
        }
        liveViewerSockets.get(targetEventId).add(socket.id);

        const viewerCount = liveViewerSockets.get(targetEventId).size;
        ioServer.to(`live_operator_${targetEventId}`).emit('live:viewer:count', { count: viewerCount });
        console.log(`[LiveSocket] Viewer TV joined ${targetEventId}. Total viewers: ${viewerCount}`);
      } catch (err) {
        console.error('[LiveSocket] Error joining viewer:', err);
      }
    });

    // Operator sends live presentation command
    socket.on('live:command', async ({ eventId, command }) => {
      if (!eventId || !command || socket.isLiveViewer) return;
      if (socket.approvalStatus === 'pending' || socket.approvalStatus === 'rejected') {
        return;
      }

      try {
        const updatedState = await processLiveCommand(eventId, command);
        if (updatedState) {
          // Broadcast state update to both viewers and operators
          ioServer.to(`live_session_${eventId}`).emit('live:state:updated', updatedState);
        }
      } catch (err) {
        console.error('[LiveSocket] Error processing live command:', err);
        socket.emit('error', { message: 'Failed to process live command' });
      }
    });

    // ==========================================
    // Existing Chat & Team Room Handlers
    // ==========================================

    socket.on('joinRoom', ({ eventId }) => {
      if (!eventId || socket.isLiveViewer) return;
      if (socket.approvalStatus === 'pending' || socket.approvalStatus === 'rejected') {
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

    socket.on('joinTeam', ({ teamId }) => {
      if (!teamId || socket.isLiveViewer) return;
      if (socket.approvalStatus === 'pending' || socket.approvalStatus === 'rejected') {
        socket.emit('error', { message: 'Unauthorized to join team room' });
        return;
      }

      const room = `team_${teamId}`;
      socket.join(room);
      socket.emit('teamJoined', { teamId });
      ioServer.to(room).emit('updateTeamPresence', {
        userId: socket.userId,
        status: 'joined',
      });
    });

    socket.on('joinChurch', ({ churchId }) => {
      if (!churchId || socket.isLiveViewer) return;
      if (socket.approvalStatus === 'pending' || socket.approvalStatus === 'rejected') {
        socket.emit('error', { message: 'Unauthorized to join church room' });
        return;
      }

      const room = `church_${churchId}`;
      socket.join(room);
      socket.emit('churchJoined', { churchId });
      ioServer.to(room).emit('updateChurchPresence', {
        userId: socket.userId,
        status: 'joined',
      });
    });

    // Cleanup on disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        activeConnections.delete(socket.id);
        ioServer.emit('updatePresence', { userId: socket.userId, status: 'left' });
      }

      if (socket.isLiveViewer && socket.eventId) {
        const viewers = liveViewerSockets.get(socket.eventId);
        if (viewers) {
          viewers.delete(socket.id);
          const count = viewers.size;
          ioServer.to(`live_operator_${socket.eventId}`).emit('live:viewer:count', { count });
          console.log(`[LiveSocket] Viewer TV disconnected from ${socket.eventId}. Remaining: ${count}`);
        }
      }
    });
  });

  return server;
};

exports.activeConnections = activeConnections;

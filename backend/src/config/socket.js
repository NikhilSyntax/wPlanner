const config = require('./config')();

module.exports = {
  cors: config.cors,
  namespace: 'wPlanner',
  debug: false,
  path: '/socket.io',
  serveClient: true,
  transports: ['websocket'],
  upgrade: true,
  memory: {
    maxsize: 1024 * 1024 * 10,
    'connection-limit': 100
  }
};

import http from 'http';
import app from './app';
import { env } from './config/env';
import { initSocketIO } from './socket/index';

const server = http.createServer(app);

// Initialize Socket.IO
initSocketIO(server);

server.listen(env.PORT, () => {
  console.log(`🚀 LeakLens Backend Server running on port ${env.PORT}`);
  console.log(`📡 Health Check URL: http://localhost:${env.PORT}/api/v1/health`);
});

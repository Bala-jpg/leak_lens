import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';

export const socket: Socket = io(WS_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 2000,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('⚡ Connected to LeakLens WebSocket Gateway:', socket.id);
});

socket.on('connect_error', (err) => {
  console.warn('Socket connection fallback (running in offline simulation mode):', err.message);
});

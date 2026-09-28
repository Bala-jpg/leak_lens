import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || window.location.origin;

export const socket: Socket = io(WS_URL, {
  autoConnect: false,
  auth: (cb) => cb({ token: localStorage.getItem('leaklens_token') }),
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('⚡ Connected to LeakLens WebSocket Gateway:', socket.id);
});

socket.on('connect_error', (err) => {
  console.warn('Socket connection failed:', err.message);
});

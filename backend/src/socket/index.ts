import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env';
import { verifyAccessToken } from '../utils/jwt';
import pool from '../config/db';

let io: SocketIOServer | null = null;

export const initSocketIO = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, { cors: { origin: env.ALLOWED_ORIGINS, credentials: true } });
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (typeof token !== 'string') return next(new Error('Authentication required'));
      socket.data.userId = verifyAccessToken(token).userId;
      next();
    } catch { next(new Error('Invalid access token')); }
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
    socket.on('device:subscribe', async (deviceId: string) => {
      if (typeof deviceId !== 'string') return;
      try {
        const result = await pool.query('SELECT 1 FROM devices WHERE id = $1 AND user_id = $2', [deviceId, socket.data.userId]);
        if (result.rowCount) socket.join(`device:${deviceId}`);
        else socket.emit('device:subscription_error', { deviceId });
      } catch { socket.emit('device:subscription_error', { deviceId }); }
    });
    socket.on('device:unsubscribe', (deviceId: string) => {
      if (typeof deviceId === 'string') socket.leave(`device:${deviceId}`);
    });
  });
  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) throw new Error('Socket.IO is not initialized');
  return io;
};

export const broadcastTelemetry = (deviceId: string, payload: unknown) => io?.to(`device:${deviceId}`).emit('telemetry_update', payload);
export const broadcastLeakAlert = (deviceId: string, payload: unknown) => io?.to(`device:${deviceId}`).emit('leak_alert', payload);
export const broadcastValveCommand = (deviceId: string, payload: unknown) => io?.to(`device:${deviceId}`).emit('valve_command', payload);
export const broadcastNotification = (userId: string, payload: unknown) => io?.to(`user:${userId}`).emit('notification_new', payload);

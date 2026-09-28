import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import deviceRoutes from './routes/device.routes';
import telemetryRoutes from './routes/telemetry.routes';
import leakRoutes from './routes/leak.routes';
import notificationRoutes from './routes/notification.routes';

const app = express();

app.use(cors({
  origin: (requestOrigin, callback) => {
    if (!requestOrigin) return callback(null, true);
    if (env.ALLOWED_ORIGINS.includes(requestOrigin) || env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// API v1 routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/devices', deviceRoutes);
app.use('/api/v1/telemetry', telemetryRoutes);
app.use('/api/v1/leaks', leakRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// Global Error Handler
app.use(errorHandler);

export default app;

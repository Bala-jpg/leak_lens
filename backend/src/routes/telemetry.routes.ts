import { Router } from 'express';
import { ingestTelemetry, getTelemetryHistory } from '../controllers/telemetry.controller';
import { authenticateDevice } from '../middleware/deviceAuth.middleware';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

router.post('/ingest', authenticateDevice, ingestTelemetry);
router.get('/device/:deviceId', authenticateUser, getTelemetryHistory);

export default router;

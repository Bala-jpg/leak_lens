import { Router } from 'express';
import { ingestTelemetry, getTelemetryHistory } from '../controllers/telemetry.controller';
import { authenticateDevice } from '../middleware/deviceAuth.middleware';
import { authenticateUser } from '../middleware/auth.middleware';
import { telemetryRateLimit } from '../middleware/rateLimit';

const router = Router();

router.post('/ingest', authenticateDevice, telemetryRateLimit, ingestTelemetry);
router.post('/', authenticateDevice, telemetryRateLimit, ingestTelemetry);
router.get('/device/:deviceId', authenticateUser, getTelemetryHistory);

export default router;

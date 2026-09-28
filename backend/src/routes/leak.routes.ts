import { validateId } from '../middleware/validateId';
import { Router } from 'express';
import { getLeakEvents, getLeakStats, resolveLeakEvent } from '../controllers/leak.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();
router.param('id', validateId);

router.use(authenticateUser);

router.get('/', getLeakEvents);
router.get('/stats', getLeakStats);
router.patch('/:id/resolve', resolveLeakEvent);

export default router;

import { validateId } from '../middleware/validateId';
import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead } from '../controllers/notification.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();
router.param('id', validateId);

router.use(authenticateUser);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

export default router;

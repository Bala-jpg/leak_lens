import { Router } from 'express';
import { register, login, refreshToken, getMe, updateMe, changePassword } from '../controllers/auth.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { authRateLimit } from '../middleware/rateLimit';

const router = Router();

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.post('/refresh', authRateLimit, refreshToken);
router.get('/me', authenticateUser, getMe);
router.patch('/me', authenticateUser, updateMe);
router.post('/password', authenticateUser, changePassword);

export default router;

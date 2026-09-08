import { Router } from 'express';
import {
  createDevice,
  getDevices,
  getDeviceById,
  updateDevice,
  toggleValve,
  deleteDevice,
} from '../controllers/device.controller';
import { authenticateUser } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateUser);

router.post('/', createDevice);
router.get('/', getDevices);
router.get('/:id', getDeviceById);
router.patch('/:id', updateDevice);
router.post('/:id/valve', toggleValve);
router.delete('/:id', deleteDevice);

export default router;

import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const hashDeviceKey = (deviceKey: string): string => {
  return crypto
    .createHmac('sha256', env.DEVICE_API_KEY_PEPPER)
    .update(deviceKey)
    .digest('hex');
};

export const generateDeviceKey = (): string => {
  return `ll_${crypto.randomBytes(24).toString('hex')}`;
};

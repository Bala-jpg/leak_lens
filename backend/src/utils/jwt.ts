import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AuthUserPayload } from '../types/index';

export const generateAccessToken = (payload: AuthUserPayload): string => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '1h',
  });
};

export const generateRefreshToken = (payload: AuthUserPayload): string => {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
};

export const verifyAccessToken = (token: string): AuthUserPayload => {
  return jwt.verify(token, env.JWT_SECRET) as AuthUserPayload;
};

export const verifyRefreshToken = (token: string): AuthUserPayload => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthUserPayload;
};

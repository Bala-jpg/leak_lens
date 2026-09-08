import { Request } from 'express';

export interface AuthUserPayload {
  userId: string;
  email: string;
}

export interface AuthDevicePayload {
  deviceId: string;
  userId: string;
  name: string;
  location: string;
  status: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUserPayload;
  device?: AuthDevicePayload;
}

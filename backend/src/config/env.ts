import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.string().default('5000').transform((val) => parseInt(val, 10)),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),
  JWT_SECRET: z.string().default('default_jwt_secret'),
  JWT_REFRESH_SECRET: z.string().default('default_jwt_refresh_secret'),
  FRONTEND_URL: z.string().default('http://localhost:5173,http://localhost:3000'),
  DEVICE_API_KEY_PEPPER: z.string().default('default_pepper_secret'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

const parsed = _env.data;
if (parsed.NODE_ENV === 'production' && [parsed.JWT_SECRET, parsed.JWT_REFRESH_SECRET, parsed.DEVICE_API_KEY_PEPPER].some((value) => value.startsWith('default_'))) {
  throw new Error('Production secrets must be configured');
}
const allowedOrigins = parsed.FRONTEND_URL.split(',').map((url) => url.trim());

export const env = {
  ...parsed,
  ALLOWED_ORIGINS: allowedOrigins,
};

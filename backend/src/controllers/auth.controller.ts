import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/db';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthenticatedRequest } from '../types/index';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);

    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'A user with this email address already exists.',
      });
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );

    const user = result.rows[0];
    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

    return res.status(201).json({
      status: 'success',
      data: {
        user,
        accessToken,
        refreshToken,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const result = await pool.query(
      'SELECT id, name, email, password_hash, created_at FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password.',
      });
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

    const { password_hash, ...userProfile } = user;

    return res.status(200).json({
      status: 'success',
      data: {
        user: userProfile,
        accessToken,
        refreshToken,
        tokens: {
          accessToken,
          refreshToken,
        },
      },
      user: userProfile,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken: token } = refreshSchema.parse(req.body);
    const decoded = verifyRefreshToken(token);

    const userRes = await pool.query('SELECT id, email FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({
        status: 'error',
        message: 'User no longer exists.',
      });
    }

    const newAccessToken = generateAccessToken({ userId: decoded.userId, email: decoded.email });

    return res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
      },
      accessToken: newAccessToken,
    });
  } catch (error) {
    return res.status(401).json({
      status: 'error',
      message: 'Invalid or expired refresh token.',
    });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const result = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    const user = result.rows[0];

    return res.status(200).json({
      status: 'success',
      data: {
        user,
      },
      user,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { name, email } = z.object({ name: z.string().trim().min(2), email: z.email().trim().toLowerCase() }).parse(req.body);
    const result = await pool.query('UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email, created_at', [name, email, req.user?.userId]);
    if (!result.rows.length) return res.status(404).json({ status: 'error', message: 'User not found.' });
    return res.json({ status: 'success', data: { user: result.rows[0] } });
  } catch (error) {
    if ((error as { code?: string }).code === '23505') {
      return res.status(409).json({ status: 'error', message: 'Email address is already in use.' });
    }
    next(error);
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }).parse(req.body);
    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user?.userId]);
    if (!result.rows.length || !await verifyPassword(currentPassword, result.rows[0].password_hash)) {
      return res.status(401).json({ status: 'error', message: 'Current password is incorrect.' });
    }
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(newPassword), req.user?.userId]);
    return res.json({ status: 'success' });
  } catch (error) { next(error); }
};

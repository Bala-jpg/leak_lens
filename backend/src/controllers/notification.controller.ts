import { Response, NextFunction } from 'express';
import pool from '../config/db';
import { AuthenticatedRequest } from '../types/index';

export const getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const result = await pool.query(
      `SELECT n.id, n.device_id, d.name as device_name, n.leak_event_id, n.type, n.message, n.read_status, n.created_at
       FROM notifications n
       JOIN devices d ON n.device_id = d.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC`,
      [userId]
    );

    return res.status(200).json({
      status: 'success',
      data: {
        notifications: result.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE notifications
       SET read_status = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, read_status`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Notification not found or unauthorized.',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        notification: result.rows[0],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const markAllAsRead = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    await pool.query(
      `UPDATE notifications SET read_status = true WHERE user_id = $1`,
      [userId]
    );

    return res.status(200).json({
      status: 'success',
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    next(error);
  }
};

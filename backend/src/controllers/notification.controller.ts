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

    const notifications = result.rows.map((n) => ({
      id: n.id,
      userId: n.user_id,
      deviceId: n.device_id,
      deviceName: n.device_name,
      leakEventId: n.leak_event_id,
      type: n.type,
      message: n.message,
      readStatus: n.read_status,
      createdAt: n.created_at,
      user_id: n.user_id,
      device_id: n.device_id,
      device_name: n.device_name,
      leak_event_id: n.leak_event_id,
      read_status: n.read_status,
      created_at: n.created_at,
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        notifications,
      },
      notifications,
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

    const notification = {
      id: result.rows[0].id,
      readStatus: result.rows[0].read_status,
      read_status: result.rows[0].read_status,
    };

    return res.status(200).json({
      status: 'success',
      data: {
        notification,
      },
      notification,
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

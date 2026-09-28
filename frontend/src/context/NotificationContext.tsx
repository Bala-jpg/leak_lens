import React, { createContext, useContext, useState, useEffect } from 'react';
import type { NotificationItem } from '../types';
import { notificationApi } from '../api';
import { socket } from '../api/socket';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notif: Omit<NotificationItem, 'id' | 'createdAt' | 'readStatus'>) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  useEffect(() => {
    if (!isAuthenticated) { setNotifications([]); return; }
    notificationApi.getNotifications().then(setNotifications).catch(console.error);
    const onNotification = () => notificationApi.getNotifications().then(setNotifications).catch(console.error);
    socket.on('notification_new', onNotification);
    socket.on('connect', onNotification);
    return () => { socket.off('notification_new', onNotification); socket.off('connect', onNotification); };
  }, [isAuthenticated]);

  const unreadCount = notifications.filter((n) => !n.readStatus).length;

  const markAsRead = async (id: string) => {
    await notificationApi.markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readStatus: true } : n))
    );
  };

  const markAllAsRead = async () => {
    await notificationApi.markAllAsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: true })));
  };

  const addNotification = (notif: Omit<NotificationItem, 'id' | 'createdAt' | 'readStatus'>) => {
    const newItem: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}`,
      readStatus: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications((prev) => [newItem, ...prev]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        addNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
  return context;
};

import { apiClient } from './auth';

export interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export const notificationsApi = {
  getUnread: async (): Promise<Notification[]> => {
    const res = await apiClient.get('/notifications/unread');
    return res.data;
  },
  markAsRead: async (id: string) => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data;
  },
  markAllAsRead: async () => {
    const res = await apiClient.patch('/notifications/read-all');
    return res.data;
  },
  createNotification: async (payload: {
    tenantId: string;
    roleName: string;
    title: string;
    message: string;
    link?: string;
  }) => {
    const res = await apiClient.post('/notifications', payload);
    return res.data;
  },
};

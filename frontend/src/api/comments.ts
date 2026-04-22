import api from './axios';

export interface Comment {
  id: string;
  entityType: string;
  entityId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    fullName: string;
    email: string;
    role: { roleName: string };
  };
}

export const commentsApi = {
  getByEntity: async (entityType: string, entityId: string): Promise<Comment[]> => {
    const res = await api.get('/comments', { params: { entityType, entityId } });
    return res.data;
  },
  
  create: async (entityType: string, entityId: string, content: string): Promise<Comment> => {
    const res = await api.post('/comments', { entityType, entityId, content });
    return res.data;
  },
  
  delete: async (id: string): Promise<void> => {
    await api.delete(`/comments/${id}`);
  },
};

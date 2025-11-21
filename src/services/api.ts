import axios from 'axios';
import { Quiz, Student, QuizShare } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable sending cookies
});

// Quiz API
export const quizAPI = {
  save: async (quiz: Partial<Quiz>): Promise<{ success: boolean; quizId: string; quiz?: any }> => {
    const response = await api.post('/quiz/save', quiz);
    return response.data;
  },

  share: async (shareData: QuizShare): Promise<{ success: boolean; message: string; links: QuizShare['links'] }> => {
    const response = await api.post('/quiz/share', shareData);
    return response.data;
  },

  getAll: async (): Promise<Quiz[]> => {
    const response = await api.get('/quiz/all');
    return response.data;
  },

  delete: async (quizId: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/quiz/${quizId}`);
    return response.data;
  },

  getAllWithStats: async (): Promise<any[]> => {
    const response = await api.get('/quiz/results/all');
    return response.data;
  },

  getResults: async (quizId: string): Promise<{ quiz: any; attempts: any[] }> => {
    const response = await api.get(`/quiz/${quizId}/results`);
    return response.data;
  },
};

// Students API
export const studentsAPI = {
  upload: async (students: Student[]): Promise<{ success: boolean; count: number }> => {
    const response = await api.post('/students/upload', { students });
    return response.data;
  },

  getAll: async (): Promise<Student[]> => {
    const response = await api.get('/students/all');
    return response.data;
  },

  delete: async (studentId: string): Promise<{ success: boolean }> => {
    const response = await api.delete(`/students/${studentId}`);
    return response.data;
  },
};

// Folders API
export const foldersAPI = {
  getAll: async () => {
    const response = await api.get('/folders');
    return response.data.folders;
  },

  create: async (folderData: { name: string; description?: string; color?: string }) => {
    const response = await api.post('/folders', folderData);
    return response.data.folder;
  },

  update: async (folderId: string, folderData: { name?: string; description?: string; color?: string }) => {
    const response = await api.put(`/folders/${folderId}`, folderData);
    return response.data.folder;
  },

  delete: async (folderId: string) => {
    const response = await api.delete(`/folders/${folderId}`);
    return response.data;
  },
};

// Bookmarks API
export const bookmarksAPI = {
  getAll: async () => {
    const response = await api.get('/bookmarks');
    return response.data.bookmarks;
  },

  create: async (bookmarkData: any) => {
    const response = await api.post('/bookmarks', bookmarkData);
    return response.data.bookmark;
  },

  delete: async (bookmarkId: string) => {
    const response = await api.delete(`/bookmarks/${bookmarkId}`);
    return response.data;
  },
};

export default api;

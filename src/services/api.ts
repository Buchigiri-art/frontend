import axios from 'axios';
import { Quiz, Student, QuizShare } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Debug info
if (import.meta.env.DEV) {
  console.log('[API] base URL =', API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Critical for cookies
});

// Request interceptor to add auth token if available
api.interceptors.request.use(
  (config) => {
    // You can add any request transformations here if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear any stored tokens and redirect to login
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
      // Only redirect if we're not already on login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials: { email: string; password: string }): Promise<{ success: boolean; user: any }> => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData: { name: string; email: string; password: string; role?: string }): Promise<{ success: boolean; user: any }> => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  getMe: async (): Promise<{ success: boolean; user: any }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  checkAuth: async (): Promise<{ success: boolean; authenticated: boolean; user?: any }> => {
    const response = await api.get('/auth/check');
    return response.data;
  },

  logout: async (): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/auth/logout');
    return response.data;
  },
};

// Quiz API
export const quizAPI = {
  save: async (quiz: Partial<Quiz>): Promise<{ success: boolean; quizId: string; quiz?: any }> => {
    const response = await api.post('/quiz/save', quiz);
    return response.data;
  },

  share: async (shareData: QuizShare): Promise<{ 
    success: boolean; 
    message: string; 
    links: Array<{ email: string; link: string; token: string }>;
    alreadySent: Array<{ email: string; link: string; token: string }>;
    failed: Array<{ email: string; reason: string }>;
    invalid: Array<{ email: string; reason: string }>;
  }> => {
    const response = await api.post('/quiz/share', shareData);
    return response.data;
  },

  getAll: async (): Promise<{ success: boolean; quizzes: Quiz[]; count: number }> => {
    const response = await api.get('/quiz/all');
    return response.data;
  },

  getById: async (quizId: string): Promise<{ success: boolean; quiz: Quiz }> => {
    const response = await api.get(`/quiz/${quizId}`);
    return response.data;
  },

  update: async (quizId: string, quizData: Partial<Quiz>): Promise<{ success: boolean; quiz: Quiz }> => {
    const response = await api.put(`/quiz/${quizId}`, quizData);
    return response.data;
  },

  delete: async (quizId: string): Promise<{ success: boolean; message: string; deletedId: string }> => {
    const response = await api.delete(`/quiz/${quizId}`);
    return response.data;
  },

  getAllWithStats: async (): Promise<{ success: boolean; quizzes: any[]; count: number }> => {
    const response = await api.get('/quiz/results/all');
    return response.data;
  },

  getResults: async (quizId: string): Promise<{ 
    success: boolean; 
    quiz: any; 
    attempts: any[];
    stats: {
      totalAttempts: number;
      submittedAttempts: number;
      averageScore: number;
    }
  }> => {
    const response = await api.get(`/quiz/${quizId}/results`);
    return response.data;
  },

  downloadResults: async (quizId: string, detailed: boolean = false): Promise<Blob> => {
    const response = await api.get(`/quiz/${quizId}/results/download?detailed=${detailed}`, {
      responseType: 'blob'
    });
    return response.data;
  },
};

// Students API
export const studentsAPI = {
  upload: async (students: Student[]): Promise<{ 
    success: boolean; 
    count: number; 
    message?: string;
    students?: Student[];
    conflicts?: string[];
  }> => {
    const response = await api.post('/students/upload', { students });
    return response.data;
  },

  create: async (student: Omit<Student, 'id'>): Promise<{ success: boolean; student: Student }> => {
    const response = await api.post('/students', student);
    return response.data;
  },

  getAll: async (params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    branch?: string;
    year?: string;
    semester?: string;
  }): Promise<{ 
    success: boolean; 
    students: Student[]; 
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    }
  }> => {
    const response = await api.get('/students/all', { params });
    return response.data;
  },

  getById: async (studentId: string): Promise<{ success: boolean; student: Student }> => {
    const response = await api.get(`/students/${studentId}`);
    return response.data;
  },

  update: async (studentId: string, data: Partial<Student>): Promise<{ success: boolean; student: Student }> => {
    const response = await api.put(`/students/${studentId}`, data);
    return response.data;
  },

  delete: async (studentId: string): Promise<{ success: boolean; message: string; deletedId: string }> => {
    const response = await api.delete(`/students/${studentId}`);
    return response.data;
  },

  bulkDelete: async (studentIds: string[]): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete('/students', { data: { studentIds } });
    return response.data;
  },
};

// Folders API
export const foldersAPI = {
  getAll: async (params?: { 
    page?: number; 
    limit?: number; 
    sortBy?: string;
  }): Promise<{ 
    success: boolean; 
    folders: any[]; 
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    }
  }> => {
    const response = await api.get('/folders', { params });
    return response.data;
  },

  getById: async (folderId: string): Promise<{ success: boolean; folder: any }> => {
    const response = await api.get(`/folders/${folderId}`);
    return response.data;
  },

  create: async (folderData: { name: string; description?: string; color?: string }): Promise<{ success: boolean; folder: any }> => {
    const response = await api.post('/folders', folderData);
    return response.data;
  },

  update: async (folderId: string, folderData: { name?: string; description?: string; color?: string }): Promise<{ success: boolean; folder: any }> => {
    const response = await api.put(`/folders/${folderId}`, folderData);
    return response.data;
  },

  delete: async (folderId: string): Promise<{ success: boolean; message: string; deletedId: string }> => {
    const response = await api.delete(`/folders/${folderId}`);
    return response.data;
  },

  getStats: async (folderId: string): Promise<{ success: boolean; stats: any }> => {
    const response = await api.get(`/folders/${folderId}/stats`);
    return response.data;
  },
};

// Bookmarks API
export const bookmarksAPI = {
  getAll: async (params?: { 
    page?: number; 
    limit?: number; 
    folderId?: string;
    search?: string;
    sortBy?: string;
  }): Promise<{ 
    success: boolean; 
    bookmarks: any[]; 
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    }
  }> => {
    const response = await api.get('/bookmarks', { params });
    return response.data;
  },

  getById: async (bookmarkId: string): Promise<{ success: boolean; bookmark: any }> => {
    const response = await api.get(`/bookmarks/${bookmarkId}`);
    return response.data;
  },

  create: async (bookmarkData: any): Promise<{ success: boolean; bookmark: any }> => {
    const response = await api.post('/bookmarks', bookmarkData);
    return response.data;
  },

  update: async (bookmarkId: string, bookmarkData: any): Promise<{ success: boolean; bookmark: any }> => {
    const response = await api.put(`/bookmarks/${bookmarkId}`, bookmarkData);
    return response.data;
  },

  delete: async (bookmarkId: string): Promise<{ success: boolean; message: string; deletedId: string }> => {
    const response = await api.delete(`/bookmarks/${bookmarkId}`);
    return response.data;
  },

  bulkDelete: async (bookmarkIds: string[]): Promise<{ success: boolean; message: string }> => {
    const response = await api.delete('/bookmarks', { data: { bookmarkIds } });
    return response.data;
  },
};

// Student Quiz API (for students taking quizzes)
export const studentQuizAPI = {
  getAttempt: async (token: string): Promise<{ 
    success: boolean; 
    quiz: any; 
    attemptId: string;
    studentInfo: any;
    hasStarted: boolean;
    warningCount: number;
    isCheated: boolean;
    alreadySubmitted?: boolean;
  }> => {
    const response = await api.get(`/student-quiz/attempt/${token}`);
    return response.data;
  },

  startAttempt: async (data: {
    token: string;
    studentName: string;
    studentUSN: string;
    studentBranch: string;
    studentYear: string;
    studentSemester: string;
  }): Promise<{ 
    success: boolean; 
    attemptId: string;
    quiz: any;
    studentInfo: any;
    status: string;
  }> => {
    const response = await api.post('/student-quiz/attempt/start', data);
    return response.data;
  },

  submitAttempt: async (data: {
    attemptId: string;
    answers: string[];
  }): Promise<{ 
    success: boolean; 
    message: string;
    results: {
      totalMarks: number;
      maxMarks: number;
      percentage: number;
      gradedAnswers: any[];
    }
  }> => {
    const response = await api.post('/student-quiz/attempt/submit', data);
    return response.data;
  },

  flagAttempt: async (data: {
    token: string;
    reason: string;
  }): Promise<{ 
    success: boolean; 
    warningCount: number;
    autoSubmitted: boolean;
    message: string;
  }> => {
    const response = await api.post('/student-quiz/attempt/flag', data);
    return response.data;
  },

  getResults: async (token: string): Promise<{ 
    success: boolean; 
    quiz: any;
    studentInfo: any;
    results: {
      totalMarks: number;
      maxMarks: number;
      percentage: number;
      answers: any[];
    }
  }> => {
    const response = await api.get(`/student-quiz/attempt/${token}/results`);
    return response.data;
  },
};

export default api;
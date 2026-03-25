import { create } from 'zustand';

export interface AICompanion {
  name: string;
  avatar: string;
  persona: string;
}

export interface User {
  id: string;
  nickname: string;
  role: 'author' | 'editor' | 'operator';
  phone: string;
  aiCompanion: AICompanion;
  creditScore: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  setAuth: (token: string, user: User) => {
    localStorage.setItem('writing_token', token);
    localStorage.setItem('writing_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('writing_token');
    localStorage.removeItem('writing_user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('writing_token');
    const userStr = localStorage.getItem('writing_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        set({ token, user, isAuthenticated: true });
      } catch {
        localStorage.removeItem('writing_token');
        localStorage.removeItem('writing_user');
      }
    }
  },
}));

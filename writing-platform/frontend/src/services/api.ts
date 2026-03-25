const API_BASE = import.meta.env.VITE_API_BASE || '/api/writing';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('writing_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || '请求失败');
  }
  return data as T;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    nickname: string;
    role: 'author' | 'editor' | 'operator';
    phone: string;
    aiCompanion: {
      name: string;
      avatar: string;
      persona: string;
    };
    creditScore: number;
  };
}

export const api = {
  sendCode: (phone: string) =>
    request<{ success: boolean; message: string }>('/auth/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  register: (data: {
    phone: string;
    code: string;
    nickname: string;
    realName?: string;
    role: 'author' | 'editor' | 'operator';
  }) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (phone: string, code: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),

  getMe: () =>
    request<{ user: AuthResponse['user'] }>('/user/me'),
};

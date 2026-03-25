import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';

export function useAuth() {
  const { token, user, isAuthenticated, setAuth, logout, loadFromStorage } =
    useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  return {
    token,
    user,
    isAuthenticated,
    setAuth,
    logout: handleLogout,
  };
}

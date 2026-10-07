/**
 * Zustand auth store — manages JWT tokens, user role, and auth state.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { authAPI } from '../services/api';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  role: 'patient' | 'doctor' | 'admin' | null;
  userId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      role: null,
      userId: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authAPI.login(email.trim(), password);
          const { access_token, refresh_token, role, user_id } = response.data;

          localStorage.setItem('access_token', access_token);
          localStorage.setItem('refresh_token', refresh_token);

          set({
            accessToken: access_token,
            refreshToken: refresh_token,
            role,
            userId: user_id,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return true;
        } catch (err: any) {
          let message = 'Login failed. Please check your credentials.';
          const detail = err?.response?.data?.detail;
          if (typeof detail === 'string') {
            message = detail;
          } else if (Array.isArray(detail)) {
            message = detail.map((d: any) => d.msg || d.message).join('; ');
          } else if (err?.response?.data?.message) {
            message = err.response.data.message;
          }
          set({ isLoading: false, error: message, isAuthenticated: false });
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({
          accessToken: null,
          refreshToken: null,
          role: null,
          userId: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'deepcare-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        role: state.role,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

import { useState, useCallback } from 'react';
import { AuthService, AuthResponse, RegisterData, RegisterResponse } from '@/lib/auth';
import { LoginCredentials } from '@/types/index';

export function useAuth() {
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    setLoading(true);
    try {
      const result = await AuthService.login(credentials);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData: RegisterData): Promise<RegisterResponse> => {
    setLoading(true);
    try {
      const result = await AuthService.register(userData);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await AuthService.logout();
    } finally {
      setLoading(false);
    }
  }, []);

  const getProfile = useCallback(async (): Promise<AuthResponse> => {
    setLoading(true);
    try {
      const result = await AuthService.getProfile();
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email: string): Promise<RegisterResponse> => {
    setLoading(true);
    try {
      const result = await AuthService.forgotPassword(email);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkAvailability = useCallback(async (field: 'username' | 'email', value: string): Promise<boolean> => {
    const result = await AuthService.checkAvailability(field, value);
    return result;
  }, []);

  const selectCharacter = useCallback(async (characterId: string): Promise<AuthResponse> => {
    setLoading(true);
    try {
      const result = await AuthService.selectCharacter(characterId);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    login,
    register,
    logout,
    getProfile,
    forgotPassword,
    checkAvailability,
    selectCharacter,
  };
}
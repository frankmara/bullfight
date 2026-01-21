import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";

interface User {
  id: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AUTH_STORAGE_KEY = "@bullfight_auth";

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
      if (stored) {
        const user = JSON.parse(stored);
        setState({ user, isLoading: false, isAuthenticated: true });
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } catch {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    const user = data.user;
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setState({ user, isLoading: false, isAuthenticated: true });
    return user;
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/register", {
      email,
      password,
    });
    const data = await res.json();
    const user = data.user;
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    setState({ user, isLoading: false, isAuthenticated: true });
    return user;
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  return {
    ...state,
    login,
    register,
    logout,
    isAdmin: state.user?.role === "admin",
  };
}

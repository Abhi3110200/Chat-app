import React, { createContext, useState, useEffect, useMemo, useContext, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import API, { setAuthToken } from "../services/api";
import { router } from "expo-router";

type User = {
  id: string;
  _id?: string;  // MongoDB ID
  name: string;
  email: string;
  online?: boolean;
};

type AuthContextType = {
  user: User | null;
  authToken: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadAuth = useCallback(async () => {
    try {
      const [token, refreshToken, savedUser] = await Promise.all([
        SecureStore.getItemAsync("token"),
        SecureStore.getItemAsync("refreshToken"),
        SecureStore.getItemAsync("user"),
      ]);
      
      if (token && savedUser) {
        const parsedUser = JSON.parse(savedUser);
        console.log('Loaded user from storage:', parsedUser);
        
        // Ensure user object has both id and _id
        const userData: User = {
          id: parsedUser._id || parsedUser.id,
          _id: parsedUser._id || parsedUser.id,
          name: parsedUser.name,
          email: parsedUser.email,
          online: parsedUser.online || false
        };
        
        // Set auth state
        setUser(userData);
        setAuthToken(token);
        
        // Set refresh token if available
        if (refreshToken) {
          await SecureStore.setItemAsync("refreshToken", refreshToken);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading auth data:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAuth();
  }, [loadAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await API.post("/auth/login", { email, password });
      console.log('Login response:', res.data);
      
      // Ensure user object has both id and _id
      const userData: User = {
        id: res.data.user._id || res.data.user.id,
        _id: res.data.user._id,
        name: res.data.user.name,
        email: res.data.user.email,
        online: true
      };
      
      // Update state and storage
      setUser(userData);
      setAuthToken(res.data.token);
      
      // Store tokens and user data
      await Promise.all([
        SecureStore.setItemAsync("token", res.data.token),
        SecureStore.setItemAsync("refreshToken", res.data.refreshToken || ''),
        SecureStore.setItemAsync("user", JSON.stringify(userData))
      ]);
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean> => {
    try {
      const res = await API.post("/auth/register", { name, email, password });
      console.log('Register response:', res.data);
      
      // Ensure user object has both id and _id
      const userData: User = {
        id: res.data.user._id || res.data.user.id,
        _id: res.data.user._id,
        name: res.data.user.name,
        email: res.data.user.email,
        online: true
      };
      
      // Update state and storage
      setUser(userData);
      setAuthToken(res.data.token);
      
      // Store tokens and user data
      await Promise.all([
        SecureStore.setItemAsync("token", res.data.token),
        SecureStore.setItemAsync("refreshToken", res.data.refreshToken || ''),
        SecureStore.setItemAsync("user", JSON.stringify(userData))
      ]);
      
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  };

  const logout = useCallback(async (): Promise<void> => {
    try {
      // Clear all auth data from state
      setUser(null);
      setAuthToken(null);
      
      // Clear all stored data
      await Promise.all([
        SecureStore.deleteItemAsync("token"),
        SecureStore.deleteItemAsync("refreshToken"),
        SecureStore.deleteItemAsync("user")
      ]);
      
      // Navigate to login
      router.replace("/login");
    } catch (error) {
      console.error('Error during logout:', error);
      // Even if there's an error, we should still try to navigate to login
      router.replace("/login");
    }
  }, [authToken]);

  const value = useMemo(
    () => ({
      user,
      authToken,
      loading,
      login,
      register,
      logout,
      refreshAuth: loadAuth,
    }),
    [user, authToken, loading, loadAuth, logout]
  );

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export { AuthContext };
export type { AuthContextType };

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

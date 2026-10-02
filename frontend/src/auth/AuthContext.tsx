/**
 * AuthProvider — Spec 02 extended.
 * Provides full identity (position, department, dataScope) to the React tree.
 * All security decisions are made by the backend. This context is UI only.
 */
import React, { createContext, useCallback, useEffect, useState } from 'react';
import apiClient from '@api/client';
import authApi, { type AuthenticatedIdentity, type DataScopeResponse } from '@api/authApi';
import { APP_CONFIG } from '@config/app.config';

export interface AuthContextValue {
  user: AuthenticatedIdentity | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  permissions: string[];
  dataScope: DataScopeResponse | null;
  login: (employeeId: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  /** UI hint only — backend is authoritative */
  hasPermission: (code: string) => boolean;
  hasRole: (roles: string | string[]) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [dataScope, setDataScope] = useState<DataScopeResponse | null>(null);

  async function _loadFullIdentity() {
    const [me, permsData, scope] = await Promise.all([
      authApi.getCurrentUser(),
      authApi.getPermissions(),
      authApi.getDataScope(),
    ]);
    setUser(me);
    setPermissions(permsData.permissions);
    setDataScope(scope);
  }

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem(APP_CONFIG.tokenKey);
    if (!token) { setIsLoading(false); return; }
    _loadFullIdentity()
      .catch(() => {
        localStorage.removeItem(APP_CONFIG.tokenKey);
        localStorage.removeItem(APP_CONFIG.refreshTokenKey);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (employeeId: string, password: string) => {
    const tokens = await authApi.login(employeeId, password);
    localStorage.setItem(APP_CONFIG.tokenKey, tokens.access_token);
    localStorage.setItem(APP_CONFIG.refreshTokenKey, tokens.refresh_token);
    await _loadFullIdentity();
  }, []);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* proceed */ }
    localStorage.removeItem(APP_CONFIG.tokenKey);
    localStorage.removeItem(APP_CONFIG.refreshTokenKey);
    setUser(null); setPermissions([]); setDataScope(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try { await _loadFullIdentity(); } catch { /* ignore */ }
  }, []);

  const hasPermission = useCallback((code: string): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN' || user.role === 'SYSTEM_ADMIN') return true;
    return permissions.includes(code);
  }, [user, permissions]);

  const hasRole = useCallback((roles: string | string[]): boolean => {
    if (!user?.role) return false;
    return (Array.isArray(roles) ? roles : [roles]).includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, isLoading,
      permissions, dataScope,
      login, logout, refreshUser, hasPermission, hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

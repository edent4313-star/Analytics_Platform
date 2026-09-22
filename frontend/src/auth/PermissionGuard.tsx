/**
 * Renders children only if the current user has the required permission.
 * Used to conditionally show/hide UI elements (buttons, menu items, etc.)
 *
 * NOTE: UI hiding is NOT a security boundary — the backend enforces all
 * permissions. This component is for UX only.
 */
import type { ReactNode } from 'react';
import { useAuth } from './useAuth';

interface PermissionGuardProps {
  permission?: string;
  role?: string | string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGuard({
  permission,
  role,
  fallback = null,
  children,
}: PermissionGuardProps) {
  const { hasPermission, hasRole } = useAuth();

  if (permission && !hasPermission(permission)) return <>{fallback}</>;
  if (role && !hasRole(role)) return <>{fallback}</>;

  return <>{children}</>;
}

import React from 'react';
import { useAuthStore } from '../store/authStore';

type Role = 'ADMIN' | 'ANALYST' | 'EDITOR';

interface RoleGuardProps {
  allowed: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Intelligent UX Permission Layer.
 * Decides whether to render a component based on the user's role.
 * If the user does not have an allowed role, it renders the fallback (or null).
 */
export default function RoleGuard({ allowed, children, fallback = null }: RoleGuardProps) {
  const { user } = useAuthStore();

  if (!user || !user.role) {
    return <>{fallback}</>;
  }

  if (allowed.includes(user.role as Role)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

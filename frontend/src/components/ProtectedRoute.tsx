import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

import { useAuthStore } from '../stores/authStore';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const signedIn = useAuthStore((s) => s.refreshToken !== null);
  if (!signedIn) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

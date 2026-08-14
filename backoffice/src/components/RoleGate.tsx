import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { Action, Resource } from '../permissions';

interface Props {
  resource: Resource;
  action?: Action;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function RoleGate({ resource, action = 'read', children, fallback }: Props) {
  const { can } = usePermissions();
  if (!can(resource, action)) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

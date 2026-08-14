import { useAuth } from '../AuthContext';
import { Action, Resource, can, canRead, getMenuForRole, ROLE_LABELS } from '../permissions';

export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    role,
    roleLabel: role ? ROLE_LABELS[role] ?? role : '',
    can: (resource: Resource, action: Action) => can(role, resource, action),
    canRead: (resource: Resource) => canRead(role, resource),
    menuItems: role ? getMenuForRole(role) : [],
  };
}

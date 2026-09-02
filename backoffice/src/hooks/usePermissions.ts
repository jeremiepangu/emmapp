import { useAuth } from '../AuthContext';
import { Action, Resource, can, getMenuForRole, ROLE_LABELS } from '../permissions';

export function usePermissions() {
  const { user, permissions } = useAuth();
  const role = user?.role;

  return {
    role,
    roleLabel: role ? ROLE_LABELS[role] ?? role : '',
    can: (resource: Resource, action: Action) => can(role, resource, action, permissions),
    canRead: (resource: Resource) => can(role, resource, 'read', permissions),
    menuItems: role ? getMenuForRole(role, permissions) : [],
  };
}

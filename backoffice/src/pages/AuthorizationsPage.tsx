import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import {
  api,
  AclAction,
  AuthorizationCatalog,
  User,
  UserAuthorizationDetail,
} from '../api';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ROLE_LABELS } from '../permissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printAuthorizationMatrix, printUserAuthorizationSheet } from '../documents/templates';
import { exportSheet } from '../excel/specs';

type Tab = 'profils' | 'exceptions';
const ACTIONS: AclAction[] = ['read', 'create', 'update', 'delete', 'validate'];

function has(matrix: Record<string, string[]> | undefined, resource: string, action: AclAction) {
  return (matrix?.[resource] ?? []).includes(action);
}

function toggleAction(list: string[], action: AclAction, on: boolean) {
  const set = new Set(list);
  if (on) {
    set.add(action);
    set.add('read');
  } else {
    set.delete(action);
  }
  return ACTIONS.filter((a) => set.has(a));
}

export default function AuthorizationsPage() {
  const { can } = usePermissions();
  const { refreshPermissions } = useAuth();
  const [tab, setTab] = useState<Tab>('profils');
  const [catalog, setCatalog] = useState<AuthorizationCatalog | null>(null);
  const [matrix, setMatrix] = useState<Record<string, Record<string, string[]>>>({});
  const [role, setRole] = useState('COMMERCIAL');
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState('');
  const [detail, setDetail] = useState<UserAuthorizationDetail | null>(null);
  const [overrideForm, setOverrideForm] = useState({ resource: 'clients', action: 'read' as AclAction, effect: 'GRANT' as 'GRANT' | 'DENY' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canEdit = can('authorizations', 'update');
  const canReset = can('authorizations', 'delete');

  const load = () => {
    Promise.all([api.getAuthorizationCatalog(), api.getAuthorizationMatrix()])
      .then(([c, m]) => {
        setCatalog(c);
        setMatrix(m);
        const current = m[role] ?? {};
        setDraft(current);
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (matrix[role]) setDraft(matrix[role]);
  }, [role, matrix]);

  useEffect(() => {
    if (tab !== 'exceptions') return;
    api.getUsers().then(setUsers).catch(() => setUsers([]));
  }, [tab]);

  const sections = useMemo(() => {
    if (!catalog) return [];
    const groups: { section: string; items: AuthorizationCatalog['resources'] }[] = [];
    for (const item of catalog.resources) {
      const g = groups.find((x) => x.section === item.section);
      if (g) g.items.push(item);
      else groups.push({ section: item.section, items: [item] });
    }
    return groups;
  }, [catalog]);

  const locked = (resource: string) => role === 'ADMIN' && resource === 'authorizations';

  const saveRole = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await api.saveRoleAuthorizations(role, draft);
      setMatrix({ ...matrix, [role]: saved.matrix });
      setDraft(saved.matrix);
      setMessage(`Profil ${ROLE_LABELS[role] ?? role} enregistré.`);
      await refreshPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const resetRole = async () => {
    if (!window.confirm('Rétablir les droits par défaut de ce profil ?')) return;
    setSaving(true);
    try {
      const saved = await api.resetRoleAuthorizations(role);
      setMatrix({ ...matrix, [role]: saved.matrix });
      setDraft(saved.matrix);
      setMessage('Droits par défaut rétablis.');
      await refreshPermissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Réinitialisation impossible');
    } finally {
      setSaving(false);
    }
  };

  const toggle = (resource: string, action: AclAction, on: boolean) => {
    if (locked(resource) || !canEdit) return;
    setDraft((prev) => ({
      ...prev,
      [resource]: toggleAction(prev[resource] ?? [], action, on),
    }));
  };

  const toggleRow = (resource: string, on: boolean) => {
    if (locked(resource) || !canEdit) return;
    setDraft((prev) => ({ ...prev, [resource]: on ? [...ACTIONS] : [] }));
  };

  const loadUser = async (id: string) => {
    setUserId(id);
    if (!id) { setDetail(null); return; }
    try {
      setDetail(await api.getUserAuthorizations(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible');
    }
  };

  const addOverride = async (e: FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const next = [
      ...detail.overrides
        .filter((o) => !(o.resource === overrideForm.resource && o.action === overrideForm.action))
        .map((o) => ({
          resource: o.resource,
          action: o.action,
          effect: o.effect === 'DENY' ? 'DENY' as const : 'GRANT' as const,
        })),
      overrideForm,
    ];
    const saved = await api.saveUserAuthorizations(detail.user.id, next);
    setDetail(saved);
    await refreshPermissions();
  };

  const removeOverride = async (resource: string, action: string) => {
    if (!detail) return;
    const saved = await api.saveUserAuthorizations(
      detail.user.id,
      detail.overrides
        .filter((o) => !(o.resource === resource && o.action === action))
        .map((o) => ({
          resource: o.resource,
          action: o.action,
          effect: o.effect === 'DENY' ? 'DENY' as const : 'GRANT' as const,
        })),
    );
    setDetail(saved);
    await refreshPermissions();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Habilitations"
        subtitle="Paramétrage des droits par profil sur tous les modules, menus et fonctions CRUDVN"
        excel={{
          filename: 'habilitations',
          sheets: [
            exportSheet('Matrice', [
              ['profil', 'Profil'], ['module', 'Module'], ['section', 'Section'], ['droits', 'Droits'],
            ], catalog
              ? catalog.resources.flatMap((resource) => catalog.roles.map((item) => ({
                profil: item.label,
                module: resource.label,
                section: resource.section,
                droits: (matrix[item.id]?.[resource.id] ?? []).join(', '),
              })))
              : []),
            exportSheet('Profil courant', [
              ['module', 'Module'], ['droits', 'Droits'],
            ], catalog
              ? catalog.resources.map((resource) => ({
                module: resource.label,
                droits: (draft[resource.id] ?? []).join(', '),
              }))
              : []),
            exportSheet('Exceptions', [
              ['utilisateur', 'Utilisateur'], ['module', 'Module'], ['action', 'Action'], ['effet', 'Effet'],
            ], (detail?.overrides ?? []).map((row) => ({
              utilisateur: detail ? `${detail.user.firstName} ${detail.user.lastName}` : '',
              module: catalog?.resources.find((item) => item.id === row.resource)?.label ?? row.resource,
              action: row.action,
              effet: row.effect,
            }))),
          ],
        }}
        actions={
          <>
            {tab === 'profils' && catalog && (
              <DocButton
                label="Matrice PDF"
                onClick={() => printAuthorizationMatrix(catalog, ROLE_LABELS[role] ?? role, draft)}
              />
            )}
            {tab === 'exceptions' && catalog && detail && (
              <DocButton
                label="Fiche PDF"
                onClick={() => printUserAuthorizationSheet(
                  catalog,
                  `${detail.user.firstName} ${detail.user.lastName}`,
                  detail.effective,
                )}
              />
            )}
            {tab === 'profils' && canEdit && canReset && (
              <button type="button" className="erp-btn erp-btn--ghost" onClick={resetRole}>Rétablir le profil</button>
            )}
            {tab === 'profils' && canEdit && (
              <button type="button" className="erp-btn" onClick={saveRole} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le profil'}</button>
            )}
          </>
        }
      />
      {error && <p className="error-msg">{error}</p>}
      {message && <p className="erp-success">{message}</p>}

      <div className="erp-tabs">
        <button type="button" className={`erp-tab ${tab === 'profils' ? 'active' : ''}`} onClick={() => setTab('profils')}>Par profil</button>
        <button type="button" className={`erp-tab ${tab === 'exceptions' ? 'active' : ''}`} onClick={() => setTab('exceptions')}>Exceptions utilisateur</button>
      </div>

      {tab === 'profils' && catalog && (
        <div className="acl-layout">
          <ErpPanel title="Profils">
            <div className="acl-roles">
              {catalog.roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className={`acl-role ${role === r.id ? 'active' : ''}`}
                  onClick={() => setRole(r.id)}
                >
                  <strong>{r.label}</strong>
                  <span>{r.id}</span>
                </button>
              ))}
            </div>
          </ErpPanel>
          <ErpPanel title={`Droits — ${ROLE_LABELS[role] ?? role}`}>
            <p className="erp-muted" style={{ padding: '8px 12px 0' }}>
              Lire affiche le menu. Créer / Modifier / Supprimer / Valider pilotent les boutons et les API correspondantes.
              {role === 'ADMIN' ? ' L’administrateur conserve un accès de secours au module Habilitations.' : ''}
            </p>
            <div className="acl-scroll">
              <table className="erp-table acl-matrix">
                <thead>
                  <tr>
                    <th>Module / menu</th>
                    {catalog.actions.map((a) => <th key={a.id} title={a.label}>{a.short}</th>)}
                    <th>Tout</th>
                  </tr>
                </thead>
                <tbody>
                  {sections.map((group) => (
                    <Fragment key={group.section}>
                      <tr className="acl-section">
                        <td colSpan={7}>{group.section}</td>
                      </tr>
                      {group.items.map((res) => {
                        const full = ACTIONS.every((a) => has(draft, res.id, a));
                        return (
                          <tr key={res.id}>
                            <td>
                              <strong>{res.label}</strong>
                              <div className="erp-muted">{res.description}</div>
                            </td>
                            {catalog.actions.map((a) => (
                              <td key={a.id} className="acl-cell">
                                <input
                                  type="checkbox"
                                  checked={has(draft, res.id, a.id)}
                                  disabled={!canEdit || locked(res.id)}
                                  onChange={(e) => toggle(res.id, a.id, e.target.checked)}
                                />
                              </td>
                            ))}
                            <td className="acl-cell">
                              <input
                                type="checkbox"
                                checked={full}
                                disabled={!canEdit || locked(res.id)}
                                onChange={(e) => toggleRow(res.id, e.target.checked)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </ErpPanel>
        </div>
      )}

      {tab === 'exceptions' && catalog && (
        <>
          <ErpPanel title="Utilisateur" padded>
            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label>Compte</label>
                <select value={userId} onChange={(e) => loadUser(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} — {ROLE_LABELS[u.role] ?? u.role}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </ErpPanel>
          {detail && (
            <>
              {canEdit && (
                <ErpPanel title="Ajouter une exception" padded>
                  <form className="form-row" onSubmit={addOverride}>
                    <div className="form-group">
                      <label>Module</label>
                      <select value={overrideForm.resource} onChange={(e) => setOverrideForm({ ...overrideForm, resource: e.target.value })}>
                        {catalog.resources.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Fonction</label>
                      <select value={overrideForm.action} onChange={(e) => setOverrideForm({ ...overrideForm, action: e.target.value as AclAction })}>
                        {catalog.actions.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Effet</label>
                      <select value={overrideForm.effect} onChange={(e) => setOverrideForm({ ...overrideForm, effect: e.target.value as 'GRANT' | 'DENY' })}>
                        <option value="GRANT">Accorder (en plus du profil)</option>
                        <option value="DENY">Retirer (malgré le profil)</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ alignSelf: 'end' }}>
                      <button type="submit" className="erp-btn">Ajouter</button>
                    </div>
                  </form>
                </ErpPanel>
              )}
              <ErpPanel title={`Exceptions (${detail.overrides.length})`}>
                <table className="erp-table">
                  <thead>
                    <tr><th>Module</th><th>Fonction</th><th>Effet</th><th></th></tr>
                  </thead>
                  <tbody>
                    {detail.overrides.map((o) => (
                      <tr key={`${o.resource}-${o.action}`}>
                        <td>{catalog.resources.find((r) => r.id === o.resource)?.label ?? o.resource}</td>
                        <td>{catalog.actions.find((a) => a.id === o.action)?.label ?? o.action}</td>
                        <td>{o.effect === 'DENY' ? 'Retiré' : 'Accordé'}</td>
                        <td>
                          {canEdit && (
                            <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => removeOverride(o.resource, o.action)}>
                              Supprimer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!detail.overrides.length && (
                      <tr><td colSpan={4} className="erp-muted">Aucune exception : l’utilisateur suit exactement son profil {ROLE_LABELS[detail.user.role] ?? detail.user.role}.</td></tr>
                    )}
                  </tbody>
                </table>
              </ErpPanel>
            </>
          )}
        </>
      )}
    </div>
  );
}

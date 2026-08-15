import { FormEvent, useEffect, useState } from 'react';
import { api, AuditEntry, MfaStatus, SecurityAlert, SecuritySummary } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel, RingGauge } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

export default function SecurityPage() {
  const { can } = usePermissions();
  const [summary, setSummary] = useState<SecuritySummary | null>(null);
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string; currentCode?: string } | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([
      api.getSecuritySummary().catch(() => null),
      api.getSecurityAlerts().catch(() => []),
      api.getSecurityAudit().catch(() => []),
      api.getMfaStatus(),
    ])
      .then(([s, a, u, m]) => { setSummary(s); setAlerts(a); setAudit(u); setMfa(m); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.confirmMfa(code);
      setMessage('Second facteur confirmé.');
      setSetup(null);
      setCode('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Centre de sécurité"
        subtitle="Alertes, conformité, couverture MFA des comptes sensibles et journal d'audit"
      />
      {error && <p className="error-msg">{error}</p>}
      {message && <p className="erp-success">{message}</p>}

      {summary && (
        <div className="erp-kpi-mini-row">
          <div className="erp-kpi-mini">
            <div className="erp-kpi-mini-icon erp-kpi-mini-icon--red">⚠</div>
            <div>
              <div className="erp-kpi-mini-label">Alertes ouvertes</div>
              <div className="erp-kpi-mini-value">{summary.openAlerts}</div>
            </div>
          </div>
          <div className="erp-kpi-mini">
            <div className="erp-kpi-mini-icon erp-kpi-mini-icon--orange">⛔</div>
            <div>
              <div className="erp-kpi-mini-label">Critiques</div>
              <div className="erp-kpi-mini-value">{summary.criticalAlerts}</div>
            </div>
          </div>
          <div className="erp-kpi-mini">
            <div className="erp-kpi-mini-icon erp-kpi-mini-icon--blue">🔑</div>
            <div>
              <div className="erp-kpi-mini-label">Échecs 24 h</div>
              <div className="erp-kpi-mini-value">{summary.failedLoginsLast24h}</div>
            </div>
          </div>
          <div className="erp-kpi-mini">
            <div className="erp-kpi-mini-icon erp-kpi-mini-icon--green">◉</div>
            <div>
              <div className="erp-kpi-mini-label">Couverture MFA sensibles</div>
              <div className="erp-kpi-mini-value">{Math.round(summary.mfaCoveragePct)} %</div>
            </div>
          </div>
        </div>
      )}

      {can('security', 'read') && summary && (
        <ErpPanel title="Couverture des comptes sensibles" padded>
          <RingGauge value={Math.round(summary.mfaCoveragePct)} label={`${summary.mfaEnabledCount} / ${summary.sensitiveAccountsCount} protégés`} color="#c9302c" />
        </ErpPanel>
      )}

      {can('security', 'read') && (
        <ErpPanel title="Alertes">
          <table className="erp-table">
            <thead><tr><th>Type</th><th>Sévérité</th><th>Statut</th><th>Message</th><th>Quand</th><th></th></tr></thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td>{a.kind}</td>
                  <td><StatusPill status={a.severity} /></td>
                  <td><StatusPill status={a.status} /></td>
                  <td>{a.message}<div className="erp-muted">{a.email} {a.ipAddress}</div></td>
                  <td>{new Date(a.createdAt).toLocaleString('fr-FR')}</td>
                  <td>
                    {can('security', 'update') && a.status === 'OUVERTE' && (
                      <>
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.updateSecurityAlert(a.id, 'ANALYSEE').then(load)}>Analyser</button>
                        {' '}
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.updateSecurityAlert(a.id, 'CLOTUREE').then(load)}>Clôturer</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!alerts.length && <tr><td colSpan={6} className="erp-muted">Aucune alerte.</td></tr>}
            </tbody>
          </table>
        </ErpPanel>
      )}

      <ErpPanel title="Mon second facteur" padded>
        {mfa && (
          <p>
            Statut : {mfa.confirmed ? 'activé' : mfa.enabled ? 'en attente de confirmation' : 'inactif'}
            {mfa.sensitiveRole ? ' · profil sensible (double facteur requis)' : ''}
          </p>
        )}
        {!mfa?.confirmed && (
          <button type="button" className="erp-btn" onClick={() => api.setupMfa().then(setSetup)}>Générer un secret TOTP</button>
        )}
        {setup && (
          <form onSubmit={confirm} className="form-row" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Secret</label>
              <input readOnly value={setup.secret} />
            </div>
            <div className="form-group">
              <label>Code à 6 chiffres</label>
              <input value={code} onChange={(e) => setCode(e.target.value)} required pattern="\d{6}" />
            </div>
            {setup.currentCode && <p className="erp-muted">Code de démonstration : {setup.currentCode}</p>}
            <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Confirmer</button></div>
          </form>
        )}
        {mfa?.confirmed && (
          <form onSubmit={(e) => { e.preventDefault(); api.disableMfa(code).then(() => { setMessage('MFA désactivé.'); load(); }); }} className="form-row">
            <div className="form-group"><label>Code pour désactiver</label><input value={code} onChange={(e) => setCode(e.target.value)} required /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn erp-btn--ghost">Désactiver</button></div>
          </form>
        )}
      </ErpPanel>

      {can('security', 'read') && (
        <ErpPanel title="Journal d'audit">
          <table className="erp-table">
            <thead><tr><th>Action</th><th>Entité</th><th>Utilisateur</th><th>IP</th><th>Quand</th></tr></thead>
            <tbody>
              {audit.map((e) => (
                <tr key={e.id}>
                  <td>{e.action}</td>
                  <td>{e.entityType} · {e.entityId.slice(0, 8)}</td>
                  <td>{e.user ? `${e.user.firstName} ${e.user.lastName}` : '—'}</td>
                  <td>{e.ipAddress ?? '—'}</td>
                  <td>{new Date(e.createdAt).toLocaleString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      )}
    </div>
  );
}

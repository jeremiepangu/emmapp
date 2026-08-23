import { FormEvent, useEffect, useState } from 'react';
import { api, ActivityOverview, ActivityReportDetail } from '../api';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ROLE_LABELS } from '../permissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import { printActivityOverview, printActivitySheet } from '../documents/templates';
import { exportSheet } from '../excel/specs';

type Tab = 'overview' | 'mine';

export default function ActivityPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const isManager = can('activity', 'validate');
  const [tab, setTab] = useState<Tab>(isManager ? 'overview' : 'mine');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mine, setMine] = useState<ActivityReportDetail | null>(null);
  const [overview, setOverview] = useState<ActivityOverview | null>(null);
  const [summary, setSummary] = useState('');
  const [incidents, setIncidents] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState<ActivityReportDetail | null>(null);

  const loadMine = () => {
    api.getMyActivityReport(date).then((data) => {
      setMine(data);
      setSummary(data.summary ?? '');
      setIncidents(data.incidents ?? '');
    }).catch(() => setMine(null));
  };

  const loadOverview = () => {
    if (!isManager) return;
    api.getActivityOverview(date).then(setOverview).catch(() => setOverview(null));
  };

  useEffect(() => {
    loadMine();
    loadOverview();
  }, [date, isManager]);

  const saveMine = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await api.saveMyActivityReport({ date, summary, incidents });
      setMessage('Rapport enregistré');
      loadMine();
      loadOverview();
    } catch {
      setMessage('Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  const openAgent = async (userId: string) => {
    const data = await api.getAgentActivityReport(userId, date);
    setDetail(data);
  };

  const validate = async (reportId: string) => {
    await api.validateActivityReport(reportId);
    loadOverview();
    if (detail?.report?.id === reportId) {
      setDetail({ ...detail, report: { ...detail.report, validated: true } });
    }
  };

  const money = (n: number) => `${n.toLocaleString('fr-FR')} CDF`;

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Rapports d’activité"
        subtitle={isManager ? 'Suivi quotidien des agents et validation managers' : 'Votre rapport d’activité du jour'}
        excel={{
          filename: 'activite',
          sheets: [
            exportSheet('Synthese', [['indicateur', 'Indicateur'], ['valeur', 'Valeur']], overview ? [
              { indicateur: 'Agents', valeur: overview.totals.agents },
              { indicateur: 'Soumis', valeur: overview.totals.submitted },
              { indicateur: 'Valides', valeur: overview.totals.validated },
              { indicateur: 'Livraisons', valeur: overview.totals.deliveries },
            ] : []),
            exportSheet('Agents', [['agent', 'Agent'], ['deliveries', 'Livraisons'], ['tours', 'Tournees'], ['submitted', 'Soumis']], (overview?.rows ?? []).map((row) => ({
              agent: `${row.user.firstName} ${row.user.lastName}`,
              deliveries: row.deliveries,
              tours: row.tours,
              submitted: row.submitted ? 'Oui' : 'Non',
            }))),
          ],
        }}
        actions={
          <>
            <label className="form-group" style={{ margin: 0 }}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {tab === 'overview' && overview && (
              <DocButton label="Synthèse" onClick={() => printActivityOverview(overview)} />
            )}
            {tab === 'mine' && mine && (
              <DocButton label="Mon rapport" onClick={() => printActivitySheet(mine)} />
            )}
            {tab === 'mine' && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('activity-form')?.scrollIntoView({ behavior: 'smooth' })}>
                + Enregistrer
              </button>
            )}
          </>
        }
      />

      {isManager && (
        <div className="erp-tabs">
          <button type="button" className={`erp-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Vue générale</button>
          <button type="button" className={`erp-tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>Mon rapport</button>
        </div>
      )}

      {tab === 'overview' && isManager && overview && (
        <>
          <div className="erp-kpi-row">
            <div className="erp-kpi"><div className="erp-kpi-label">Agents</div><div className="erp-kpi-value">{overview.totals.agents}</div></div>
            <div className="erp-kpi erp-kpi--blue"><div className="erp-kpi-label">Rapports soumis</div><div className="erp-kpi-value">{overview.totals.submitted}</div></div>
            <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Validés</div><div className="erp-kpi-value">{overview.totals.validated}</div></div>
            <div className="erp-kpi erp-kpi--orange"><div className="erp-kpi-label">Livraisons</div><div className="erp-kpi-value">{overview.totals.deliveries}</div></div>
            <div className="erp-kpi"><div className="erp-kpi-label">Encaissements</div><div className="erp-kpi-value">{money(overview.totals.paymentsAmount)}</div></div>
          </div>
          <ErpPanel title={`Activité du ${date}`}>
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Profil</th>
                  <th>Livraisons</th>
                  <th>Tournées</th>
                  <th>Shifts</th>
                  <th>Encaissements</th>
                  <th>Rapport</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {overview.rows.map((row) => (
                  <tr key={row.user.id}>
                    <td><strong>{row.user.firstName} {row.user.lastName}</strong></td>
                    <td>{ROLE_LABELS[row.user.role] ?? row.user.role}</td>
                    <td>{row.deliveries} ({row.delivered} livrées)</td>
                    <td>{row.tours}</td>
                    <td>{row.shifts}</td>
                    <td>{money(row.paymentsAmount)}</td>
                    <td>
                      {row.validated ? <StatusPill status="VALIDE" label="Validé" /> : row.submitted ? <StatusPill status="SOUMIS" label="Soumis" /> : <StatusPill status="ATTENTE" label="Absent" />}
                    </td>
                    <td className="erp-row-actions">
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openAgent(row.user.id)}>Détail</button>
                      {row.reportId && !row.validated && (
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => validate(row.reportId!)}>Valider</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'mine' && (
        <>
          {mine && (
            <div className="erp-kpi-row">
              <div className="erp-kpi erp-kpi--blue"><div className="erp-kpi-label">Livraisons</div><div className="erp-kpi-value">{mine.metrics.deliveries}</div></div>
              <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Livrées</div><div className="erp-kpi-value">{mine.metrics.delivered}</div></div>
              <div className="erp-kpi"><div className="erp-kpi-label">Tournées</div><div className="erp-kpi-value">{mine.metrics.tours}</div></div>
              <div className="erp-kpi erp-kpi--orange"><div className="erp-kpi-label">Quantité</div><div className="erp-kpi-value">{mine.metrics.qtyDelivered}</div></div>
              <div className="erp-kpi"><div className="erp-kpi-label">Encaissé</div><div className="erp-kpi-value">{money(mine.metrics.paymentsAmount)}</div></div>
            </div>
          )}
          <ErpPanel title={`Rapport de ${user?.firstName ?? ''} ${user?.lastName ?? ''}`}>
            <form id="activity-form" className="form-stack" onSubmit={saveMine}>
              <div className="form-group">
                <label>Résumé de la journée</label>
                <textarea rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Tournées, clients visités, points d’attention…" />
              </div>
              <div className="form-group">
                <label>Incidents</label>
                <textarea rows={3} value={incidents} onChange={(e) => setIncidents(e.target.value)} placeholder="Aucun incident, ou décrire les faits" />
              </div>
              {mine?.report?.validated && <p className="muted">Ce rapport a déjà été validé. Une nouvelle saisie le remettra en attente.</p>}
              {message && <p className={message.includes('impossible') ? 'error-msg' : 'muted'}>{message}</p>}
              <button type="submit" className="erp-btn" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer mon rapport'}</button>
            </form>
          </ErpPanel>
        </>
      )}

      <Modal title={detail ? `Activité — ${detail.user.firstName} ${detail.user.lastName}` : ''} open={!!detail} onClose={() => setDetail(null)} wide>
        {detail && (
          <div className="form-stack">
            <p className="muted">{ROLE_LABELS[detail.user.role] ?? detail.user.role} · {detail.date}</p>
            <div className="erp-kpi-row">
              <div className="erp-kpi"><div className="erp-kpi-label">Livraisons</div><div className="erp-kpi-value">{detail.metrics.deliveries}</div></div>
              <div className="erp-kpi"><div className="erp-kpi-label">Tournées</div><div className="erp-kpi-value">{detail.metrics.tours}</div></div>
              <div className="erp-kpi"><div className="erp-kpi-label">Encaissé</div><div className="erp-kpi-value">{money(detail.metrics.paymentsAmount)}</div></div>
            </div>
            <p><strong>Résumé :</strong> {detail.summary || '—'}</p>
            <p><strong>Incidents :</strong> {detail.incidents || 'Aucun'}</p>
            <DocButton label="Fiche agent" onClick={() => printActivitySheet(detail)} />
            {detail.report && !detail.report.validated && (
              <button type="button" className="erp-btn" onClick={() => validate(detail.report!.id)}>Valider ce rapport</button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

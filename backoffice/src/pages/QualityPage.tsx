import { useEffect, useState, FormEvent } from 'react';
import { api, QualityCheck } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printQualityList, printQualityReport } from '../documents/templates';

export default function QualityPage() {
  const { can } = usePermissions();
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [editing, setEditing] = useState<QualityCheck | null>(null);
  const [form, setForm] = useState({ lotNumber: '', ph: 7.0, chlorineFree: 0.3, tds: 50, turbidity: 0.5, microbiologyOk: true });

  const load = () => api.getQualityChecks().then(setChecks);

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (editing) await api.updateQualityCheck(editing.id, form);
    else await api.createQualityCheck(form);
    setEditing(null);
    setForm({ lotNumber: '', ph: 7.0, chlorineFree: 0.3, tds: 50, turbidity: 0.5, microbiologyOk: true });
    await load();
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Contrôle qualité"
        subtitle="Analyses physico-chimiques et microbiologiques — workflow quarantaine / libération"
        actions={
          <>
            <DocButton label="Imprimer le registre" onClick={() => printQualityList(checks)} />
            {can('quality', 'create') && (
              <button
                type="button"
                className="erp-btn"
                onClick={() => {
                  setEditing(null);
                  setForm({ lotNumber: '', ph: 7.0, chlorineFree: 0.3, tds: 50, turbidity: 0.5, microbiologyOk: true });
                  document.getElementById('quality-form')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                + Nouveau contrôle
              </button>
            )}
          </>
        }
      />
      {(can('quality', 'create') || editing) && (
        <ErpPanel title={editing ? 'Modifier le contrôle' : 'Nouveau contrôle'} padded>
          <form id="quality-form" onSubmit={handleSubmit} className="form-row">
            <div className="form-group"><label>N° lot</label><input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} required /></div>
            <div className="form-group"><label>pH</label><input type="number" step="0.1" value={form.ph} onChange={(e) => setForm({ ...form, ph: Number(e.target.value) })} /></div>
            <div className="form-group"><label>Chlore libre</label><input type="number" step="0.01" value={form.chlorineFree} onChange={(e) => setForm({ ...form, chlorineFree: Number(e.target.value) })} /></div>
            <div className="form-group"><label>TDS</label><input type="number" value={form.tds} onChange={(e) => setForm({ ...form, tds: Number(e.target.value) })} /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Enregistrer'}</button>
              {editing && (
                <button type="button" className="erp-btn erp-btn--ghost" onClick={() => { setEditing(null); setForm({ lotNumber: '', ph: 7.0, chlorineFree: 0.3, tds: 50, turbidity: 0.5, microbiologyOk: true }); }}>Annuler</button>
              )}
            </div>
          </form>
        </ErpPanel>
      )}
      <ErpPanel title={`Contrôles enregistrés (${checks.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Lot</th><th>pH</th><th>TDS</th><th>Microbio</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <tr key={c.id}>
                <td><code>{c.lotNumber}</code></td>
                <td>{c.ph ?? '—'}</td>
                <td>{c.tds ?? '—'}</td>
                <td>{c.microbiologyOk ? 'OK' : '—'}</td>
                <td><StatusPill status={c.status} /></td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printQualityReport(c)} />
                  {can('quality', 'validate') && c.status === 'EN_ATTENTE' && (
                    <>
                      <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateQualityCheck(c.id, true).then(load)}>Conforme</button>
                      {' '}
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.validateQualityCheck(c.id, false).then(load)}>Bloquer</button>
                    </>
                  )}
                  {can('quality', 'update') && c.status === 'EN_ATTENTE' && (
                    <button
                      type="button"
                      className="erp-btn erp-btn--sm erp-btn--ghost"
                      onClick={() => {
                        setForm({
                          lotNumber: c.lotNumber,
                          ph: c.ph ?? 7,
                          chlorineFree: c.chlorineFree ?? 0.3,
                          tds: c.tds ?? 50,
                          turbidity: c.turbidity ?? 0.5,
                          microbiologyOk: c.microbiologyOk ?? true,
                        });
                        setEditing(c);
                      }}
                    >
                      Modifier
                    </button>
                  )}
                  {can('quality', 'delete') && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteQualityCheck(c.id).then(load)}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}


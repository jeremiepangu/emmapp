import { FormEvent, useEffect, useState } from 'react';
import { api, PayrollPeriod, Payslip } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printPayrollPeriodsList, printPayrollRegister, printPayslip } from '../documents/templates';
import { exportSheet } from '../excel/specs';

const MONTHS = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function money(n: string | number) {
  return `${Number(n).toLocaleString('fr-CD')} CDF`;
}

export default function PayrollPage() {
  const { can } = usePermissions();
  const now = new Date();
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [selected, setSelected] = useState<PayrollPeriod | null>(null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [form, setForm] = useState({ year: now.getFullYear(), month: now.getMonth() + 1, expectedDays: 26 });
  const [busy, setBusy] = useState('');

  const load = async () => {
    const list = await api.getPayrollPeriods();
    setPeriods(list);
    if (selected) {
      const fresh = list.find((p) => p.id === selected.id) ?? list[0] ?? null;
      setSelected(fresh);
      if (fresh) setPayslips(await api.getPayslips(fresh.id));
    }
  };

  useEffect(() => { api.getPayrollPeriods().then(setPeriods); }, []);

  const open = async (period: PayrollPeriod) => {
    setSelected(period);
    setPayslips(await api.getPayslips(period.id));
  };

  const createPeriod = async (e: FormEvent) => {
    e.preventDefault();
    const created = await api.createPayrollPeriod(form);
    await load();
    await open(created);
  };

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label);
    try {
      await fn();
      await load();
      if (selected) setPayslips(await api.getPayslips(selected.id));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Paie des agents"
        subtitle="Périodes mensuelles, calcul CNSS / IPRF, validation et paiement des bulletins"
        excel={{
          filename: 'paie',
          sheets: [
            exportSheet('Periodes', [['year', 'Annee'], ['month', 'Mois'], ['status', 'Statut'], ['expectedDays', 'Jours']], periods.map((row) => ({ year: row.year, month: row.month, status: row.status, expectedDays: row.expectedDays }))),
            exportSheet('Bulletins', [['agent', 'Agent'], ['gross', 'Brut'], ['net', 'Net'], ['status', 'Statut']], payslips.map((row) => ({
              agent: row.user ? `${row.user.firstName} ${row.user.lastName}` : row.employee?.matricule ?? '',
              gross: Number(row.grossPay),
              net: Number(row.netPay),
              status: row.status,
            }))),
          ],
        }}
        actions={(
          <>
            <DocButton
              label={selected ? 'Registre de paie' : 'Périodes'}
              onClick={() => selected ? printPayrollRegister(payslips, selected) : printPayrollPeriodsList(periods)}
            />
            {can('payroll', 'create') && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('payroll-form')?.scrollIntoView({ behavior: 'smooth' })}>
                + Nouvelle période
              </button>
            )}
          </>
        )}
      />
      {can('payroll', 'create') && (
        <ErpPanel title="Nouvelle période" padded>
          <form id="payroll-form" className="form-row" onSubmit={createPeriod}>
            <div className="form-group"><label>Année</label><input type="number" min={2020} value={form.year} onChange={(e) => setForm({ ...form, year: Number(e.target.value) })} /></div>
            <div className="form-group">
              <label>Mois</label>
              <select value={form.month} onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Jours ouvrés</label><input type="number" min={1} max={31} value={form.expectedDays} onChange={(e) => setForm({ ...form, expectedDays: Number(e.target.value) })} /></div>
            <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Créer</button></div>
          </form>
        </ErpPanel>
      )}
      <ErpPanel title={`Périodes (${periods.length})`}>
        <table className="erp-table">
          <thead>
            <tr><th>Période</th><th>Jours</th><th>Bulletins</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p.id} className={selected?.id === p.id ? 'is-selected' : undefined}>
                <td><strong>{MONTHS[p.month - 1]} {p.year}</strong></td>
                <td>{p.expectedDays}</td>
                <td>{p._count?.payslips ?? 0}</td>
                <td><StatusPill status={p.status} label={p.status} /></td>
                <td className="erp-row-actions">
                  <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => open(p)}>Ouvrir</button>
                  {can('payroll', 'create') && p.status !== 'CLOTUREE' && (
                    <button type="button" className="erp-btn erp-btn--sm" disabled={!!busy} onClick={() => run('calc', () => api.computePayroll(p.id).then((r) => open(r)))}>Calculer</button>
                  )}
                  {can('payroll', 'validate') && p.status === 'CALCULEE' && (
                    <button type="button" className="erp-btn erp-btn--sm" disabled={!!busy} onClick={() => run('val', () => api.validatePayrollPeriod(p.id))}>Valider</button>
                  )}
                  {can('payroll', 'validate') && p.status === 'VALIDEE' && (
                    <button type="button" className="erp-btn erp-btn--sm" disabled={!!busy} onClick={() => run('pay', () => api.closePayrollPeriod(p.id))}>Payer / clôturer</button>
                  )}
                  {can('payroll', 'delete') && p.status !== 'CLOTUREE' && (
                    <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deletePayrollPeriod(p.id).then(() => { setSelected(null); setPayslips([]); return load(); })}>Supprimer</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      {selected && (
        <div style={{ marginTop: 18 }}>
          <ErpPanel title={`Bulletins — ${MONTHS[selected.month - 1]} ${selected.year}`}>
            <table className="erp-table">
              <thead>
                <tr><th>Agent</th><th>Matricule</th><th>Jours</th><th>Brut</th><th>CNSS</th><th>IPRF</th><th>Net</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {payslips.map((s) => (
                  <tr key={s.id}>
                    <td>{s.user ? `${s.user.firstName} ${s.user.lastName}` : '—'}</td>
                    <td>{s.employee?.matricule ?? '—'}</td>
                    <td>{s.workedDays}</td>
                    <td>{money(s.grossPay)}</td>
                    <td>{money(s.cnssEmployee)}</td>
                    <td>{money(s.iprf)}</td>
                    <td><strong>{money(s.netPay)}</strong></td>
                    <td><StatusPill status={s.status} label={s.status} /></td>
                    <td className="erp-row-actions">
                      <DocButton label="Bulletin" onClick={() => printPayslip(s, selected)} />
                      {can('payroll', 'validate') && s.status === 'BROUILLON' && (
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validatePayslip(s.id).then(() => open(selected))}>Valider</button>
                      )}
                      {can('payroll', 'update') && s.status === 'VALIDEE' && (
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.payPayslip(s.id).then(() => open(selected))}>Payer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </div>
      )}
    </div>
  );
}

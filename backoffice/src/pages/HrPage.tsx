import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import {
  api,
  ActivityDeclaration,
  ActivityObjective,
  EmployeeProfile,
  HrDashboard,
  HrDocument,
  JobFunction,
  LeaveBalance,
  LeaveRequest,
  PerformanceObjective,
  PerformanceReview,
  ShiftAssignment,
  TrainingCourse,
  TrainingEnrollment,
  User,
} from '../api';
import { useAuth } from '../AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ROLE_LABELS } from '../permissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import DocButton from '../components/DocButton';
import {
  printEmployeeSheet,
  printEmployeesList,
  printEmploymentCertificate,
  printEvaluationSheet,
  printHrCoursesList,
  printHrDashboard,
  printHrDeclarationsList,
  printHrDocumentsList,
  printHrEnrollmentsList,
  printHrFunctionsList,
  printHrObjectivesList,
  printJobActivityCanvas,
  printLeaveCertificate,
  printLeaveRequest,
  printLeavesList,
  printShiftSheet,
  printShiftsList,
  printWorkCertificate,
  printGenericReport,
} from '../documents/templates';
import { exportSheet, sheetEmployees, sheetLeaves } from '../excel/specs';
import {
  KINSHASA_DISTRICTS,
  KINSHASA_PROVINCE,
  communesForDistrict,
  districtForCommune,
  quartiersForCommune,
} from '../data/kinshasa';

const CONTRACTS = ['CDI', 'CDD', 'STAGE', 'PRESTATION', 'JOURNALIER'];
const DEPARTMENTS = ['Direction', 'Production', 'Exploitation', 'Qualité', 'Commercial', 'Finance', 'RH', 'IT'];
const LEAVE_TYPES = [
  { id: 'CONGE_PAYE', label: 'Congé annuel' },
  { id: 'MALADIE', label: 'Congé maladie' },
  { id: 'MATERNITE', label: 'Congé maternité' },
  { id: 'PATERNITE', label: 'Congé paternité' },
  { id: 'PERMISSION', label: 'Permission exceptionnelle' },
  { id: 'AUTORISATION', label: 'Autorisation' },
  { id: 'SANS_SOLDE', label: 'Congé sans solde' },
  { id: 'ABSENCE_INJUSTIFIEE', label: 'Absence injustifiée' },
];
const DOC_TYPES = [
  { id: 'CONTRAT', label: 'Contrat de travail' },
  { id: 'PIECE_IDENTITE', label: 'Pièce d’identité' },
  { id: 'DIPLOME', label: 'Diplôme' },
  { id: 'CV', label: 'Curriculum vitae' },
  { id: 'ATTESTATION', label: 'Attestation' },
  { id: 'AVENANT', label: 'Avenant' },
  { id: 'CERTIFICAT_FORMATION', label: 'Certificat de formation' },
  { id: 'JUSTIFICATIF', label: 'Justificatif' },
  { id: 'AUTRE', label: 'Autre' },
];

type Tab = 'dashboard' | 'personnel' | 'conges' | 'activites' | 'performance' | 'formations' | 'documents' | 'shifts';

function csv(name: string, headers: string[], rows: string[][]) {
  const body = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
}

const emptyEmp = {
  userId: '', jobTitle: '', department: 'Exploitation', contractType: 'CDI',
  hireDate: new Date().toISOString().slice(0, 10), endDate: '', baseSalary: 450000, matricule: '',
  gender: '', birthDate: '', maritalStatus: '', emergencyName: '', emergencyPhone: '',
  avenue: '', avenueNumber: '', quartier: '', commune: '', district: '', photoUrl: '',
  managerId: '', jobFunctionId: '', annualLeaveDays: 24, cnssNumber: '', bankName: '', bankAccount: '',
};

export default function HrPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const writeMaster = can('hr', 'delete');
  const canValidate = can('hr', 'validate');
  const [tab, setTab] = useState<Tab>('dashboard');
  const [users, setUsers] = useState<User[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [shifts, setShifts] = useState<ShiftAssignment[]>([]);
  const [shiftDate, setShiftDate] = useState(new Date().toISOString().slice(0, 10));
  const [dash, setDash] = useState<HrDashboard | null>(null);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [functions, setFunctions] = useState<JobFunction[]>([]);
  const [myActs, setMyActs] = useState<{ id: string; name: string }[]>([]);
  const [declarations, setDeclarations] = useState<ActivityDeclaration[]>([]);
  const [activityObjectives, setActivityObjectives] = useState<ActivityObjective[]>([]);
  const [objectives, setObjectives] = useState<PerformanceObjective[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [enrollments, setEnrollments] = useState<TrainingEnrollment[]>([]);
  const [docs, setDocs] = useState<HrDocument[]>([]);
  const [calendar, setCalendar] = useState<LeaveRequest[]>([]);
  const [deptFilter, setDeptFilter] = useState('');
  const [showEmployee, setShowEmployee] = useState(false);
  const [editing, setEditing] = useState<EmployeeProfile | null>(null);
  const [empForm, setEmpForm] = useState(emptyEmp);
  const [leaveForm, setLeaveForm] = useState({
    userId: '', type: 'CONGE_PAYE', startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10), reason: '',
  });
  const [shiftForm, setShiftForm] = useState({
    userId: '', date: new Date().toISOString().slice(0, 10), startTime: '07:00', endTime: '15:00', postLabel: 'Opérateur production',
  });
  const [fnForm, setFnForm] = useState({ name: '', department: 'Exploitation', activities: '' });
  const [declForm, setDeclForm] = useState({ activityId: '', date: new Date().toISOString().slice(0, 10), comment: '' });
  const [objForm, setObjForm] = useState({ userId: '', title: '', year: new Date().getFullYear(), weight: 25, periodType: 'ANNUEL' });
  const [courseForm, setCourseForm] = useState({ title: '', kind: 'INTERNE', provider: '', location: '' });
  const [docForm, setDocForm] = useState({ employeeId: '', type: 'CONTRAT', title: '', fileUrl: '' });
  const [docQuery, setDocQuery] = useState('');
  const [selfScores, setSelfScores] = useState<Record<string, number>>({});
  const [selfComment, setSelfComment] = useState('');

  const communes = useMemo(() => communesForDistrict(empForm.district), [empForm.district]);
  const quartiers = useMemo(() => quartiersForCommune(empForm.commune), [empForm.commune]);

  const loadCore = () => {
    api.getEmployees().then(setEmployees).catch(() => setEmployees([]));
    api.getLeaves().then(setLeaves).catch(() => api.getMyLeaves().then(setLeaves).catch(() => setLeaves([])));
    api.getHrDashboard({ department: deptFilter || undefined }).then(setDash).catch(() => setDash(null));
    api.getLeaveBalance().then(setBalance).catch(() => setBalance(null));
    api.getJobFunctions().then(setFunctions).catch(() => setFunctions([]));
    api.getMyJobActivities().then(setMyActs).catch(() => setMyActs([]));
    api.getActivityDeclarations().then(setDeclarations).catch(() => setDeclarations([]));
    api.getActivityObjectives().then(setActivityObjectives).catch(() => setActivityObjectives([]));
    api.getObjectives(undefined, new Date().getFullYear()).then(setObjectives).catch(() => setObjectives([]));
    api.getReviews(new Date().getFullYear()).then(setReviews).catch(() => setReviews([]));
    api.getTrainings().then(setCourses).catch(() => setCourses([]));
    api.getTrainingEnrollments().then(setEnrollments).catch(() => setEnrollments([]));
    api.getHrDocuments({ q: docQuery || undefined }).then(setDocs).catch(() => setDocs([]));
    const start = new Date();
    start.setDate(1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    api.getLeaveCalendar(start.toISOString().slice(0, 10), end.toISOString().slice(0, 10), deptFilter || undefined)
      .then(setCalendar).catch(() => setCalendar([]));
    api.getShiftAssignments(shiftDate).then(setShifts).catch(() => setShifts([]));
  };

  useEffect(() => { api.getUsers().then((all) => setUsers(all.filter((u) => u.isActive !== false))); }, []);
  useEffect(() => { loadCore(); }, [shiftDate, deptFilter]);

  const saveEmployee = async (e: FormEvent) => {
    e.preventDefault();
    const payload = {
      ...empForm,
      baseSalary: Number(empForm.baseSalary),
      annualLeaveDays: Number(empForm.annualLeaveDays),
      endDate: empForm.endDate || undefined,
      gender: empForm.gender || undefined,
      birthDate: empForm.birthDate || undefined,
      maritalStatus: empForm.maritalStatus || undefined,
      managerId: empForm.managerId || undefined,
      jobFunctionId: empForm.jobFunctionId || undefined,
      photoUrl: empForm.photoUrl || undefined,
      province: KINSHASA_PROVINCE,
    };
    if (editing) await api.updateEmployee(editing.id, payload);
    else await api.createEmployee(payload);
    setShowEmployee(false);
    setEditing(null);
    await loadCore();
  };

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 400_000) return;
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsDataURL(file);
    });
    setEmpForm({ ...empForm, photoUrl: dataUrl });
  };

  const myObjectives = objectives.filter((o) => o.userId === user?.id);

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Administration RH"
        subtitle="SIRH — personnel, congés, activités, évaluations, formations et documents"
        excel={{
          filename: 'rh',
          sheets: [
            sheetEmployees(employees, can('hr', 'update')),
            sheetLeaves(leaves),
            exportSheet('Fonctions', [['name', 'Fonction'], ['department', 'Service']], functions.map((row) => ({ name: row.name, department: row.department ?? '' }))),
            exportSheet('Declarations', [['agent', 'Agent'], ['status', 'Statut'], ['date', 'Date']], declarations.map((row) => ({ agent: `${row.user?.firstName ?? ''} ${row.user?.lastName ?? ''}`.trim(), status: row.status, date: row.date ?? '' }))),
            exportSheet('Objectifs RH', [['title', 'Objectif'], ['year', 'Annee'], ['weight', 'Poids']], objectives.map((row) => ({ title: row.title, year: row.year, weight: row.weight }))),
            exportSheet('Formations', [['title', 'Formation'], ['kind', 'Type']], courses.map((row) => ({ title: row.title, kind: row.kind ?? '' }))),
          ],
        }}
        actions={
          <>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
              <option value="">Tous les services</option>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            {tab === 'dashboard' && dash && <DocButton label="Tableau de bord" onClick={() => printHrDashboard(dash)} />}
            {tab === 'personnel' && <DocButton label="Registre" onClick={() => printEmployeesList(employees)} />}
            {tab === 'conges' && <DocButton label="Registre" onClick={() => printLeavesList(leaves)} />}
            {tab === 'activites' && (
              <>
                <DocButton label="Fonctions" onClick={() => printHrFunctionsList(functions)} />
                <DocButton label="Déclarations" onClick={() => printHrDeclarationsList(declarations)} />
              </>
            )}
            {tab === 'performance' && <DocButton label="Objectifs" onClick={() => printHrObjectivesList(objectives)} />}
            {tab === 'formations' && (
              <>
                <DocButton label="Catalogue" onClick={() => printHrCoursesList(courses)} />
                <DocButton label="Inscriptions" onClick={() => printHrEnrollmentsList(enrollments)} />
              </>
            )}
            {tab === 'documents' && <DocButton label="Archives" onClick={() => printHrDocumentsList(docs)} />}
            {tab === 'shifts' && <DocButton label="Planning" onClick={() => printShiftsList(shifts, shiftDate)} />}
            {writeMaster && tab === 'personnel' && (
              <button type="button" className="erp-btn" onClick={() => { setEditing(null); setEmpForm(emptyEmp); setShowEmployee(true); }}>+ Nouveau dossier</button>
            )}
            {tab === 'conges' && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('hr-leave-form')?.scrollIntoView({ behavior: 'smooth' })}>+ Nouvelle demande</button>
            )}
            {writeMaster && tab === 'activites' && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('hr-function-form')?.scrollIntoView({ behavior: 'smooth' })}>+ Fonction</button>
            )}
            {writeMaster && tab === 'performance' && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('hr-objective-form')?.scrollIntoView({ behavior: 'smooth' })}>+ Objectif</button>
            )}
            {writeMaster && tab === 'formations' && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('hr-course-form')?.scrollIntoView({ behavior: 'smooth' })}>+ Formation</button>
            )}
            {writeMaster && tab === 'documents' && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('hr-doc-form')?.scrollIntoView({ behavior: 'smooth' })}>+ Document</button>
            )}
            {writeMaster && tab === 'shifts' && (
              <button type="button" className="erp-btn" onClick={() => document.getElementById('hr-shift-form')?.scrollIntoView({ behavior: 'smooth' })}>+ Planifier</button>
            )}
          </>
        }
      />
      <div className="erp-tabs">
        {([
          ['dashboard', 'Tableau de bord'],
          ['personnel', 'Personnel'],
          ['conges', 'Congés'],
          ['activites', 'Activités'],
          ['performance', 'Évaluations'],
          ['formations', 'Formations'],
          ['documents', 'Documents'],
          ['shifts', 'Shifts'],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={`erp-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'dashboard' && dash && (
        <>
          <div className="erp-kpi-row">
            <div className="erp-kpi"><div className="erp-kpi-label">Effectif actif</div><div className="erp-kpi-value">{dash.effectifs.total}</div></div>
            <div className="erp-kpi erp-kpi--blue"><div className="erp-kpi-label">Absents aujourd’hui</div><div className="erp-kpi-value">{dash.conges.absentToday}</div></div>
            <div className="erp-kpi erp-kpi--orange"><div className="erp-kpi-label">Congés consommés</div><div className="erp-kpi-value">{dash.conges.consumed} j</div></div>
            <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Activités validées</div><div className="erp-kpi-value">{dash.activites.rate}%</div></div>
            <div className="erp-kpi"><div className="erp-kpi-label">Performance moyenne</div><div className="erp-kpi-value">{dash.performance.average}</div></div>
          </div>
          <ErpPanel title="Répartition par service">
            <table className="erp-table">
              <thead><tr><th>Service</th><th>Effectif</th></tr></thead>
              <tbody>{Object.entries(dash.effectifs.byDepartment).map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody>
            </table>
          </ErpPanel>
          <ErpPanel title="Alertes">
            <p><strong>Contrats à échéance (30 j) :</strong> {dash.alerts.contractsEnding.length ? dash.alerts.contractsEnding.map((c) => c.name).join(', ') : 'Aucun'}</p>
            <p><strong>Anniversaires du mois :</strong> {dash.alerts.birthdays.length ? dash.alerts.birthdays.map((c) => c.name).join(', ') : 'Aucun'}</p>
            <p><strong>Genre :</strong> H {dash.effectifs.byGender.HOMME ?? 0} · F {dash.effectifs.byGender.FEMME ?? 0}</p>
            <button type="button" className="erp-btn erp-btn--ghost erp-btn--sm" onClick={() => csv('effectifs', ['Service', 'Effectif'], Object.entries(dash.effectifs.byDepartment).map(([k, v]) => [k, String(v)]))}>CSV effectifs</button>
          </ErpPanel>
        </>
      )}

      {tab === 'personnel' && (
        <ErpPanel title={`Agents (${employees.length})`}>
          <table className="erp-table">
            <thead>
              <tr><th>Matricule</th><th>Agent</th><th>Fonction</th><th>Service</th><th>Contrat</th><th>Responsable</th><th>Statut</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td><strong>{e.matricule}</strong></td>
                  <td>{e.user ? `${e.user.firstName} ${e.user.lastName}` : '—'}</td>
                  <td>{e.jobFunction?.name ?? e.jobTitle}</td>
                  <td>{e.department}</td>
                  <td>{e.contractType}</td>
                  <td>{e.manager ? `${e.manager.firstName} ${e.manager.lastName}` : '—'}</td>
                  <td><StatusPill status={e.status === 'ACTIF' ? 'CONFORME' : 'ANNULEE'} label={e.status} /></td>
                  <td className="erp-row-actions">
                    <DocButton onClick={() => printEmployeeSheet(e)} />
                    <DocButton label="Attestation" onClick={() => printWorkCertificate(e)} />
                    <DocButton label="Certificat" onClick={() => printEmploymentCertificate(e)} />
                    {can('hr', 'update') && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => {
                        setEditing(e);
                        setEmpForm({
                          ...emptyEmp,
                          userId: e.user?.id ?? e.userId ?? '',
                          jobTitle: e.jobTitle,
                          department: e.department,
                          contractType: e.contractType,
                          hireDate: e.hireDate.slice(0, 10),
                          endDate: e.endDate?.slice(0, 10) ?? '',
                          baseSalary: Number(e.baseSalary),
                          matricule: e.matricule,
                          gender: e.gender ?? '',
                          birthDate: e.birthDate?.slice(0, 10) ?? '',
                          maritalStatus: e.maritalStatus ?? '',
                          emergencyName: e.emergencyName ?? '',
                          emergencyPhone: e.emergencyPhone ?? '',
                          avenue: e.avenue ?? '',
                          avenueNumber: e.avenueNumber ?? '',
                          quartier: e.quartier ?? '',
                          commune: e.commune ?? '',
                          district: e.district || districtForCommune(e.commune ?? '') || '',
                          photoUrl: e.photoUrl ?? '',
                          managerId: e.managerId ?? '',
                          jobFunctionId: e.jobFunctionId ?? '',
                          annualLeaveDays: e.annualLeaveDays ?? 24,
                          cnssNumber: e.cnssNumber ?? '',
                          bankName: e.bankName ?? '',
                          bankAccount: e.bankAccount ?? '',
                        });
                        setShowEmployee(true);
                      }}>Modifier</button>
                    )}
                    {writeMaster && e.status === 'ACTIF' && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteEmployee(e.id).then(loadCore)}>Archiver</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ErpPanel>
      )}

      {tab === 'conges' && (
        <>
          {balance && (
            <div className="erp-kpi-row">
              <div className="erp-kpi"><div className="erp-kpi-label">Droits {balance.year}</div><div className="erp-kpi-value">{balance.rights} j</div></div>
              <div className="erp-kpi erp-kpi--orange"><div className="erp-kpi-label">Consommés</div><div className="erp-kpi-value">{balance.consumed} j</div></div>
              <div className="erp-kpi erp-kpi--green"><div className="erp-kpi-label">Solde</div><div className="erp-kpi-value">{balance.remaining} j</div></div>
            </div>
          )}
          <ErpPanel title="Nouvelle demande" padded>
            <form id="hr-leave-form" className="form-row" onSubmit={async (e) => {
              e.preventDefault();
              await api.createLeave({ ...leaveForm, userId: writeMaster && leaveForm.userId ? leaveForm.userId : user?.id ?? '' });
              await loadCore();
            }}>
              {writeMaster && (
                <div className="form-group">
                  <label>Agent</label>
                  <select value={leaveForm.userId} onChange={(ev) => setLeaveForm({ ...leaveForm, userId: ev.target.value })}>
                    <option value="">Moi-même</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Type</label>
                <select value={leaveForm.type} onChange={(ev) => setLeaveForm({ ...leaveForm, type: ev.target.value })}>
                  {LEAVE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Début</label><input type="date" value={leaveForm.startDate} onChange={(ev) => setLeaveForm({ ...leaveForm, startDate: ev.target.value })} /></div>
              <div className="form-group"><label>Fin</label><input type="date" value={leaveForm.endDate} onChange={(ev) => setLeaveForm({ ...leaveForm, endDate: ev.target.value })} /></div>
              <div className="form-group"><label>Motif</label><input value={leaveForm.reason} onChange={(ev) => setLeaveForm({ ...leaveForm, reason: ev.target.value })} /></div>
              <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Soumettre</button></div>
            </form>
          </ErpPanel>
          <ErpPanel title="Calendrier du mois">
            <table className="erp-table">
              <thead><tr><th>Agent</th><th>Type</th><th>Période</th><th>Statut</th></tr></thead>
              <tbody>
                {calendar.map((l) => (
                  <tr key={l.id}>
                    <td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : '—'}</td>
                    <td>{LEAVE_TYPES.find((t) => t.id === l.type)?.label ?? l.type}</td>
                    <td>{new Date(l.startDate).toLocaleDateString('fr-FR')} – {new Date(l.endDate).toLocaleDateString('fr-FR')}</td>
                    <td><StatusPill status={l.status} label={l.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
          <ErpPanel title={`Demandes (${leaves.length})`}>
            <table className="erp-table">
              <thead><tr><th>Agent</th><th>Type</th><th>Période</th><th>Jours</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : '—'}</td>
                    <td>{LEAVE_TYPES.find((t) => t.id === l.type)?.label ?? l.type}</td>
                    <td>{new Date(l.startDate).toLocaleDateString('fr-FR')} – {new Date(l.endDate).toLocaleDateString('fr-FR')}</td>
                    <td>{l.days}</td>
                    <td><StatusPill status={l.status} label={l.status} /></td>
                    <td className="erp-row-actions">
                      <DocButton onClick={() => printLeaveRequest(l)} />
                      {l.status === 'VALIDEE' && <DocButton label="Attestation" onClick={() => printLeaveCertificate(l)} />}
                      {canValidate && (l.status === 'SOUMISE' || l.status === 'VALIDEE_MANAGER') && (
                        <>
                          <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateLeave(l.id).then(loadCore)}>Valider</button>
                          <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => {
                            const reason = window.prompt('Motif de rejet');
                            if (reason) api.rejectLeave(l.id, reason).then(loadCore);
                          }}>Rejeter</button>
                        </>
                      )}
                      {writeMaster && l.status !== 'VALIDEE' && l.status !== 'REJETEE' && l.status !== 'ANNULEE' && (
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.cancelLeave(l.id).then(loadCore)}>Annuler</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'activites' && (
        <>
          <ErpPanel title="Canvas PDF par activité">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Fonction</th>
                  <th>Activité</th>
                  <th>Déclarations</th>
                  <th>Objectifs</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {functions.flatMap((f) => (f.activities ?? []).map((a) => {
                  const decls = declarations.filter((d) => (d.activityId ?? d.activity?.id) === a.id);
                  const objs = activityObjectives.filter((o) => o.activityId === a.id);
                  return (
                    <tr key={a.id}>
                      <td>{f.name}</td>
                      <td><strong>{a.name}</strong></td>
                      <td>{decls.length}</td>
                      <td>{objs.length}</td>
                      <td className="erp-row-actions">
                        <DocButton label="Canvas PDF" onClick={() => printJobActivityCanvas({
                          activity: { ...a, jobFunction: { id: f.id, name: f.name, department: f.department } },
                          declarations: decls,
                          objectives: objs,
                        })} />
                      </td>
                    </tr>
                  );
                }))}
                {!functions.some((f) => (f.activities ?? []).length) && (
                  <tr><td colSpan={5} className="erp-table-empty">Aucune activité de fonction.</td></tr>
                )}
              </tbody>
            </table>
          </ErpPanel>
          {writeMaster && (
            <ErpPanel title="Référentiel des fonctions" padded>
              <form id="hr-function-form" className="form-row" onSubmit={async (e) => {
                e.preventDefault();
                await api.createJobFunction({
                  name: fnForm.name,
                  department: fnForm.department,
                  activities: fnForm.activities.split(',').map((s) => s.trim()).filter(Boolean),
                });
                setFnForm({ name: '', department: 'Exploitation', activities: '' });
                await loadCore();
              }}>
                <div className="form-group"><label>Fonction</label><input value={fnForm.name} onChange={(e) => setFnForm({ ...fnForm, name: e.target.value })} required /></div>
                <div className="form-group"><label>Service</label><select value={fnForm.department} onChange={(e) => setFnForm({ ...fnForm, department: e.target.value })}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></div>
                <div className="form-group"><label>Activités (séparées par virgule)</label><input value={fnForm.activities} onChange={(e) => setFnForm({ ...fnForm, activities: e.target.value })} /></div>
                <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Créer</button></div>
              </form>
              <ul>
                {functions.map((f) => (
                  <li key={f.id}><strong>{f.name}</strong> — {(f.activities ?? []).map((a) => a.name).join(' · ') || 'aucune activité'}</li>
                ))}
              </ul>
            </ErpPanel>
          )}
          <ErpPanel title="Déclarer une activité" padded>
            <form className="form-row" onSubmit={async (e) => {
              e.preventDefault();
              await api.declareActivity(declForm);
              await loadCore();
            }}>
              <div className="form-group">
                <label>Activité</label>
                <select value={declForm.activityId} onChange={(e) => setDeclForm({ ...declForm, activityId: e.target.value })}>
                  <option value="">—</option>
                  {myActs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group"><label>Date</label><input type="date" value={declForm.date} onChange={(e) => setDeclForm({ ...declForm, date: e.target.value })} /></div>
              <div className="form-group"><label>Commentaire</label><input value={declForm.comment} onChange={(e) => setDeclForm({ ...declForm, comment: e.target.value })} /></div>
              <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Déclarer</button></div>
            </form>
          </ErpPanel>
          <ErpPanel title="Déclarations">
            <table className="erp-table">
              <thead><tr><th>Agent</th><th>Activité</th><th>Date</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {declarations.map((d) => (
                  <tr key={d.id}>
                    <td>{d.user ? `${d.user.firstName} ${d.user.lastName}` : '—'}</td>
                    <td>{d.activity?.name ?? '—'}</td>
                    <td>{new Date(d.date).toLocaleDateString('fr-FR')}</td>
                    <td><StatusPill status={d.status} label={d.status} /></td>
                    <td className="erp-row-actions">
                      <DocButton onClick={() => printGenericReport('Déclaration d’activité', {
                        reference: d.id.slice(0, 8),
                        fields: [
                          { label: 'Agent', value: d.user ? `${d.user.firstName} ${d.user.lastName}` : '—' },
                          { label: 'Activité', value: d.activity?.name ?? '—' },
                          { label: 'Date', value: new Date(d.date).toLocaleDateString('fr-FR') },
                          { label: 'Statut', value: d.status },
                          { label: 'Commentaire', value: d.comment ?? '—' },
                        ],
                      })} />
                      {canValidate && d.status === 'SOUMISE' && (
                        <>
                          <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateDeclaration(d.id).then(loadCore)}>Valider</button>
                          <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => {
                            const reason = window.prompt('Motif de rejet');
                            if (reason) api.rejectDeclaration(d.id, reason).then(loadCore);
                          }}>Rejeter</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'performance' && (
        <>
          {writeMaster && (
            <ErpPanel title="Nouvel objectif" padded>
              <form id="hr-objective-form" className="form-row" onSubmit={async (e) => {
                e.preventDefault();
                await api.createObjective(objForm);
                await loadCore();
              }}>
                <div className="form-group">
                  <label>Agent</label>
                  <select value={objForm.userId} onChange={(e) => setObjForm({ ...objForm, userId: e.target.value })} required>
                    <option value="">—</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Objectif</label><input value={objForm.title} onChange={(e) => setObjForm({ ...objForm, title: e.target.value })} required /></div>
                <div className="form-group"><label>Poids %</label><input type="number" min={1} max={100} value={objForm.weight} onChange={(e) => setObjForm({ ...objForm, weight: Number(e.target.value) })} /></div>
                <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Créer</button></div>
              </form>
            </ErpPanel>
          )}
          <ErpPanel title="Auto-évaluation" padded>
            {myObjectives.map((o) => (
              <div key={o.id} className="form-row">
                <div className="form-group"><label>{o.title} ({o.weight}%)</label>
                  <input type="number" min={0} max={100} value={selfScores[o.id] ?? 0} onChange={(e) => setSelfScores({ ...selfScores, [o.id]: Number(e.target.value) })} />
                </div>
              </div>
            ))}
            <div className="form-group"><label>Commentaire</label><textarea rows={2} value={selfComment} onChange={(e) => setSelfComment(e.target.value)} /></div>
            <button type="button" className="erp-btn" onClick={() => api.submitSelfReview({ year: new Date().getFullYear(), period: String(new Date().getFullYear()), selfScores, selfComment }).then(loadCore)}>Soumettre mon auto-évaluation</button>
          </ErpPanel>
          <ErpPanel title="Évaluations">
            <table className="erp-table">
              <thead><tr><th>Agent</th><th>Période</th><th>Score</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td>{r.user ? `${r.user.firstName} ${r.user.lastName}` : '—'}</td>
                    <td>{r.period}</td>
                    <td>{r.finalScore ?? '—'}</td>
                    <td><StatusPill status={r.status} label={r.status} /></td>
                    <td className="erp-row-actions">
                      <DocButton onClick={() => printEvaluationSheet(r, objectives.filter((o) => o.userId === r.userId))} />
                      {canValidate && r.status === 'AUTO_EVALUEE' && (
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateReview(r.id, { managerScores: (r.selfScores as Record<string, number>) ?? {}, managerComment: 'Validé' }).then(loadCore)}>Valider</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'formations' && (
        <>
          {writeMaster && (
            <ErpPanel title="Nouvelle formation" padded>
              <form id="hr-course-form" className="form-row" onSubmit={async (e) => {
                e.preventDefault();
                await api.createTraining(courseForm);
                setCourseForm({ title: '', kind: 'INTERNE', provider: '', location: '' });
                await loadCore();
              }}>
                <div className="form-group"><label>Intitulé</label><input value={courseForm.title} onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })} required /></div>
                <div className="form-group"><label>Type</label><select value={courseForm.kind} onChange={(e) => setCourseForm({ ...courseForm, kind: e.target.value })}><option>INTERNE</option><option>EXTERNE</option></select></div>
                <div className="form-group"><label>Organisme</label><input value={courseForm.provider} onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })} /></div>
                <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Créer</button></div>
              </form>
            </ErpPanel>
          )}
          <ErpPanel title="Catalogue">
            <table className="erp-table">
              <thead><tr><th>Formation</th><th>Type</th><th>Lieu</th><th></th></tr></thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>{c.title}</td>
                    <td>{c.kind}</td>
                    <td>{c.location ?? c.provider ?? '—'}</td>
                    <td><button type="button" className="erp-btn erp-btn--sm" onClick={() => api.enrollTraining(c.id).then(loadCore)}>M’inscrire</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
          <ErpPanel title="Inscriptions">
            <table className="erp-table">
              <thead><tr><th>Agent</th><th>Formation</th><th>Statut</th><th>Actions</th></tr></thead>
              <tbody>
                {enrollments.map((en) => (
                  <tr key={en.id}>
                    <td>{en.user ? `${en.user.firstName} ${en.user.lastName}` : '—'}</td>
                    <td>{en.course?.title}</td>
                    <td><StatusPill status={en.status} label={en.status} /></td>
                    <td className="erp-row-actions">
                      <DocButton onClick={() => printGenericReport('Inscription formation', {
                        reference: en.id.slice(0, 8),
                        fields: [
                          { label: 'Agent', value: en.user ? `${en.user.firstName} ${en.user.lastName}` : '—' },
                          { label: 'Formation', value: en.course?.title ?? '—' },
                          { label: 'Statut', value: en.status },
                        ],
                      })} />
                      {canValidate && en.status === 'INSCRITE' && (
                        <>
                          <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateEnrollment(en.id).then(loadCore)}>Valider</button>
                          <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => {
                            const reason = window.prompt('Motif de rejet');
                            if (reason) api.rejectEnrollment(en.id, reason).then(loadCore);
                          }}>Rejeter</button>
                        </>
                      )}
                      {writeMaster && en.status === 'VALIDEE' && (
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.followEnrollment(en.id).then(loadCore)}>Marquer suivie</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'documents' && (
        <>
          {writeMaster && (
            <ErpPanel title="Ajouter un document" padded>
              <form id="hr-doc-form" className="form-row" onSubmit={async (e) => {
                e.preventDefault();
                await api.addHrDocument(docForm);
                await loadCore();
              }}>
                <div className="form-group">
                  <label>Agent</label>
                  <select value={docForm.employeeId} onChange={(e) => setDocForm({ ...docForm, employeeId: e.target.value })} required>
                    <option value="">—</option>
                    {employees.map((em) => <option key={em.id} value={em.id}>{em.matricule} — {em.user ? `${em.user.firstName} ${em.user.lastName}` : ''}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={docForm.type} onChange={(e) => setDocForm({ ...docForm, type: e.target.value })}>
                    {DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Titre</label><input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} required /></div>
                <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Classer</button></div>
              </form>
            </ErpPanel>
          )}
          <ErpPanel title="Archives" actions={<input placeholder="Recherche" value={docQuery} onChange={(e) => setDocQuery(e.target.value)} onBlur={loadCore} />}>
            <table className="erp-table">
              <thead><tr><th>Date</th><th>Agent</th><th>Type</th><th>Titre</th><th>Actions</th></tr></thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id}>
                    <td>{new Date(d.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td>{d.employee?.user ? `${d.employee.user.firstName} ${d.employee.user.lastName}` : d.employee?.matricule}</td>
                    <td>{DOC_TYPES.find((t) => t.id === d.type)?.label ?? d.type}</td>
                    <td>{d.title}</td>
                    <td className="erp-row-actions">
                      <DocButton onClick={() => printGenericReport('Document RH', {
                        reference: d.id.slice(0, 8),
                        fields: [
                          { label: 'Titre', value: d.title },
                          { label: 'Type', value: DOC_TYPES.find((t) => t.id === d.type)?.label ?? d.type },
                          { label: 'Agent', value: d.employee?.user ? `${d.employee.user.firstName} ${d.employee.user.lastName}` : d.employee?.matricule ?? '—' },
                          { label: 'Date', value: new Date(d.createdAt).toLocaleDateString('fr-FR') },
                        ],
                      })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      {tab === 'shifts' && (
        <>
          {writeMaster && (
            <ErpPanel title="Planifier un shift" padded>
              <form id="hr-shift-form" className="form-row" onSubmit={async (e) => {
                e.preventDefault();
                await api.createShiftAssignment(shiftForm);
                setShiftDate(shiftForm.date);
                await loadCore();
              }}>
                <div className="form-group">
                  <label>Agent</label>
                  <select value={shiftForm.userId} onChange={(ev) => setShiftForm({ ...shiftForm, userId: ev.target.value })} required>
                    <option value="">—</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {ROLE_LABELS[u.role] ?? u.role}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Date</label><input type="date" value={shiftForm.date} onChange={(ev) => setShiftForm({ ...shiftForm, date: ev.target.value })} /></div>
                <div className="form-group"><label>Début</label><input type="time" value={shiftForm.startTime} onChange={(ev) => setShiftForm({ ...shiftForm, startTime: ev.target.value })} /></div>
                <div className="form-group"><label>Fin</label><input type="time" value={shiftForm.endTime} onChange={(ev) => setShiftForm({ ...shiftForm, endTime: ev.target.value })} /></div>
                <div className="form-group"><label>Poste</label><input value={shiftForm.postLabel} onChange={(ev) => setShiftForm({ ...shiftForm, postLabel: ev.target.value })} /></div>
                <div className="form-group" style={{ alignSelf: 'end' }}><button type="submit" className="erp-btn">Planifier</button></div>
              </form>
            </ErpPanel>
          )}
          <ErpPanel title={`Shifts du ${new Date(shiftDate).toLocaleDateString('fr-FR')}`} actions={
            <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} />
          }>
            <table className="erp-table">
              <thead><tr><th>Agent</th><th>Horaire</th><th>Poste</th><th>Validé</th><th>Actions</th></tr></thead>
              <tbody>
                {shifts.map((s) => (
                  <tr key={s.id}>
                    <td>{s.user ? `${s.user.firstName} ${s.user.lastName}` : '—'}</td>
                    <td>{s.startTime} – {s.endTime}</td>
                    <td>{s.postLabel}</td>
                    <td><StatusPill status={s.validated ? 'CONFORME' : 'EN_ATTENTE'} label={s.validated ? 'Oui' : 'Non'} /></td>
                    <td className="erp-row-actions">
                      <DocButton onClick={() => printShiftSheet(s)} />
                      {canValidate && !s.validated && (
                        <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.validateShiftAssignment(s.id).then(loadCore)}>Valider</button>
                      )}
                      {writeMaster && (
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteShiftAssignment(s.id).then(loadCore)}>Supprimer</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ErpPanel>
        </>
      )}

      <Modal title={editing ? 'Dossier employé' : 'Nouveau dossier RH'} open={showEmployee} onClose={() => setShowEmployee(false)} wide>
        <form className="form-stack" onSubmit={saveEmployee}>
          {!editing && (
            <div className="form-group">
              <label>Agent</label>
              <select value={empForm.userId} onChange={(e) => setEmpForm({ ...empForm, userId: e.target.value })} required>
                <option value="">— Choisir —</option>
                {users.filter((u) => !employees.some((em) => em.user?.id === u.id && em.status === 'ACTIF')).map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {ROLE_LABELS[u.role] ?? u.role}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-row">
            <div className="form-group"><label>Poste</label><input value={empForm.jobTitle} onChange={(e) => setEmpForm({ ...empForm, jobTitle: e.target.value })} required /></div>
            <div className="form-group">
              <label>Fonction SIRH</label>
              <select value={empForm.jobFunctionId} onChange={(e) => setEmpForm({ ...empForm, jobFunctionId: e.target.value })}>
                <option value="">—</option>
                {functions.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Service</label><select value={empForm.department} onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}>{DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}</select></div>
            <div className="form-group"><label>Contrat</label><select value={empForm.contractType} onChange={(e) => setEmpForm({ ...empForm, contractType: e.target.value })}>{CONTRACTS.map((c) => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Sexe</label><select value={empForm.gender} onChange={(e) => setEmpForm({ ...empForm, gender: e.target.value })}><option value="">—</option><option value="HOMME">Homme</option><option value="FEMME">Femme</option><option value="AUTRE">Autre</option></select></div>
            <div className="form-group"><label>Date de naissance</label><input type="date" value={empForm.birthDate} onChange={(e) => setEmpForm({ ...empForm, birthDate: e.target.value })} /></div>
            <div className="form-group"><label>État civil</label><select value={empForm.maritalStatus} onChange={(e) => setEmpForm({ ...empForm, maritalStatus: e.target.value })}><option value="">—</option><option value="CELIBATAIRE">Célibataire</option><option value="MARIE">Marié(e)</option><option value="DIVORCE">Divorcé(e)</option><option value="VEUF">Veuf/veuve</option></select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>District</label><select value={empForm.district} onChange={(e) => setEmpForm({ ...empForm, district: e.target.value, commune: '', quartier: '' })}><option value="">—</option>{KINSHASA_DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></div>
            <div className="form-group"><label>Commune</label><select value={empForm.commune} onChange={(e) => setEmpForm({ ...empForm, commune: e.target.value, district: districtForCommune(e.target.value) || empForm.district })}><option value="">—</option>{communes.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
            <div className="form-group"><label>Quartier</label><select value={empForm.quartier} onChange={(e) => setEmpForm({ ...empForm, quartier: e.target.value })}><option value="">—</option>{quartiers.map((q) => <option key={q}>{q}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Avenue</label><input value={empForm.avenue} onChange={(e) => setEmpForm({ ...empForm, avenue: e.target.value })} /></div>
            <div className="form-group"><label>N°</label><input value={empForm.avenueNumber} onChange={(e) => setEmpForm({ ...empForm, avenueNumber: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Contact d’urgence</label><input value={empForm.emergencyName} onChange={(e) => setEmpForm({ ...empForm, emergencyName: e.target.value })} /></div>
            <div className="form-group"><label>Tél. urgence</label><input value={empForm.emergencyPhone} onChange={(e) => setEmpForm({ ...empForm, emergencyPhone: e.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Responsable hiérarchique</label>
              <select value={empForm.managerId} onChange={(e) => setEmpForm({ ...empForm, managerId: e.target.value })}>
                <option value="">—</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Droits congés (j/an)</label><input type="number" min={0} value={empForm.annualLeaveDays} onChange={(e) => setEmpForm({ ...empForm, annualLeaveDays: Number(e.target.value) })} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Embauche</label><input type="date" value={empForm.hireDate} onChange={(e) => setEmpForm({ ...empForm, hireDate: e.target.value })} /></div>
            <div className="form-group"><label>Fin de contrat</label><input type="date" value={empForm.endDate} onChange={(e) => setEmpForm({ ...empForm, endDate: e.target.value })} /></div>
            <div className="form-group"><label>Salaire (CDF)</label><input type="number" min={0} value={empForm.baseSalary} onChange={(e) => setEmpForm({ ...empForm, baseSalary: Number(e.target.value) })} /></div>
          </div>
          <div className="form-group"><label>Photo</label><input type="file" accept="image/*" onChange={onPhoto} />{empForm.photoUrl && <img src={empForm.photoUrl} alt="" className="erp-id-logo" />}</div>
          <button type="submit" className="erp-btn">{editing ? 'Mettre à jour' : 'Créer'}</button>
        </form>
      </Modal>
    </div>
  );
}

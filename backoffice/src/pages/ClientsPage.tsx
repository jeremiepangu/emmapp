import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { api, Client, ClientSegment, CreateClientInput } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import Modal from '../components/Modal';
import SavedViewsBar from '../components/SavedViewsBar';
import DocButton from '../components/DocButton';
import ClientSituationPanel from '../components/ClientSituationPanel';
import { printClientSheet, printClientsList } from '../documents/templates';
import { sheetClients } from '../excel/specs';
import {
  KINSHASA_DISTRICTS,
  KINSHASA_PROVINCE,
  ID_DOCUMENT_TYPES,
  PROFESSIONS,
  avenuesForCommune,
  communesForDistrict,
  districtForCommune,
  quartiersForCommune,
} from '../data/kinshasa';

const SEGMENTS: ClientSegment[] = ['PARTICULIER', 'BOUTIQUE', 'DETAILLANT', 'SUPERMARCHE', 'ENTREPRISE', 'HOTEL_RESTAURANT'];

const empty: CreateClientInput = {
  code: '',
  name: '',
  segment: 'DETAILLANT',
  avenue: '',
  avenueNumber: '',
  quartier: '',
  commune: '',
  district: '',
  province: KINSHASA_PROVINCE,
  phone: '',
  idDocumentType: 'CARTE_ELECTEUR',
  idDocumentNumber: '',
  logoUrl: '',
  profession: '',
  consigneLimit: 50,
};

function clientToForm(c: Client): CreateClientInput {
  return {
    code: c.code,
    name: c.name,
    segment: c.segment as ClientSegment,
    avenue: c.avenue ?? '',
    avenueNumber: c.avenueNumber ?? '',
    quartier: c.quartier ?? '',
    commune: c.commune ?? '',
    district: c.district || districtForCommune(c.commune) || '',
    province: c.province || KINSHASA_PROVINCE,
    phone: c.phone ?? '',
    email: c.email ?? '',
    idDocumentType: c.idDocumentType ?? 'CARTE_ELECTEUR',
    idDocumentNumber: c.idDocumentNumber ?? '',
    logoUrl: c.logoUrl ?? '',
    profession: c.profession ?? '',
    latitude: c.latitude ?? undefined,
    longitude: c.longitude ?? undefined,
    zone: c.commune ?? c.zone ?? '',
    consigneLimit: c.consigneLimit,
  };
}

export default function ClientsPage() {
  const { can } = usePermissions();
  const [clients, setClients] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [situationClient, setSituationClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [geoMsg, setGeoMsg] = useState('');
  const [form, setForm] = useState<CreateClientInput>(empty);

  const load = () => api.getClients().then(setClients);
  useEffect(() => { load(); }, []);

  const communes = useMemo(() => communesForDistrict(form.district), [form.district]);
  const quartiers = useMemo(() => quartiersForCommune(form.commune), [form.commune]);
  const avenues = useMemo(() => avenuesForCommune(form.commune), [form.commune]);

  const openCreate = () => { setEditing(null); setForm(empty); setError(''); setGeoMsg(''); setShowForm(true); };
  const openEdit = (c: Client) => {
    setEditing(c);
    setForm(clientToForm(c));
    setError('');
    setGeoMsg('');
    setShowForm(true);
  };

  const setCommune = (commune: string) => {
    const district = districtForCommune(commune) || form.district;
    const nextQuartiers = quartiersForCommune(commune);
    setForm({
      ...form,
      commune,
      district,
      zone: commune,
      quartier: nextQuartiers.includes(form.quartier ?? '') ? form.quartier : '',
      province: KINSHASA_PROVINCE,
    });
  };

  const setDistrict = (district: string) => {
    const stillValid = communesForDistrict(district).some((c) => c.name === form.commune);
    setForm({
      ...form,
      district,
      commune: stillValid ? form.commune : '',
      quartier: stillValid ? form.quartier : '',
      zone: stillValid ? form.zone : '',
      province: KINSHASA_PROVINCE,
    });
  };

  const onLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) {
      setError('Logo trop volumineux (max 400 Ko)');
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('lecture'));
      reader.readAsDataURL(file);
    });
    setForm({ ...form, logoUrl: dataUrl });
  };

  const captureGeo = () => {
    if (!navigator.geolocation) {
      setGeoMsg('Géolocalisation indisponible sur cet appareil');
      return;
    }
    setGeoMsg('Localisation en cours…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({
          ...form,
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        });
        setGeoMsg('Position enregistrée');
      },
      () => setGeoMsg('Impossible d’obtenir la position'),
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    const payload: CreateClientInput = {
      ...form,
      province: KINSHASA_PROVINCE,
      zone: form.commune || form.zone,
      email: form.email?.trim() || undefined,
      logoUrl: form.logoUrl?.trim() || undefined,
      latitude: form.latitude != null ? Number(form.latitude) : undefined,
      longitude: form.longitude != null ? Number(form.longitude) : undefined,
    };
    try {
      if (editing) await api.updateClient(editing.id, payload);
      else await api.createClient(payload);
      setShowForm(false);
      await load();
    } catch {
      setError('Enregistrement impossible');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Clients"
        subtitle="Identité, adresse Kinshasa et consignes"
        excel={{ filename: 'clients', sheets: [sheetClients(clients, can('clients', 'create'))], onImported: load }}
        actions={
          <>
            <DocButton label="Imprimer la liste" onClick={() => printClientsList(clients)} />
            {can('clients', 'create') && <button type="button" className="erp-btn" onClick={openCreate}>+ Nouveau client</button>}
          </>
        }
      />
      <SavedViewsBar resource="clients" onApply={() => undefined} />
      <ErpPanel title={`Liste des clients (${clients.length})`}>
        <table className="erp-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom / raison sociale</th>
              <th>Segment</th>
              <th>Commune</th>
              <th>Téléphone</th>
              <th>Pièce</th>
              <th>Dette vidange</th>
              <th>Dette argent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.code}</strong></td>
                <td>{c.name}</td>
                <td><StatusPill status={c.segment} label={c.segment} /></td>
                <td>{c.commune ?? c.zone ?? '—'}</td>
                <td>{c.phone ?? '—'}</td>
                <td>{c.idDocumentType ? `${ID_DOCUMENT_TYPES.find((t) => t.value === c.idDocumentType)?.label ?? c.idDocumentType}${c.idDocumentNumber ? ` ${c.idDocumentNumber}` : ''}` : '—'}</td>
                <td>
                  {c.consigneBalance < 0
                    ? `${-c.consigneBalance} contenant(s) en avoir`
                    : `${c.consigneBalance} / ${c.consigneLimit} contenant(s)`}
                  {c.consigneBalance > c.consigneLimit * 0.8 && <StatusPill status="ALERTE" label="Proche plafond" />}
                </td>
                <td>
                  {Number(c.creditBalance ?? 0).toLocaleString('fr-FR')} CDF
                  {Number(c.creditLimit ?? 0) > 0 && (
                    <>
                      {' / '}
                      {Number(c.creditLimit).toLocaleString('fr-FR')}
                      {Number(c.creditBalance ?? 0) > Number(c.creditLimit) && (
                        <StatusPill status="ALERTE" label="Plafond dépassé" />
                      )}
                    </>
                  )}
                  {Number(c.advanceBalance ?? 0) > 0 && (
                    <div className="erp-muted">
                      Avance {Number(c.advanceBalance).toLocaleString('fr-FR')} CDF
                    </div>
                  )}
                </td>
                <td className="erp-row-actions">
                  <DocButton onClick={() => printClientSheet(c)} />
                  <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => setSituationClient(c)}>Situation</button>
                  {can('clients', 'update') && <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => openEdit(c)}>Modifier</button>}
                  {can('clients', 'delete') && <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => api.deleteClient(c.id).then(load)}>Désactiver</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
      <Modal
        title={`Situation — ${situationClient?.name ?? ''}`}
        open={Boolean(situationClient)}
        onClose={() => setSituationClient(null)}
        wide
      >
        <ClientSituationPanel clientId={situationClient?.id} />
      </Modal>
      <Modal title={editing ? 'Identité du client' : 'Nouveau client'} open={showForm} onClose={() => setShowForm(false)} wide>
        <form onSubmit={handleSubmit} className="form-stack">
          <div className="form-row">
            <div className="form-group"><label>Code</label><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editing} /></div>
            <div className="form-group"><label>Nom complet / raison sociale</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Segment</label>
              <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value as ClientSegment })}>
                {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Profession / secteur d’activité</label>
              <input list="emma-professions" value={form.profession ?? ''} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
              <datalist id="emma-professions">
                {PROFESSIONS.map((p) => <option key={p} value={p} />)}
              </datalist>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Téléphone</label><input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-group"><label>Plafond consignes</label><input type="number" value={form.consigneLimit} onChange={(e) => setForm({ ...form, consigneLimit: Number(e.target.value) })} /></div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Province</label>
              <select value={KINSHASA_PROVINCE} disabled>
                <option value={KINSHASA_PROVINCE}>{KINSHASA_PROVINCE}</option>
              </select>
            </div>
            <div className="form-group">
              <label>District</label>
              <select value={form.district ?? ''} onChange={(e) => setDistrict(e.target.value)} required>
                <option value="">— Choisir —</option>
                {KINSHASA_DISTRICTS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Commune</label>
              <select value={form.commune ?? ''} onChange={(e) => setCommune(e.target.value)} required>
                <option value="">— Choisir —</option>
                {communes.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Quartier</label>
              <select value={form.quartier ?? ''} onChange={(e) => setForm({ ...form, quartier: e.target.value })}>
                <option value="">— Choisir —</option>
                {quartiers.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Avenue</label>
              <input list="emma-avenues" value={form.avenue ?? ''} onChange={(e) => setForm({ ...form, avenue: e.target.value })} />
              <datalist id="emma-avenues">
                {avenues.map((a) => <option key={a} value={a} />)}
              </datalist>
            </div>
            <div className="form-group">
              <label>Numéro</label>
              <input value={form.avenueNumber ?? ''} onChange={(e) => setForm({ ...form, avenueNumber: e.target.value })} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Pièce d’identité</label>
              <select value={form.idDocumentType ?? ''} onChange={(e) => setForm({ ...form, idDocumentType: e.target.value })}>
                {ID_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Numéro de pièce</label>
              <input value={form.idDocumentNumber ?? ''} onChange={(e) => setForm({ ...form, idDocumentNumber: e.target.value })} />
            </div>
          </div>

          <div className="form-group">
            <label>Photo / logo</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {form.logoUrl ? <img src={form.logoUrl} alt="Logo client" className="erp-id-logo" /> : <div className="erp-id-logo" />}
              <input type="file" accept="image/*" onChange={onLogo} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group"><label>Latitude</label><input type="number" step="0.000001" value={form.latitude ?? ''} onChange={(e) => setForm({ ...form, latitude: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
            <div className="form-group"><label>Longitude</label><input type="number" step="0.000001" value={form.longitude ?? ''} onChange={(e) => setForm({ ...form, longitude: e.target.value === '' ? undefined : Number(e.target.value) })} /></div>
          </div>
          <button type="button" className="erp-btn erp-btn--ghost erp-btn--sm" onClick={captureGeo}>Capturer ma position</button>
          {geoMsg && <p className="muted">{geoMsg}</p>}

          {error && <p className="error-msg">{error}</p>}
          <button type="submit" className="erp-btn" disabled={saving}>{saving ? 'Enregistrement...' : editing ? 'Mettre à jour' : 'Créer le client'}</button>
        </form>
      </Modal>
    </div>
  );
}

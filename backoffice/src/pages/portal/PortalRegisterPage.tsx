import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ClientSegment } from '../../api';
import { KINSHASA_COMMUNES, districtForCommune } from '../../data/kinshasa';
import { usePortal } from '../../PortalContext';
import LoginShell from '../../components/LoginShell';

const SEGMENTS: { value: ClientSegment; label: string }[] = [
  { value: 'PARTICULIER', label: 'Particulier / foyer' },
  { value: 'BOUTIQUE', label: 'Boutique / commerce' },
  { value: 'ENTREPRISE', label: 'Entreprise / bureau' },
  { value: 'HOTEL_RESTAURANT', label: 'Hôtel / restaurant' },
];

export default function PortalRegisterPage() {
  const { account, isLoading, register } = usePortal();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [commune, setCommune] = useState('');
  const [avenue, setAvenue] = useState('');
  const [quartier, setQuartier] = useState('');
  const [segment, setSegment] = useState<ClientSegment>('PARTICULIER');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isLoading) return <div className="loading-screen">Chargement...</div>;
  if (account) return <Navigate to="/portail/commander" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await register({
        fullName,
        companyName: companyName.trim() || undefined,
        email,
        phone,
        commune,
        district: districtForCommune(commune) || undefined,
        avenue: avenue.trim() || undefined,
        quartier: quartier.trim() || undefined,
        segment,
        password,
      });
      navigate('/portail/commander');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription impossible');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginShell
      wide
      extras={<p className="es-login-hint">Après inscription, vous pouvez commander tout de suite.</p>}
    >
      <form className="es-login-form" onSubmit={submit}>
        <h1 className="es-login-title">Créer un compte client</h1>
        <p className="es-login-sub">Livraison à Kinshasa. Puis passez commande.</p>
        <input
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nom et prénom"
          required
          autoComplete="name"
        />
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="Société (optionnel)"
          autoComplete="organization"
        />
        <select value={segment} onChange={(e) => setSegment(e.target.value as ClientSegment)} required>
          {SEGMENTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          required
          autoComplete="email"
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Téléphone (+243...)"
          required
          autoComplete="tel"
        />
        <select value={commune} onChange={(e) => setCommune(e.target.value)} required>
          <option value="">Commune de livraison</option>
          {KINSHASA_COMMUNES.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <input
          value={quartier}
          onChange={(e) => setQuartier(e.target.value)}
          placeholder="Quartier (optionnel)"
        />
        <input
          value={avenue}
          onChange={(e) => setAvenue(e.target.value)}
          placeholder="Avenue / adresse (optionnel)"
          autoComplete="street-address"
        />
        <div className="es-login-field">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe (8 caractères min.)"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button
            type="button"
            className="es-login-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
              {showPassword ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M9.9 5.1A10.6 10.6 0 0 1 12 5c7 0 10 7 10 7a18.4 18.4 0 0 1-3.2 3.8" />
                  <path d="M6.1 6.1C3.6 8 2 12 2 12s3 7 10 7a9.8 9.8 0 0 0 4.2-.9" />
                </>
              ) : (
                <>
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        {error && <p className="es-login-error">{error}</p>}
        <button type="submit" className="es-login-submit" disabled={loading}>
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>
        <div className="es-login-foot">
          <Link to="/portail/connexion">Déjà client ? Se connecter</Link>
          <Link to="/">Retour au site</Link>
        </div>
      </form>
    </LoginShell>
  );
}

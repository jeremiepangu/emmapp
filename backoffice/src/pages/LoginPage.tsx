import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import LoginShell from '../components/LoginShell';

const DEMO_ACCOUNTS = [
  { email: 'admin@emmapure.cd', role: 'Administrateur' },
  { email: 'dg@emmapure.cd', role: 'Direction générale' },
  { email: 'commercial@emmapure.cd', role: 'Commercial' },
  { email: 'chef.exploit@emmapure.cd', role: 'Chef exploitation' },
  { email: 'chef.prod@emmapure.cd', role: 'Chef production' },
  { email: 'analyste@emmapure.cd', role: 'Analyste données' },
  { email: 'securite@emmapure.cd', role: 'Sécurité' },
  { email: 'durabilite@emmapure.cd', role: 'Durabilité' },
  { email: 'caissier@emmapure.cd', role: 'Caissier' },
  { email: 'comptable@emmapure.cd', role: 'Comptable' },
  { email: 'livreur@emmapure.cd', role: 'Chargé livraison' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('admin@emmapure.cd');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    new URLSearchParams(window.location.search).has('expired')
      ? 'Session expirée — veuillez vous reconnecter.'
      : '',
  );
  const [mfaCode, setMfaCode] = useState('');
  const [mfaNeeded, setMfaNeeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password, mfaCode || undefined);
      navigate('/app');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      const lower = msg.toLowerCase();
      if (msg === 'MFA_REQUIRED' || lower.includes('mfa')) {
        setMfaNeeded(true);
        setError('Saisissez le code temporaire de votre application d\'authentification.');
      } else if (
        lower.includes('api inaccessible') ||
        lower.includes('failed to fetch') ||
        lower.includes('econnrefused') ||
        lower.includes('networkerror')
      ) {
        setError('Serveur API indisponible — lancez .\\scripts\\start-all.ps1');
      } else if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('identifiants invalides')) {
        setError('Identifiants invalides — password123');
      } else {
        setError('Erreur serveur — verifiez que l\'API et Postgres sont demarres');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginShell
      extras={(
        <div className="es-login-extras">
          <Link to="/">Site Emmanuel Services</Link>
          {' · '}
          <Link to="/mobile">Interface livreur</Link>
          <div className="es-login-demos">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} type="button" onClick={() => setEmail(a.email)}>
                {a.role}
              </button>
            ))}
          </div>
        </div>
      )}
    >
      <form className="es-login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Nom d'utilisateur"
          required
          autoComplete="username"
        />
        <div className="es-login-field">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mot de passe"
            required
            autoComplete="current-password"
          />
          <button
            type="button"
            className="es-login-eye"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {showPassword ? (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6A2 2 0 0 0 12 14a2 2 0 0 0 1.4-.6" />
                <path d="M9.9 5.1A10.6 10.6 0 0 1 12 5c7 0 10 7 10 7a18.4 18.4 0 0 1-3.2 3.8" />
                <path d="M6.1 6.1C3.6 8 2 12 2 12s3 7 10 7a9.8 9.8 0 0 0 4.2-.9" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {mfaNeeded && (
          <input
            inputMode="numeric"
            pattern="\d{6}"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            placeholder="Code temporaire (MFA)"
            autoComplete="one-time-code"
            required
          />
        )}
        {error && <p className="es-login-error">{error}</p>}
        <button type="submit" className="es-login-submit" disabled={loading}>
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
        <div className="es-login-foot">
          <a href="mailto:contact@emmas.cd?subject=Mot%20de%20passe%20oubli%C3%A9">Mot de passe oublié ?</a>
          <Link to="/portail/inscription">S&apos;inscrire</Link>
        </div>
      </form>
    </LoginShell>
  );
}

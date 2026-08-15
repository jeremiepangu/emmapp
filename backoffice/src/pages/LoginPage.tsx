import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

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
  { email: 'livreur@emmapure.cd', role: 'Chargé livraison' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('admin@emmapure.cd');
  const [password, setPassword] = useState('password123');
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
      navigate('/');
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
    <div className="erp-login-page">
      <div className="erp-login-left">
        <div className="erp-login-brand">EMMAS</div>
        <p className="erp-login-tag">ERP / CRM — Distribution eau potable</p>
        <ul className="erp-login-features">
          <li>Tableau de bord &amp; KPI</li>
          <li>Commandes · Livraisons · Factures</li>
          <li>Production · Qualité · Stock</li>
          <li>IA · IoT · ESG · Portail client</li>
        </ul>
      </div>
      <div className="erp-login-right">
        <div className="erp-login-box">
          <h2>Connexion</h2>
          <p className="erp-login-box-desc">Accédez à votre espace de gestion EMMAS ERP</p>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Mot de passe</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {mfaNeeded && (
              <div className="form-group">
                <label>Code temporaire (MFA)</label>
                <input
                  inputMode="numeric"
                  pattern="\d{6}"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  autoComplete="one-time-code"
                  required
                />
              </div>
            )}
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="erp-btn erp-login-submit" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
          <Link to="/mobile" className="erp-login-mobile-link">Interface livreur →</Link>
          <Link to="/portail/connexion" className="erp-login-mobile-link">Portail client →</Link>
          <div className="login-demo-accounts">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} type="button" className="demo-account-btn" onClick={() => setEmail(a.email)}>
                {a.role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

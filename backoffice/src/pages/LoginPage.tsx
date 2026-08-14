import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { FIELD_ROLES } from '../permissions';

const DEMO_ACCOUNTS = [
  { email: 'admin@emmapure.cd', role: 'Administrateur' },
  { email: 'commercial@emmapure.cd', role: 'Commercial' },
  { email: 'livreur@emmapure.cd', role: 'Chargé livraison' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('admin@emmapure.cd');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      const stored = localStorage.getItem('user');
      const role = stored ? JSON.parse(stored).role : null;
      navigate(FIELD_ROLES.includes(role) ? '/mobile' : '/');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('API inaccessible') || msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED')) {
        setError('Serveur API indisponible — lancez .\\scripts\\start-all.ps1');
      } else {
        setError('Identifiants invalides — password123');
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
            {error && <p className="error-msg">{error}</p>}
            <button type="submit" className="erp-btn erp-login-submit" disabled={loading}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
          <Link to="/mobile" className="erp-login-mobile-link">Interface livreur →</Link>
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

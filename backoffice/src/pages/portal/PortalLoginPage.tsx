import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePortal } from '../../PortalContext';
import LoginShell from '../../components/LoginShell';

export default function PortalLoginPage() {
  const [email, setEmail] = useState('client@boutique-kintambo.cd');
  const [password, setPassword] = useState('password123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(
    new URLSearchParams(window.location.search).has('expired')
      ? 'Session expirée — veuillez vous reconnecter.'
      : '',
  );
  const [loading, setLoading] = useState(false);
  const { login } = usePortal();
  const navigate = useNavigate();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/portail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginShell extras={<p className="es-login-hint">Compte démo : client@boutique-kintambo.cd / password123</p>}>
      <form className="es-login-form" onSubmit={submit}>
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
          {loading ? 'Connexion…' : 'Se connecter'}
        </button>
        <div className="es-login-foot">
          <a href="mailto:contact@emmas.cd?subject=Mot%20de%20passe%20oubli%C3%A9">Mot de passe oublié ?</a>
          <Link to="/login">S&apos;inscrire</Link>
        </div>
      </form>
    </LoginShell>
  );
}

export type AgentCardProps = {
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
  matricule?: string;
  jobTitle?: string;
  department?: string;
  contractType?: string;
  hireDate?: string;
  status?: string;
  phone?: string | null;
  email?: string | null;
  company?: string;
};

function initials(first?: string, last?: string): string {
  const value = `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
  return value || 'AG';
}

function frDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
}

export default function AgentCard({
  firstName,
  lastName,
  photoUrl,
  matricule,
  jobTitle,
  department,
  contractType,
  hireDate,
  status,
  phone,
  email,
  company = 'EMMANUEL SERVICES SARLU',
}: AgentCardProps) {
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Nouvel agent';

  return (
    <article className="agent-card">
      <header className="agent-card-head">
        <span className="agent-card-company">{company}</span>
        <span className="agent-card-kind">Badge agent</span>
      </header>

      <div className="agent-card-identity">
        <div className="agent-card-photo">
          {photoUrl
            ? <img src={photoUrl} alt={`Photo de ${fullName}`} />
            : <span>{initials(firstName, lastName)}</span>}
        </div>
        <div className="agent-card-names">
          <h4>{fullName}</h4>
          <p>{jobTitle || 'Poste à définir'}</p>
          {matricule && <span className="agent-card-matricule">{matricule}</span>}
        </div>
      </div>

      <dl className="agent-card-facts">
        <div><dt>Service</dt><dd>{department || '—'}</dd></div>
        <div><dt>Contrat</dt><dd>{contractType || '—'}</dd></div>
        <div><dt>Embauche</dt><dd>{frDate(hireDate)}</dd></div>
        <div><dt>Statut</dt><dd>{status || 'ACTIF'}</dd></div>
        {phone && <div><dt>Téléphone</dt><dd>{phone}</dd></div>}
        {email && <div><dt>E-mail</dt><dd>{email}</dd></div>}
      </dl>
    </article>
  );
}

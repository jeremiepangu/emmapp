import { FormEvent, useEffect, useRef, useState } from 'react';
import { api, AssistantSession } from '../api';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';

export default function AssistantPage() {
  const [sessions, setSessions] = useState<AssistantSession[]>([]);
  const [active, setActive] = useState<AssistantSession | null>(null);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const loadSessions = () => api.getAssistantSessions().then(setSessions).catch((e) => setError(e.message));

  useEffect(() => { loadSessions(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages?.length]);

  const openSession = async (id: string) => {
    const s = await api.getAssistantSession(id);
    setActive(s);
  };

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    setError('');
    try {
      const answer = await api.askAssistant({
        question: question.trim(),
        sessionId: active?.id,
        channel: 'BACKOFFICE',
      });
      setQuestion('');
      const session = await api.getAssistantSession(answer.sessionId);
      setActive(session);
      await loadSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant indisponible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Assistant conversationnel"
        subtitle="Questions sur commandes, livraisons, consignes, stock et fidélité — français et lingala"
      />
      {error && <p className="error-msg">{error}</p>}
      <div className="erp-split">
        <ErpPanel title="Sessions" actions={<button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => setActive(null)}>Nouvelle</button>}>
          <table className="erp-table">
            <thead><tr><th>Canal</th><th>Début</th><th></th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className={active?.id === s.id ? 'erp-row-active' : ''} onClick={() => openSession(s.id)}>
                  <td>{s.channel}{s.escalated ? ' · escaladée' : ''}</td>
                  <td>{new Date(s.startedAt).toLocaleString('fr-FR')}</td>
                  <td>
                    {!s.escalated && (
                      <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={(e) => { e.stopPropagation(); api.escalateAssistantSession(s.id).then(() => openSession(s.id)); }}>
                        Escalader
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {!sessions.length && <tr><td colSpan={3} className="erp-muted">Aucune conversation.</td></tr>}
            </tbody>
          </table>
        </ErpPanel>
        <ErpPanel title={active ? `Conversation · ${active.channel}` : 'Nouvelle conversation'} padded>
          <div className="erp-chat">
            {(active?.messages ?? []).map((m) => (
              <div key={m.id} className={`erp-chat-bubble erp-chat-bubble--${m.author === 'ASSISTANT' ? 'bot' : 'user'}`}>
                <p>{m.content}</p>
                {m.intent && <small>{m.intent}{m.confidence != null ? ` · ${Math.round(m.confidence * 100)} %` : ''}</small>}
              </div>
            ))}
            {active?.escalated && <StatusPill status="ALERTE" label="Transférée à un agent humain" />}
            <div ref={endRef} />
          </div>
          <form onSubmit={ask} className="form-row" style={{ marginTop: 12 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="assistant-q">Votre question</label>
              <input
                id="assistant-q"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ex. Où en est la commande CMD-2026-00012 ?"
                aria-label="Question à l'assistant"
              />
            </div>
            <div className="form-group" style={{ alignSelf: 'end' }}>
              <button type="submit" className="erp-btn" disabled={busy}>{busy ? '…' : 'Envoyer'}</button>
            </div>
          </form>
        </ErpPanel>
      </div>
    </div>
  );
}

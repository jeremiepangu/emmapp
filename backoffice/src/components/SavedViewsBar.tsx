import { FormEvent, useEffect, useState } from 'react';
import { api, SavedView } from '../api';

export default function SavedViewsBar({ resource, onApply }: { resource: string; onApply: (filters: Record<string, unknown>) => void }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState('');

  const load = () => api.getSavedViews(resource).then(setViews).catch(() => setViews([]));
  useEffect(() => { load(); }, [resource]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.createSavedView({ resource, name: name.trim(), filters: { q: name.trim() } });
    setName('');
    load();
  };

  return (
    <div className="erp-saved-views">
      {views.map((v) => (
        <button key={v.id} type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => onApply(v.filters)}>
          {v.name}
        </button>
      ))}
      <form onSubmit={save} className="erp-saved-views-form">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nommer la vue" aria-label="Nom de la vue sauvegardée" />
        <button type="submit" className="erp-btn erp-btn--sm">Sauver</button>
      </form>
    </div>
  );
}

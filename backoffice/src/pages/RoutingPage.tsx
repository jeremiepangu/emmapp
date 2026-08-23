import { useEffect, useState } from 'react';
import { api, OptimizedRoute, RouteStop, Tour } from '../api';
import { usePermissions } from '../hooks/usePermissions';
import { ErpPageHeader, ErpPanel } from '../components/ErpUi';
import StatusPill from '../components/ErpUi';
import DocButton from '../components/DocButton';
import { printOptimizedRoutesList, printRouteSheet } from '../documents/templates';
import { exportSheet } from '../excel/specs';

export default function RoutingPage() {
  const { can } = usePermissions();
  const [routes, setRoutes] = useState<OptimizedRoute[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [selected, setSelected] = useState<OptimizedRoute | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    Promise.all([api.getOptimizedRoutes(), api.getTours()])
      .then(([r, t]) => { setRoutes(r); setTours(t); })
      .catch((e) => setError(e.message));
  };

  useEffect(() => { load(); }, []);

  const compute = async (tourId: string) => {
    setBusy(tourId);
    try {
      const r = await api.computeOptimizedRoute(tourId);
      setSelected(r);
      setStops(r.stops);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calcul impossible');
    } finally {
      setBusy('');
    }
  };

  const move = (index: number, dir: -1 | 1) => {
    const next = [...stops];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setStops(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  return (
    <div className="erp-page">
      <ErpPageHeader
        title="Itinéraires optimisés"
        subtitle="Plus proche voisin + 2-opt, priorités clients et trafic horaire — ajustable avant validation"
        excel={{
          filename: 'itineraires',
          sheets: [
            exportSheet('Itineraires', [
              ['tournee', 'Tournee'], ['zone', 'Zone'], ['distanceKm', 'Distance km'],
              ['dureeMin', 'Duree min'], ['algo', 'Algorithme'], ['ajuste', 'Ajuste'],
            ], routes.map((row) => ({
              tournee: row.tour?.tourNumber ?? row.tourId,
              zone: row.tour?.zone ?? '',
              distanceKm: row.totalDistanceKm,
              dureeMin: row.estimatedDurationMin,
              algo: row.algorithm,
              ajuste: row.manuallyAdjusted ? 'Oui' : 'Non',
            }))),
            exportSheet('Arrets', [
              ['ordre', 'Ordre'], ['client', 'Client'], ['priorite', 'Priorite'],
              ['lat', 'Latitude'], ['lng', 'Longitude'],
            ], stops.map((row) => ({
              ordre: row.order,
              client: row.clientName,
              priorite: row.priority,
              lat: row.latitude,
              lng: row.longitude,
            }))),
            exportSheet('Tournees', [['numero', 'Numero'], ['zone', 'Zone'], ['statut', 'Statut']], tours.map((row) => ({
              numero: row.tourNumber,
              zone: row.zone,
              statut: row.status,
            }))),
          ],
        }}
        actions={
          <>
            <DocButton label="Liste des itinéraires" onClick={() => printOptimizedRoutesList(routes)} />
            {selected && <DocButton label="Imprimer l'itinéraire" onClick={() => printRouteSheet({ ...selected, stops })} />}
          </>
        }
      />
      {error && <p className="error-msg">{error}</p>}

      <ErpPanel title="Tournées à optimiser">
        <table className="erp-table">
          <thead><tr><th>Tournée</th><th>Zone</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {tours.map((t) => (
              <tr key={t.id}>
                <td><code>{t.tourNumber}</code></td>
                <td>{t.zone}</td>
                <td><StatusPill status={t.status} /></td>
                <td>
                  {can('routing', 'create') && (
                    <button type="button" className="erp-btn erp-btn--sm" disabled={busy === t.id} onClick={() => compute(t.id)}>
                      {busy === t.id ? 'Calcul…' : 'Optimiser'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>

      {selected && (
        <ErpPanel
          title={`Proposition ${selected.algorithm} · ${selected.totalDistanceKm.toFixed(1)} km · ${selected.estimatedDurationMin} min`}
          actions={(
            <>
              {selected && <DocButton label="Itinéraire" onClick={() => printRouteSheet({ ...selected, stops })} />}
              {can('routing', 'validate') && (
                <>
                  <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.adjustOptimizedRoute(selected.tourId, stops).then((r) => { setSelected(r); setStops(r.stops); load(); })}>
                    Enregistrer l'ajustement
                  </button>
                  <button type="button" className="erp-btn erp-btn--sm" onClick={() => api.applyOptimizedRoute(selected.tourId).then((r) => { setSelected(r); load(); })}>
                    Appliquer
                  </button>
                </>
              )}
            </>
          )}
        >
          <table className="erp-table">
            <thead><tr><th>#</th><th>Client</th><th>Priorité</th><th>Coordonnées</th><th></th></tr></thead>
            <tbody>
              {stops.map((s, i) => (
                <tr key={`${s.clientId}-${s.order}`}>
                  <td>{s.order}</td>
                  <td>{s.clientName}</td>
                  <td>{s.priority}</td>
                  <td>{s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}</td>
                  <td>
                    {can('routing', 'update') && (
                      <>
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => move(i, -1)}>↑</button>
                        <button type="button" className="erp-btn erp-btn--sm erp-btn--ghost" onClick={() => move(i, 1)}>↓</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selected.manuallyAdjusted && <p className="erp-muted">Itinéraire ajusté manuellement.</p>}
          {selected.deviationPct != null && <p>Écart à la clôture : {selected.deviationPct.toFixed(1)} %</p>}
        </ErpPanel>
      )}

      <ErpPanel title="Historique">
        <table className="erp-table">
          <thead><tr><th>Tournée</th><th>Distance</th><th>Durée</th><th>Appliqué</th><th></th></tr></thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.id} onClick={() => { setSelected(r); setStops(r.stops); }}>
                <td>{r.tour?.tourNumber ?? r.tourId}</td>
                <td>{r.totalDistanceKm.toFixed(1)} km</td>
                <td>{r.estimatedDurationMin} min</td>
                <td>{r.appliedAt ? new Date(r.appliedAt).toLocaleString('fr-FR') : '—'}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  <DocButton onClick={() => printRouteSheet(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ErpPanel>
    </div>
  );
}

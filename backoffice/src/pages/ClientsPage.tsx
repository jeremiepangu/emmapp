import { useEffect, useState } from 'react';
import { api, Client } from '../api';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    api.getClients().then(setClients);
  }, []);

  return (
    <div>
      <div className="page-header">
        <h2>Clients</h2>
        <p>Gestion des clients et consignes</p>
      </div>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom</th>
              <th>Segment</th>
              <th>Zone</th>
              <th>Téléphone</th>
              <th>Consignes</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td><span className="badge badge-info">{c.segment}</span></td>
                <td>{c.zone ?? '-'}</td>
                <td>{c.phone ?? '-'}</td>
                <td>
                  {c.consigneBalance} / {c.consigneLimit}
                  {c.consigneBalance > c.consigneLimit * 0.8 && (
                    <span className="badge badge-warning" style={{ marginLeft: 8 }}>Proche plafond</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

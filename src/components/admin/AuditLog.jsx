import React, { useEffect } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

const AuditLog = () => {
  const { data: logs, load, loading } = useGoogleSheets('AuditLog');

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="audit-log">
      <h3>📝 Journal d'audit</h3>
      
      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div className="audit-table-container">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Date/Heure</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {logs.slice().reverse().map((log, index) => (
                <tr key={index}>
                  <td>{new Date(log.timestamp).toLocaleString('fr-FR')}</td>
                  <td>{log.user}</td>
                  <td><strong>{log.action}</strong></td>
                  <td className="details">{JSON.stringify(log.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLog;

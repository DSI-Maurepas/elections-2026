import React, { useEffect } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

const ConfigBureaux = () => {
  const { data: bureaux, load, loading } = useGoogleSheets('Bureaux');

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="config-bureaux">
      <h3>📍 Configuration des bureaux de vote</h3>
      
      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Adresse</th>
              <th>Président</th>
              <th>Secrétaire</th>
              <th>Inscrits</th>
            </tr>
          </thead>
          <tbody>
            {bureaux.map(bureau => (
              <tr key={bureau.id}>
                <td>{bureau.id}</td>
                <td><strong>{bureau.nom}</strong></td>
                <td>{bureau.adresse}</td>
                <td>{bureau.president}</td>
                <td>{bureau.secretaire}</td>
                <td>{bureau.inscrits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ConfigBureaux;

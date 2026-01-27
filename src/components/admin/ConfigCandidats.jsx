import React, { useEffect } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

const ConfigCandidats = () => {
  const { state } = useElectionState();
  const { data: candidats, load, loading } = useGoogleSheets('Candidats');

  useEffect(() => {
    load();
  }, [load]);

  const tourActuel = state?.tourActuel ?? 1;

  const isActifPourTour = (c) => {
    if (tourActuel === 1) return c.actifT1;
    if (tourActuel === 2) return c.actifT2;
    return false;
  };

  return (
    <div className="config-candidats">
      <h3>👤 Configuration des candidats - Tour {tourActuel}</h3>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Liste / Parti</th>
              <th>Tour</th>
            </tr>
          </thead>
          <tbody>
            {candidats
              .filter(isActifPourTour)
              .sort((a, b) => a.ordre - b.ordre)
              .map((candidat) => (
                <tr key={candidat.listeId}>
                  <td>{candidat.listeId}</td>
                  <td>
                    <strong>
                      {candidat.teteListePrenom} {candidat.teteListeNom}
                    </strong>
                  </td>
                  <td>{candidat.nomListe}</td>
                  <td>
                    {tourActuel === 1 && candidat.actifT1 && 'Tour 1'}
                    {tourActuel === 2 && candidat.actifT2 && 'Tour 2'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ConfigCandidats;

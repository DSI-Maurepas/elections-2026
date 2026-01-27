import React, { useEffect, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import calculService from '../../services/calculService';

const SiegesCommunautaire = () => {
  const { state } = useElectionState();
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultats } = useGoogleSheets(
    state.tourActuel === 1 ? 'Résultats_T1' : 'Résultats_T2'
  );

  const [sieges, setSieges] = useState([]);
  const [totalSieges, setTotalSieges] = useState(5); // À paramétrer selon SQY

  useEffect(() => {
    if (resultats.length === 0 || candidats.length === 0) return;

    const results = calculService.calculerSiegesCommunautaires(
      resultats,
      candidats,
      totalSieges
    );
    setSieges(results);
  }, [resultats, candidats, totalSieges]);

  return (
    <div className="sieges-communautaire">
      <h2>🪑 Répartition des sièges - Conseil Communautaire (SQY)</h2>
      
      <div className="total-sieges">
        <strong>Total sièges à attribuer :</strong> {totalSieges}
      </div>

      <table className="sieges-table">
        <thead>
          <tr>
            <th>Candidat</th>
            <th>Voix</th>
            <th>%</th>
            <th>Sièges</th>
          </tr>
        </thead>
        <tbody>
          {sieges.map(s => (
            <tr key={s.candidatId}>
              <td><strong>{s.nom}</strong></td>
              <td>{s.voix.toLocaleString('fr-FR')}</td>
              <td>{s.pourcentage.toFixed(2)}%</td>
              <td className="sieges-number">{s.sieges}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="explication">
        <h4>Méthode de calcul :</h4>
        <p>Proportionnelle basée sur les résultats municipaux</p>
        <p>Règle préfectorale de Saint-Quentin-en-Yvelines</p>
      </div>
    </div>
  );
};

export default SiegesCommunautaire;

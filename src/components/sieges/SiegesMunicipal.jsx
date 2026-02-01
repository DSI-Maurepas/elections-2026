import React, { useEffect, useState } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import calculService from '../../services/calculService';
import { useElectionState } from '../../hooks/useElectionState';

const SiegesMunicipal = ({ electionState}) => {
  const { state } = useElectionState();
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultats } = useGoogleSheets(
    state.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2'
  );

  const [sieges, setSieges] = useState([]);
  const [totalSieges, setTotalSieges] = useState(29); // À paramétrer

  useEffect(() => {
    if (resultats.length === 0 || candidats.length === 0) return;

    const results = calculService.calculerSiegesMunicipaux(
      resultats,
      candidats,
      totalSieges
    );
    setSieges(results);
  }, [resultats, candidats, totalSieges]);

  return (
    <div className="sieges-municipal">
      <h2>🪑 Répartition des sièges - Conseil Municipal</h2>
      
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
            <th>Méthode</th>
          </tr>
        </thead>
        <tbody>
          {sieges.map(s => (
            <tr key={s.candidatId}>
              <td><strong>{s.nom}</strong></td>
              <td>{s.voix.toLocaleString('fr-FR')}</td>
              <td>{s.pourcentage.toFixed(2)}%</td>
              <td className="sieges-number">{s.sieges}</td>
              <td>{s.methode}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="explication">
        <h4>Méthode de calcul :</h4>
        <p>• 50% des sièges à la liste en tête (prime majoritaire)</p>
        <p>• Reste à la proportionnelle à la plus forte moyenne</p>
      </div>
    </div>
  );
};

export default SiegesMunicipal;
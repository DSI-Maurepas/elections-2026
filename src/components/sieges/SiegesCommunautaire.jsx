import React, { useEffect, useMemo, useState } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import calculService from '../../services/calculService';
import { useElectionState } from '../../hooks/useElectionState';

const SiegesCommunautaire = ({ electionState}) => {
  const { state } = useElectionState();
  // Source prioritaire : tableau précalculé dans Google Sheets
  const { data: seatsCommunity } = useGoogleSheets('Seats_Community');

  // Source de repli (calcul automatique)
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultats } = useGoogleSheets(state.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2');

  const [sieges, setSieges] = useState([]);
  const [totalSieges, setTotalSieges] = useState(6); // À paramétrer selon SQY

  const seatsCommunityRows = useMemo(() => {
    return (seatsCommunity || [])
      .filter(r => (r?.nomListe || r?.listeId))
      .map(r => ({
        listeId: (r.listeId || r.ListeID || '').toString().trim(),
        nomListe: (r.nomListe || r.NomListe || r.listeId || r.ListeID || '—').toString().trim(),
        voixMunicipal: Number(r.voixMunicipal ?? r.VoixMunicipal ?? r.voix ?? r.Voix ?? 0) || 0,
        pctMunicipal: Number(r.pctMunicipal ?? r.PctMunicipal ?? r.pourcentage ?? r.PctVoix ?? 0) || 0,
        eligible: typeof r.eligible === 'boolean' ? r.eligible : String(r.Eligible ?? '').toUpperCase() === 'TRUE',
        _raw: r}));
  }, [seatsCommunity]);

  useEffect(() => {
    // 1) Si Seats_Community est renseigné : on l'affiche.
    if (seatsCommunityRows.length > 0) {
      const computed = calculService.calculerSiegesCommunautairesDepuisListes(seatsCommunityRows, totalSieges);
      setSieges(Array.isArray(computed) ? computed : []);
      return;
    }

    // 2) Sinon, calcul automatique (fallback)
    if (!resultats?.length || !candidats?.length) {
      setSieges([]);
      return;
    }
    const results = calculService.calculerSiegesCommunautaires(resultats, candidats, totalSieges, { tour: state.tourActuel });
    setSieges(Array.isArray(results) ? results : []);
  }, [seatsCommunityRows, resultats, candidats, totalSieges, state.tourActuel]);

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
          {sieges.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '16px' }}>
                Aucune donnée de sièges disponible (vérifier <strong>Seats_Community</strong> ou la consolidation Résultats).
              </td>
            </tr>
          ) : (
            sieges.map(s => (
              <tr key={s.candidatId}>
                <td><strong>{s.nom}</strong></td>
                <td>{Number(s.voix || 0).toLocaleString('fr-FR')}</td>
                <td>{Number(s.pourcentage || 0).toFixed(2)}%</td>
                <td className="sieges-number">{Number(s.sieges || 0)}</td>
              </tr>
            ))
          )}
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
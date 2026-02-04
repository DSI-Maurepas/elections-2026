import React, { useEffect, useMemo, useState } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import calculService from '../../services/calculService';
import { useElectionState } from '../../hooks/useElectionState';

const SiegesMunicipal = ({ electionState}) => {
  const { state } = useElectionState();
  // Source prioritaire : tableau précalculé dans Google Sheets
  const { data: seatsMunicipal } = useGoogleSheets('Seats_Municipal');

  // Source de repli (calcul automatique) : candidats + résultats consolidés
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultats } = useGoogleSheets(state.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2');

  const [sieges, setSieges] = useState([]);
  const [infoMessage, setInfoMessage] = useState('');
  // Maurepas : paramètre local. Si ton référentiel est 35, on démarre à 35.
  // (Tu peux ensuite décider de le rendre configurable via constants/config.)
  const [totalSieges, setTotalSieges] = useState(35);

  const seatsMunicipalTour = useMemo(() => {
    const tour = Number(state.tourActuel) || 1;
    return (seatsMunicipal || [])
      .filter(r => Number(r?.tour) === tour)
      .filter(r => (r?.nomListe || r?.listeId))
      .map(r => ({
        listeId: r.listeId || r.ListeID || String(r.rowIndex ?? ''),
        nomListe: r.nomListe || r.NomListe || r.listeId || '—',
        voix: Number(r.voix) || 0,
        pctVoix: Number(r.pctVoix) || 0,
        eligible: !!r.eligible,
        _raw: r
      }));
  }, [seatsMunicipal, state.tourActuel]);

  useEffect(() => {
    // 1) Si le tableau Seats_Municipal est renseigné pour le tour courant :
    //    on l'utilise comme source de VOIX, puis on recalcule les sièges dans l'app
    //    (les colonnes Sieges* du Sheet peuvent être obsolètes ou non alignées).
    if (seatsMunicipalTour.length > 0) {
      const tour = Number(state.tourActuel) || 1;
      const maxPct = Math.max(0, ...seatsMunicipalTour.map(r => Number(r.pctVoix) || 0));
      if (tour === 1 && maxPct <= 50) {
        setInfoMessage('Tour 1 : pas de majorité absolue, sièges non attribués (second tour requis).');
        setSieges(seatsMunicipalTour
          .filter(r => r.eligible !== false)
          .map(r => ({
            ...r,
            prime: 0,
            proportionnels: 0,
            sieges: 0,
            methode: 'Second tour requis'
          })));
        return;
      }

      setInfoMessage('');
      const recalcules = calculService.calculerSiegesMunicipauxDepuisListes(
        seatsMunicipalTour,
        totalSieges
      ).map(r => ({
        ...r,
        methode: 'Calcul appli (depuis Seats_Municipal)'
      }));
      setSieges(recalcules);
      return;
    }

    // 2) Sinon, on tente le calcul automatique (comportement historique)
    if (!resultats?.length || !candidats?.length) {
      setInfoMessage('');
      setSieges([]);
      return;
    }
    const results = calculService.calculerSiegesMunicipaux(resultats, candidats, totalSieges, { tour: state.tourActuel });
    setSieges(Array.isArray(results) ? results : []);
  }, [seatsMunicipalTour, resultats, candidats, totalSieges, state.tourActuel]);

  return (
    <div className="sieges-municipal">
      <h2>🪑 Répartition des sièges - Conseil Municipal</h2>
      
      <div className="total-sieges">
        <strong>Total sièges à attribuer :</strong> {totalSieges}
      </div>

      {infoMessage && (
        <div className="alert alert-warning sieges-info-message" style={{ marginTop: '12px' }}>
          {infoMessage}
        </div>
      )}

      <table className="sieges-table">
        <thead>
          <tr>
            <th>LISTE</th>
            <th>Voix</th>
            <th>%</th>
            <th>Prime</th>
            <th>Prop.</th>
            <th>Total Sièges</th>
            <th>Méthode</th>
          </tr>
        </thead>
        <tbody>
          {sieges.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '16px' }}>
                Aucune donnée de sièges disponible (vérifier <strong>Seats_Municipal</strong> ou la consolidation Résultats).
              </td>
            </tr>
          ) : (
            sieges.map(s => (
              <tr key={s.candidatId || s.listeId}>
                <td><strong>{s.nom || s.nomListe}</strong></td>
                <td>{Number(s.voix || 0).toLocaleString('fr-FR')}</td>
                <td>{Number(s.pourcentage || 0).toFixed(2)}%</td>
                <td className="sieges-number">{Number(s.siegesPrime || 0)}</td>
                <td className="sieges-number">{Number(s.siegesProportionnels || 0)}</td>
                <td className="sieges-number">{Number(s.sieges || 0)}</td>
                <td>{s.methode}</td>
              </tr>
            ))
          )}
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
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
    if (seatsMunicipalTour.length > 0) {
      const recalcules = calculService
        .calculerSiegesMunicipauxDepuisListes(seatsMunicipalTour, totalSieges)
        .map(r => {
          const prime = Number(r?.siegesPrime ?? 0) || 0;
          const prop = Number(r?.siegesProportionnels ?? 0) || 0;
          const methode = prime > 0
            ? `Prime (${prime}) + Proportionnelle (${prop})`
            : `Proportionnelle (${prop})`;
          return { ...r, methode };
        });
      setSieges(recalcules);
      return;
    }

    if (!resultats?.length || !candidats?.length) {
      setSieges([]);
      return;
    }
    const results = calculService.calculerSiegesMunicipaux(resultats, candidats, totalSieges, { tour: state.tourActuel });
    setSieges(Array.isArray(results) ? results : []);
  }, [seatsMunicipalTour, resultats, candidats, totalSieges, state.tourActuel]);

  return (
    <div className="sieges-municipal">
      <h3>🪑 Répartition des sièges - Conseil Municipal</h3>
      
      <style>{`
/* Sticky + scroll uniquement pour les tableaux Sièges */
.sieges-scroll {
  position: relative;
  display: block;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
}

/* IMPORTANT: neutralise toute "responsive table" globale */
.sieges-scroll table { display: table !important; }
.sieges-scroll thead { display: table-header-group !important; }
.sieges-scroll tbody { display: table-row-group !important; }
.sieges-scroll tr { display: table-row !important; }
.sieges-scroll th,
.sieges-scroll td { display: table-cell !important; }

.sieges-scroll table {
  border-collapse: separate;
  border-spacing: 0;
  display: inline-table !important;
  table-layout: auto;
  min-width: 980px;
  width: 980px;
}

.sieges-scroll thead th {
  position: -webkit-sticky;
  position: sticky;
  top: 0;
  z-index: 20;
  padding: 12px 16px;
  background: #1e3c72;
  color: #fff;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sieges-scroll tbody td {
  padding: 10px 16px;
  border-bottom: 1px solid #e0e0e0;
}

.sieges-scroll th:nth-child(1),
.sieges-scroll td:nth-child(1) { min-width: 180px; }
.sieges-scroll th:nth-child(2),
.sieges-scroll td:nth-child(2) { min-width: 120px; text-align: right; }
.sieges-scroll th:nth-child(3),
.sieges-scroll td:nth-child(3) { min-width: 100px; text-align: right; }
.sieges-scroll th:nth-child(4),
.sieges-scroll td:nth-child(4) { min-width: 100px; text-align: center; }
.sieges-scroll th:nth-child(5),
.sieges-scroll td:nth-child(5) { min-width: 100px; text-align: center; }
.sieges-scroll th:nth-child(6),
.sieges-scroll td:nth-child(6) { min-width: 160px; text-align: center; }
.sieges-scroll th:nth-child(7),
.sieges-scroll td:nth-child(7) { min-width: 480px; }

.sieges-scroll td { white-space: nowrap; }
.sieges-scroll td:nth-child(7) { white-space: normal; }

/* 1ère colonne sticky */
.sieges-scroll th:first-child,
.sieges-scroll td:first-child {
  position: -webkit-sticky;
  position: sticky;
  left: 0;
  z-index: 30;
  background: #fff;
  background-clip: padding-box;
  box-shadow: 2px 0 8px rgba(0,0,0,0.12);
}
.sieges-scroll thead th:first-child {
  z-index: 40;
  background: #1e3c72;
  color: #fff;
}
.sieges-scroll tbody tr:nth-child(even) td:first-child {
  background: #f3f3f3;
}

/* ⚠️ CORRECTION : Styles pour total-sieges et explication */
.total-sieges {
  background: #e3f2fd;
  padding: 12px 20px;
  margin: 16px 0;
  border-left: 4px solid #2196F3;
  font-size: 1.1rem;
}

.explication {
  background: #fff3cd;
  border-left: 4px solid #ff9800;
  padding: 16px 20px;
  margin: 20px 0;
  border-radius: 4px;
}

.explication h4 {
  margin: 0 0 12px 0;
  color: #f57c00;
  font-size: 1.1rem;
}

.explication p {
  margin: 6px 0;
  color: #666;
}

      `}</style>
      
      <div className="total-sieges">
        Total sièges à attribuer : <strong> {totalSieges} </strong>
      </div>

      <div className="sieges-scroll">
        <table className="sieges-table">
          <thead>
            <tr>
              <th>LISTE</th>
              <th>VOIX</th>
              <th>%</th>
              <th>PRIME</th>
              <th>PROP.</th>
              <th>TOTAL SIÈGES</th>
              <th>MÉTHODE</th>
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
              <>
                {sieges.map(s => (
                  <tr key={s.candidatId || s.listeId}>
                    <td><strong>{s.nom || s.nomListe}</strong></td>
                    <td>{Number(s.voix || 0).toLocaleString('fr-FR')}</td>
                    <td>{Number(s.pourcentage || 0).toFixed(2)}%</td>
                    <td className="sieges-number">{Number(s.siegesPrime || 0)}</td>
                    <td className="sieges-number">{Number(s.siegesProportionnels || 0)}</td>
                    <td className="sieges-number">{Number(s.sieges || 0)}</td>
                    <td>{s.methode}</td>
                  </tr>
                ))}
                {/* ⚠️ CORRECTION : Ligne de total */}
                <tr style={{ fontWeight: 'bold', background: '#f5f5f5', borderTop: '2px solid #333' }}>
                  <td><strong>TOTAL</strong></td>
                  <td>{sieges.reduce((sum, s) => sum + (Number(s.voix) || 0), 0).toLocaleString('fr-FR')}</td>
                  <td>100%</td>
                  <td className="sieges-number">{sieges.reduce((sum, s) => sum + (Number(s.siegesPrime) || 0), 0)}</td>
                  <td className="sieges-number">{sieges.reduce((sum, s) => sum + (Number(s.siegesProportionnels) || 0), 0)}</td>
                  <td className="sieges-number">{sieges.reduce((sum, s) => sum + (Number(s.sieges) || 0), 0)}</td>
                  <td>—</td>
                </tr>
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ⚠️ CORRECTION : Bloc explication en orange/jaune */}
      <div className="explication">
        <h4>Méthode de calcul :</h4>
        <p>Prime majoritaire : 50% des sièges (arrondi au supérieur) à la liste en tête</p>
        <p>Reste : proportionnelle à la plus forte moyenne, seuil 5%</p>
      </div>
    </div>
  );
};

export default SiegesMunicipal;

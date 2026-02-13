import React, { useEffect, useMemo, useState } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import calculService from '../../services/calculService';
import { useElectionState } from '../../hooks/useElectionState';

const SiegesCommunautaire = ({ electionState }) => {
  const { state } = useElectionState();

  // Source prioritaire : tableau Google Sheets (voix municipales consolidées par liste)
  const { data: seatsCommunity } = useGoogleSheets('Seats_Community');

  // Source de repli (calcul automatique)
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultats } = useGoogleSheets(state.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2');

  const [sieges, setSieges] = useState([]);
  // Maurepas / SQY : total à ajuster si nécessaire. Ici 6 (attendu 5/1 sur ton cas).
  const [totalSieges, setTotalSieges] = useState(6);

  const seatsCommunityRows = useMemo(() => {
    return (seatsCommunity || [])
      .filter(r => (r?.nomListe || r?.listeId || r?.ListeID || r?.NomListe))
      .map(r => ({
        listeId: (r.listeId || r.ListeID || '').toString().trim(),
        nomListe: (r.nomListe || r.NomListe || r.listeId || r.ListeID || '—').toString().trim(),
        voix: Number(r.voixMunicipal ?? r.VoixMunicipal ?? r.voix ?? r.Voix ?? 0) || 0,
        pctVoix: Number(r.pctMunicipal ?? r.PctMunicipal ?? r.pourcentage ?? r.PctVoix ?? 0) || 0,
        eligible: typeof r.eligible === 'boolean' ? r.eligible : String(r.Eligible ?? '').toUpperCase() === 'TRUE',
        _raw: r
      }));
  }, [seatsCommunity]);

  useEffect(() => {
    // 1) Si Seats_Community est renseigné : on l'utilise comme source de VOIX, puis on calcule
    if (seatsCommunityRows.length > 0) {
      const computed = calculService
        .calculerSiegesCommunautairesDepuisListes(seatsCommunityRows, totalSieges)
        .map(r => {
          const prime = Number(r?.siegesPrime ?? 0) || 0;
          const prop = Number(r?.siegesProportionnels ?? 0) || 0;
          const methode = prime > 0
            ? `Prime (${prime}) + Proportionnelle (${prop})`
            : `Proportionnelle (${prop})`;
          return { ...r, methode };
        });
      setSieges(Array.isArray(computed) ? computed : []);
      return;
    }

    // 2) Sinon, fallback historique
    if (!resultats?.length || !candidats?.length) {
      setSieges([]);
      return;
    }

    const results = calculService.calculerSiegesCommunautaires(
      resultats,
      candidats,
      totalSieges,
      { tour: state.tourActuel }
    );
    const normalized = (Array.isArray(results) ? results : []).map(r => {
      const prime = Number(r?.siegesPrime ?? 0) || 0;
      const prop = Number(r?.siegesProportionnels ?? 0) || 0;
      const methode = prime > 0
        ? `Prime (${prime}) + Proportionnelle (${prop})`
        : `Proportionnelle (${prop})`;
      return { ...r, methode };
    });
    setSieges(normalized);
  }, [seatsCommunityRows, resultats, candidats, totalSieges, state.tourActuel]);

  return (
    <div className="sieges-communautaire">
      <h3>🪑 Répartition des sièges - Conseil Communautaire (SQY)</h3>

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

/* IMPORTANT: neutralise toute "responsive table" globale (empêche l'empilement en mode mobile) */
.sieges-scroll table { display: table !important; }
.sieges-scroll thead { display: table-header-group !important; }
.sieges-scroll tbody { display: table-row-group !important; }
.sieges-scroll tr { display: table-row !important; }
.sieges-scroll th,
.sieges-scroll td { display: table-cell !important; }

/* Le tableau doit dépasser la largeur mobile pour activer le scroll */
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
  background: #1e3c72;
  color: #fff;
  white-space: nowrap;
}

/* Largeurs minimales des colonnes pour éviter les chevauchements */
.sieges-scroll th:nth-child(1),
.sieges-scroll td:nth-child(1) { min-width: 140px; }
.sieges-scroll th:nth-child(2),
.sieges-scroll td:nth-child(2) { min-width: 110px; }
.sieges-scroll th:nth-child(3),
.sieges-scroll td:nth-child(3) { min-width: 80px; }
.sieges-scroll th:nth-child(4),
.sieges-scroll td:nth-child(4) { min-width: 80px; text-align: center; }
.sieges-scroll th:nth-child(5),
.sieges-scroll td:nth-child(5) { min-width: 80px; text-align: center; }
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
                  Aucune donnée de sièges disponible (vérifier <strong>Seats_Community</strong> ou la consolidation Résultats).
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
      </div>

      <div className="explication">
        <h4>Méthode de calcul :</h4>
        <p>Prime majoritaire : 50% des sièges (arrondi au supérieur) à la liste en tête</p>
        <p>Reste : proportionnelle à la plus forte moyenne, seuil 5%</p>
      </div>
    </div>
  );
};

export default SiegesCommunautaire;

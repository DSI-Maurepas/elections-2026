import React, { useEffect, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Consolidation communale des résultats
 * Totaux, pourcentages, classement
 */
const ResultatsConsolidation = () => {
  const { state: electionState } = useElectionState();
  const { data: bureaux } = useGoogleSheets('Bureaux');
  const { data: candidats } = useGoogleSheets('Candidats');
  const { 
    data: resultats, 
    load: loadResultats 
  } = useGoogleSheets(electionState.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2');

  const [consolidation, setConsolidation] = useState({
    totaux: {
      votants: 0,
      blancs: 0,
      nuls: 0,
      exprimes: 0
    },
    candidats: [],
    tauxParticipation: 0,
    totalInscrits: 0
  });

  useEffect(() => {
    loadResultats();
  }, [loadResultats]);

  useEffect(() => {
    if (resultats.length === 0) return;

    // Calculer totaux
    const totaux = resultats.reduce((acc, r) => ({
      votants: acc.votants + (r.votants || 0),
      blancs: acc.blancs + (r.blancs || 0),
      nuls: acc.nuls + (r.nuls || 0),
      exprimes: acc.exprimes + (r.exprimes || 0)
    }), { votants: 0, blancs: 0, nuls: 0, exprimes: 0 });

    // Calculer voix par candidat
    const candidatsResults = candidats.map(candidat => {
      const totalVoix = resultats.reduce((sum, r) => {
        return sum + (r.voix?.[candidat.id] || 0);
      }, 0);

      const pourcentage = totaux.exprimes > 0 
        ? (totalVoix / totaux.exprimes) * 100 
        : 0;

      return {
        ...candidat,
        voix: totalVoix,
        pourcentage
      };
    });

    // Trier par nombre de voix décroissant
    candidatsResults.sort((a, b) => b.voix - a.voix);

    // Calculer inscrits total
    const totalInscrits = bureaux.reduce((sum, b) => sum + (b.inscrits || 0), 0);
    const tauxParticipation = totalInscrits > 0 
      ? (totaux.votants / totalInscrits) * 100 
      : 0;

    setConsolidation({
      totaux,
      candidats: candidatsResults,
      tauxParticipation,
      totalInscrits
    });
  }, [resultats, candidats, bureaux]);

  return (
    <div className="resultats-consolidation">
      <h2>📊 Consolidation communale - Tour {electionState.tourActuel}</h2>

      {/* Chiffres globaux */}
      <div className="totaux-grid">
        <div className="total-card">
          <div className="card-value">{consolidation.totalInscrits.toLocaleString('fr-FR')}</div>
          <div className="card-label">Inscrits</div>
        </div>

        <div className="total-card">
          <div className="card-value">{consolidation.totaux.votants.toLocaleString('fr-FR')}</div>
          <div className="card-label">Votants</div>
        </div>

        <div className="total-card highlight">
          <div className="card-value">{consolidation.tauxParticipation.toFixed(2)}%</div>
          <div className="card-label">Participation</div>
        </div>

        <div className="total-card">
          <div className="card-value">{consolidation.totaux.blancs.toLocaleString('fr-FR')}</div>
          <div className="card-label">Blancs</div>
        </div>

        <div className="total-card">
          <div className="card-value">{consolidation.totaux.nuls.toLocaleString('fr-FR')}</div>
          <div className="card-label">Nuls</div>
        </div>

        <div className="total-card">
          <div className="card-value">{consolidation.totaux.exprimes.toLocaleString('fr-FR')}</div>
          <div className="card-label">Exprimés</div>
        </div>
      </div>

      {/* Résultats par candidat */}
      <div className="resultats-candidats">
        <h3>Résultats par candidat :</h3>

        <table className="candidats-table">
          <thead>
            <tr>
              <th>Rang</th>
              <th>Candidat</th>
              <th>Voix</th>
              <th>% Exprimés</th>
              <th>% Inscrits</th>
              <th>Barre visuelle</th>
            </tr>
          </thead>
          <tbody>
            {consolidation.candidats.map((candidat, index) => (
              <tr key={candidat.id} className={index < 2 ? 'qualified' : ''}>
                <td className="rank">
                  <span className={`rank-badge rank-${index + 1}`}>
                    {index + 1}
                  </span>
                </td>
                <td className="candidat-name">
                  <strong>{candidat.nom}</strong>
                </td>
                <td className="voix">
                  {candidat.voix.toLocaleString('fr-FR')}
                </td>
                <td className="percentage">
                  {candidat.pourcentage.toFixed(2)}%
                </td>
                <td className="percentage-inscrits">
                  {consolidation.totalInscrits > 0
                    ? ((candidat.voix / consolidation.totalInscrits) * 100).toFixed(2)
                    : 0}%
                </td>
                <td className="progress-bar">
                  <div className="bar-container">
                    <div 
                      className="bar-fill"
                      style={{ 
                        width: `${candidat.pourcentage}%`,
                        backgroundColor: index === 0 ? '#4CAF50' : index === 1 ? '#2196F3' : '#9E9E9E'
                      }}
                    >
                      {candidat.pourcentage > 10 && (
                        <span className="bar-text">{candidat.pourcentage.toFixed(1)}%</span>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {consolidation.candidats.length >= 2 && (
          <div className="qualified-notice">
            <strong>Les 2 premiers candidats sont qualifiés pour le 2nd tour</strong>
          </div>
        )}
      </div>

      {/* Statistiques complémentaires */}
      <div className="stats-complementaires">
        <h3>Statistiques :</h3>
        <div className="stats-row">
          <span>Bureaux déclarés :</span>
          <span><strong>{resultats.length} / {bureaux.length}</strong></span>
        </div>
        <div className="stats-row">
          <span>Taux de blancs :</span>
          <span>
            {consolidation.totaux.votants > 0
              ? ((consolidation.totaux.blancs / consolidation.totaux.votants) * 100).toFixed(2)
              : 0}%
          </span>
        </div>
        <div className="stats-row">
          <span>Taux de nuls :</span>
          <span>
            {consolidation.totaux.votants > 0
              ? ((consolidation.totaux.nuls / consolidation.totaux.votants) * 100).toFixed(2)
              : 0}%
          </span>
        </div>
        <div className="stats-row">
          <span>Écart 1er/2ème :</span>
          <span>
            {consolidation.candidats.length >= 2
              ? (consolidation.candidats[0].voix - consolidation.candidats[1].voix).toLocaleString('fr-FR') + ' voix'
              : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ResultatsConsolidation;

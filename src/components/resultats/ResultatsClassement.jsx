import React, { useEffect, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Classement officiel des candidats
 * Résultats consolidés et classement final
 */
const ResultatsClassement = () => {
  const { state: electionState } = useElectionState();
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultats } = useGoogleSheets(
    electionState.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2'
  );

  const [classement, setClassement] = useState([]);
  const [totaux, setTotaux] = useState({ exprimes: 0, inscrits: 0 });

  useEffect(() => {
    if (resultats.length === 0 || candidats.length === 0) return;

    const totalExprimes = resultats.reduce((sum, r) => sum + (r.exprimes || 0), 0);
    
    const candidatsAvecVoix = candidats.map(candidat => {
      const voix = resultats.reduce((sum, r) => {
        return sum + (r.voix?.[candidat.id] || 0);
      }, 0);

      return {
        ...candidat,
        voix,
        pourcentage: totalExprimes > 0 ? (voix / totalExprimes) * 100 : 0
      };
    });

    // Trier par voix décroissant
    candidatsAvecVoix.sort((a, b) => b.voix - a.voix);

    setClassement(candidatsAvecVoix);
    setTotaux({ exprimes: totalExprimes, inscrits: 0 });
  }, [resultats, candidats]);

  return (
    <div className="resultats-classement">
      <h2>🏆 Classement officiel - Tour {electionState.tourActuel}</h2>

      <div className="classement-list">
        {classement.map((candidat, index) => (
          <div 
            key={candidat.id} 
            className={`classement-card rank-${index + 1} ${index < 2 ? 'qualified' : ''}`}
          >
            <div className="rank-number">
              <span className="rank-badge">{index + 1}</span>
            </div>
            
            <div className="candidat-info">
              <h3>{candidat.nom}</h3>
              {candidat.parti && <p className="parti">{candidat.parti}</p>}
            </div>

            <div className="voix-info">
              <div className="voix-number">
                {candidat.voix.toLocaleString('fr-FR')} voix
              </div>
              <div className="pourcentage">
                {candidat.pourcentage.toFixed(2)}% des exprimés
              </div>
            </div>

            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${candidat.pourcentage}%`,
                  backgroundColor: index === 0 ? '#4CAF50' : 
                                   index === 1 ? '#2196F3' : '#9E9E9E'
                }}
              />
            </div>

            {index < 2 && electionState.tourActuel === 1 && (
              <div className="qualified-badge">
                ✅ Qualifié pour le 2nd tour
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="classement-footer">
        <p><strong>Total des suffrages exprimés :</strong> {totaux.exprimes.toLocaleString('fr-FR')}</p>
      </div>
    </div>
  );
};

export default ResultatsClassement;

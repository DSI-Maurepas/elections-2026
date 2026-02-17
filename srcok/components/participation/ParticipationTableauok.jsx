import React, { useEffect, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Tableau de consolidation de la participation
 * Vue globale tous bureaux confondus
 */
const ParticipationTableau = () => {
  const { state: electionState } = useElectionState();
  const { data: bureaux, load: loadBureaux } = useGoogleSheets('Bureaux');
  const { 
    data: participation, 
    load: loadParticipation 
  } = useGoogleSheets(electionState.tourActuel === 1 ? 'Participation_T1' : 'Participation_T2');

  const [totaux, setTotaux] = useState({
    inscrits: 0,
    '09h': 0,
    '10h': 0,
    '11h': 0,
    '12h': 0,
    '13h': 0,
    '14h': 0,
    '15h': 0,
    '16h': 0,
    '17h': 0,
    '18h': 0,
    '19h': 0,
    '20h': 0
  });

  useEffect(() => {
    loadBureaux();
    loadParticipation();
  }, [loadBureaux, loadParticipation]);

  useEffect(() => {
    // Calculer les totaux
    const newTotaux = participation.reduce((acc, p) => {
      return {
        inscrits: acc.inscrits + (p.inscrits || 0),
        '09h': acc['09h'] + (p.votants09h || 0),
        '10h': acc['10h'] + (p.votants10h || 0),
        '11h': acc['11h'] + (p.votants11h || 0),
        '12h': acc['12h'] + (p.votants12h || 0),
        '13h': acc['13h'] + (p.votants13h || 0),
        '14h': acc['14h'] + (p.votants14h || 0),
        '15h': acc['15h'] + (p.votants15h || 0),
        '16h': acc['16h'] + (p.votants16h || 0),
        '17h': acc['17h'] + (p.votants17h || 0),
        '18h': acc['18h'] + (p.votants18h || 0),
        '19h': acc['19h'] + (p.votants19h || 0),
        '20h': acc['20h'] + (p.votants20h || 0)
      };
    }, {
      inscrits: 0,
      '09h': 0,
      '10h': 0,
      '11h': 0,
      '12h': 0,
      '13h': 0,
      '14h': 0,
      '15h': 0,
      '16h': 0,
      '17h': 0,
      '18h': 0,
      '19h': 0,
      '20h': 0
    });

    setTotaux(newTotaux);
  }, [participation]);

  const getBureauData = (bureauId) => {
    return participation.find(p => p.bureauId === bureauId);
  };

  const calculateRate = (votants, inscrits) => {
    if (!inscrits) return 0;
    return ((votants / inscrits) * 100).toFixed(2);
  };


  // Heures des remontées (09h -> 20h)
  const HOURS = ['09h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h'];

  return (
    <div className="participation-tableau">
      <h2>📊 Consolidation de la participation - Tour {electionState.tourActuel}</h2>

      <div className="tableau-scroll">
        <table className="participation-table participation-table--compact">
          <thead>
            <tr>
              <th className="bureau-col">Bureau</th>
              <th className="inscrits-col">Inscrits</th>
              {HOURS.map((h) => (
                <th key={h} className="hour-col">{h}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {bureaux.map((bureau, index) => {
              const data = getBureauData(bureau.id);
              // IMPORTANT : toujours utiliser bureau.inscrits (config) et non data.inscrits (saisie)
              const inscrits = bureau.inscrits || 0;

              return (
                <tr
                  key={bureau.id ?? `${bureau.nom}-${index}`}
                  className={data ? 'has-data' : 'no-data'}
                >
                  <td className="bureau-name">{bureau.nom}</td>
                  <td className="number">{inscrits.toLocaleString('fr-FR')}</td>

                  {HOURS.map((h) => {
                    const field = `votants${h}`;
                    const votants = data?.[field] || 0;
                    const rate = calculateRate(votants, inscrits);
                    return (
                      <td key={`${bureau.id}-${h}`} className={`hour-cell ${votants > 0 ? "is-filled" : "is-empty"}`}>
                        <div className="hour-votants">{votants.toLocaleString('fr-FR')}</div>
                        <div className="hour-percent">{rate}%</div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr className="total-row has-data">
              <td><strong>TOTAL COMMUNAL</strong></td>
              <td className="number"><strong>{totaux.inscrits.toLocaleString('fr-FR')}</strong></td>

              {HOURS.map((h) => (
                <td key={`total-${h}`} className="hour-cell">
                  <div className="hour-votants"><strong>{(totaux[h] || 0).toLocaleString('fr-FR')}</strong></div>
                  <div className="hour-percent"><strong>{calculateRate((totaux[h] || 0), totaux.inscrits)}%</strong></div>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="legend">
        <p><span className="legend-item has-data" aria-hidden="true"></span> Bureau avec données saisies</p>
        <p><span className="legend-item no-data" aria-hidden="true"></span> Bureau en attente de saisie</p>
        <p><span className="legend-item cell-empty" aria-hidden="true"></span> Cellule heure non renseignée (fond rouge)</p>
        <p><span className="legend-item cell-filled" aria-hidden="true"></span> Cellule heure renseignée (fond vert)</p>
      </div>
    </div>
  );
};

export default ParticipationTableau;

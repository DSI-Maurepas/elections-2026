import React from 'react';
import { useElectionState } from '../../hooks/useElectionState';

const ConfigurationT2 = () => {
  const { state } = useElectionState();

  return (
    <div className="config-t2">
      <h2>⚙️ Configuration 2nd tour</h2>
      
      {state.candidatsQualifies && state.candidatsQualifies.length === 2 ? (
        <div className="config-info">
          <h3>Candidats qualifiés :</h3>
          <ul>
            {state.candidatsQualifies.map((c, i) => (
              <li key={c.id}>
                <strong>{i + 1}.</strong> {c.nom} ({c.voix} voix au T1)
              </li>
            ))}
          </ul>
          
          <div className="date-info">
            <p><strong>Date du 2nd tour :</strong> {new Date(state.dateT2).toLocaleDateString('fr-FR')}</p>
            <p><strong>Horaires :</strong> 08h00 - 20h00</p>
          </div>
        </div>
      ) : (
        <p className="warning">Le passage au 2nd tour n'a pas encore été effectué.</p>
      )}
    </div>
  );
};

export default ConfigurationT2;

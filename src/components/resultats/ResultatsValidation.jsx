import React, { useEffect, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Validation des résultats
 * Vérifications et contrôles de cohérence
 */
const ResultatsValidation = ({ onValidate }) => {
  const { state: electionState } = useElectionState();
  const { data: bureaux } = useGoogleSheets('Bureaux');
  const { data: resultats, load: loadResultats } = useGoogleSheets(
    electionState.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2'
  );

  const [validation, setValidation] = useState({
    bureaux: [],
    erreurs: [],
    avertissements: [],
    isValid: false
  });

  useEffect(() => {
    loadResultats();
  }, [loadResultats]);

  useEffect(() => {
    performValidation();
  }, [resultats, bureaux]);

  const performValidation = () => {
    const bureauxValidation = [];
    const erreurs = [];
    const avertissements = [];

    // Vérifier chaque bureau
    bureaux.forEach(bureau => {
      const resultat = resultats.find(r => r.bureauId === bureau.id);
      
      const bureauCheck = {
        bureauId: bureau.id,
        bureauNom: bureau.nom,
        isDeclare: !!resultat,
        erreurs: [],
        avertissements: []
      };

      if (!resultat) {
        bureauCheck.erreurs.push('Résultats non déclarés');
        erreurs.push(`${bureau.nom}: Résultats manquants`);
      } else {
        // Contrôle 1: votants = blancs + nuls + exprimés
        const somme = (resultat.blancs || 0) + (resultat.nuls || 0) + (resultat.exprimes || 0);
        if (resultat.votants !== somme) {
          bureauCheck.erreurs.push(
            `Votants (${resultat.votants}) ≠ Blancs + Nuls + Exprimés (${somme})`
          );
          erreurs.push(`${bureau.nom}: Incohérence votants`);
        }

        // Contrôle 2: somme voix = exprimés
        const sommeVoix = Object.values(resultat.voix || {}).reduce(
          (sum, v) => sum + (v || 0), 0
        );
        if (sommeVoix !== resultat.exprimes) {
          bureauCheck.erreurs.push(
            `Somme voix (${sommeVoix}) ≠ Exprimés (${resultat.exprimes})`
          );
          erreurs.push(`${bureau.nom}: Incohérence exprimés`);
        }

        // Avertissement: taux de blancs élevé
        if (resultat.votants > 0) {
          const tauxBlancs = (resultat.blancs / resultat.votants) * 100;
          if (tauxBlancs > 10) {
            bureauCheck.avertissements.push(`Taux de blancs élevé: ${tauxBlancs.toFixed(1)}%`);
            avertissements.push(`${bureau.nom}: ${tauxBlancs.toFixed(1)}% de blancs`);
          }
        }
      }

      bureauxValidation.push(bureauCheck);
    });

    setValidation({
      bureaux: bureauxValidation,
      erreurs,
      avertissements,
      isValid: erreurs.length === 0 && bureauxValidation.every(b => b.isDeclare)
    });
  };

  const handleValidateClick = () => {
    if (validation.isValid && onValidate) {
      onValidate();
    }
  };

  return (
    <div className="resultats-validation">
      <h2>✅ Validation des résultats - Tour {electionState.tourActuel}</h2>

      {/* Statut global */}
      <div className={`validation-status ${validation.isValid ? 'valid' : 'invalid'}`}>
        {validation.isValid ? (
          <>
            <div className="status-icon">✅</div>
            <div className="status-text">
              <strong>Tous les résultats sont valides</strong>
              <p>Tous les bureaux ont déclaré leurs résultats sans erreur</p>
            </div>
          </>
        ) : (
          <>
            <div className="status-icon">⚠️</div>
            <div className="status-text">
              <strong>Validation incomplète</strong>
              <p>{validation.erreurs.length} erreur(s) à corriger</p>
            </div>
          </>
        )}
      </div>

      {/* Erreurs */}
      {validation.erreurs.length > 0 && (
        <div className="erreurs-section">
          <h3>❌ Erreurs bloquantes ({validation.erreurs.length})</h3>
          <ul className="erreurs-list">
            {validation.erreurs.map((erreur, index) => (
              <li key={index} className="erreur-item">{erreur}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Avertissements */}
      {validation.avertissements.length > 0 && (
        <div className="avertissements-section">
          <h3>⚠️ Avertissements ({validation.avertissements.length})</h3>
          <ul className="avertissements-list">
            {validation.avertissements.map((avert, index) => (
              <li key={index} className="avertissement-item">{avert}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Détail par bureau */}
      <div className="bureaux-detail">
        <h3>Détail par bureau :</h3>
        <table className="validation-table">
          <thead>
            <tr>
              <th>Bureau</th>
              <th>Statut</th>
              <th>Erreurs</th>
              <th>Avertissements</th>
            </tr>
          </thead>
          <tbody>
            {validation.bureaux.map(bureau => (
              <tr 
                key={bureau.bureauId}
                className={
                  bureau.erreurs.length > 0 ? 'error' :
                  !bureau.isDeclare ? 'warning' : 'success'
                }
              >
                <td>{bureau.bureauNom}</td>
                <td>
                  {!bureau.isDeclare ? '❌ Non déclaré' :
                   bureau.erreurs.length > 0 ? '⚠️ Erreurs' :
                   '✅ Valide'}
                </td>
                <td>
                  {bureau.erreurs.length > 0 && (
                    <ul className="mini-list">
                      {bureau.erreurs.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  {bureau.avertissements.length > 0 && (
                    <ul className="mini-list">
                      {bureau.avertissements.map((avert, i) => (
                        <li key={i}>{avert}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {onValidate && (
        <div className="validation-actions">
          <button
            onClick={handleValidateClick}
            disabled={!validation.isValid}
            className="btn-validate"
          >
            {validation.isValid ? '✅ Verrouiller le tour' : '❌ Impossible de verrouiller'}
          </button>
          {!validation.isValid && (
            <p className="validation-help">
              Corrigez toutes les erreurs avant de verrouiller le tour
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultatsValidation;

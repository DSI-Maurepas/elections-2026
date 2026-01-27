import React, { useEffect, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import auditService from '../../services/auditService';

const PassageSecondTour = () => {
  const { state: electionState, passerSecondTour } = useElectionState();
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultats } = useGoogleSheets('Résultats_T1');

  const [classement, setClassement] = useState([]);
  const [candidatsQualifies, setCandidatsQualifies] = useState([]);
  const [egalite, setEgalite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (resultats.length === 0 || candidats.length === 0) return;

    const totalExprimes = resultats.reduce((sum, r) => sum + (r.exprimes || 0), 0);
    
    const candidatsAvecVoix = candidats.map(candidat => {
      const voix = resultats.reduce((sum, r) => sum + (r.voix?.[candidat.id] || 0), 0);
      return {
        ...candidat,
        voix,
        pourcentage: totalExprimes > 0 ? (voix / totalExprimes) * 100 : 0
      };
    });

    candidatsAvecVoix.sort((a, b) => b.voix - a.voix);

    setClassement(candidatsAvecVoix);

    // Déterminer les 2 premiers automatiquement
    if (candidatsAvecVoix.length >= 2) {
      const premier = candidatsAvecVoix[0];
      const second = candidatsAvecVoix[1];

      // Vérifier égalité
      if (premier.voix === second.voix) {
        setEgalite(true);
        setMessage({
          type: 'warning',
          text: '⚠️ Égalité parfaite entre les 2 premiers candidats. Décision admin requise.'
        });
      } else {
        setEgalite(false);
        setCandidatsQualifies([premier, second]);
      }
    }
  }, [resultats, candidats]);

  const handlePassageT2 = async () => {
    if (candidatsQualifies.length !== 2) {
      setMessage({
        type: 'error',
        text: 'Vous devez sélectionner exactement 2 candidats'
      });
      return;
    }

    if (window.confirm(
      `Confirmer le passage au 2nd tour avec:\n1. ${candidatsQualifies[0].nom}\n2. ${candidatsQualifies[1].nom}`
    )) {
      try {
        setLoading(true);
        await passerSecondTour(candidatsQualifies);
        await auditService.log('PASSAGE_SECOND_TOUR', {
          candidats: candidatsQualifies.map(c => ({ id: c.id, nom: c.nom, voix: c.voix }))
        });
        setMessage({
          type: 'success',
          text: '✅ Passage au 2nd tour effectué avec succès'
        });
      } catch (error) {
        setMessage({
          type: 'error',
          text: `Erreur: ${error.message}`
        });
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="passage-t2">
      <h2>➡️ Passage au 2nd tour</h2>

      <div className="classement-t1">
        <h3>Classement 1er tour :</h3>
        <table>
          <thead>
            <tr>
              <th>Rang</th>
              <th>Candidat</th>
              <th>Voix</th>
              <th>%</th>
              <th>Qualifié</th>
            </tr>
          </thead>
          <tbody>
            {classement.map((c, index) => (
              <tr key={c.id} className={index < 2 ? 'qualified' : ''}>
                <td>{index + 1}</td>
                <td><strong>{c.nom}</strong></td>
                <td>{c.voix.toLocaleString('fr-FR')}</td>
                <td>{c.pourcentage.toFixed(2)}%</td>
                <td>{index < 2 ? '✅' : '❌'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {!egalite && candidatsQualifies.length === 2 && (
        <div className="qualification-panel">
          <h3>Candidats qualifiés pour le 2nd tour :</h3>
          <div className="qualifies-list">
            <div className="qualifie-card">
              <div className="rank">1er</div>
              <div className="nom">{candidatsQualifies[0].nom}</div>
              <div className="voix">{candidatsQualifies[0].voix.toLocaleString('fr-FR')} voix</div>
            </div>
            <div className="qualifie-card">
              <div className="rank">2ème</div>
              <div className="nom">{candidatsQualifies[1].nom}</div>
              <div className="voix">{candidatsQualifies[1].voix.toLocaleString('fr-FR')} voix</div>
            </div>
          </div>
        </div>
      )}

      <div className="actions">
        <button
          onClick={handlePassageT2}
          disabled={loading || egalite || candidatsQualifies.length !== 2}
          className="btn-primary"
        >
          {loading ? 'Traitement...' : '➡️ Confirmer passage au 2nd tour'}
        </button>
      </div>
    </div>
  );
};

export default PassageSecondTour;

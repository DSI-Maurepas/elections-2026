import React, { useState, useEffect } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import auditService from '../../services/auditService';

/**
 * Saisie de la participation par bureau
 * Votants cumulés de 08h à 20h
 */
const ParticipationSaisie = () => {
  const { state: electionState } = useElectionState();
  const { data: bureaux, load: loadBureaux } = useGoogleSheets('Bureaux');
  const { 
    data: participation, 
    load: loadParticipation,
    create,
    update 
  } = useGoogleSheets(electionState.tourActuel === 1 ? 'Participation_T1' : 'Participation_T2');

  const [selectedBureau, setSelectedBureau] = useState('');
  const [inscrits, setInscrits] = useState(0);
  const [votants, setVotants] = useState({
    '08h': 0,
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
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadBureaux();
    loadParticipation();
  }, [loadBureaux, loadParticipation]);

  useEffect(() => {
    if (selectedBureau && bureaux.length > 0) {
      const bureau = bureaux.find(b => b.id === selectedBureau);
      if (bureau) {
        setInscrits(bureau.inscrits || 0);
        
        // Charger la participation existante
        const existingData = participation.find(p => p.bureauId === selectedBureau);
        if (existingData) {
          setVotants({
            '08h': existingData.votants08h || 0,
            '09h': existingData.votants09h || 0,
            '10h': existingData.votants10h || 0,
            '11h': existingData.votants11h || 0,
            '12h': existingData.votants12h || 0,
            '13h': existingData.votants13h || 0,
            '14h': existingData.votants14h || 0,
            '15h': existingData.votants15h || 0,
            '16h': existingData.votants16h || 0,
            '17h': existingData.votants17h || 0,
            '18h': existingData.votants18h || 0,
            '19h': existingData.votants19h || 0,
            '20h': existingData.votants20h || 0
          });
        }
      }
    }
  }, [selectedBureau, bureaux, participation]);

  const handleVotantsChange = (heure, value) => {
    const numValue = parseInt(value) || 0;
    
    // Validation : ne peut pas dépasser les inscrits
    if (numValue > inscrits) {
      setMessage({
        type: 'error',
        text: `Le nombre de votants ne peut pas dépasser ${inscrits} inscrits`
      });
      return;
    }

    // Validation : doit être cumulatif (croissant)
    const heures = ['08h','09h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h'];
    const currentIndex = heures.indexOf(heure);
    
    if (currentIndex > 0) {
      const prevHeure = heures[currentIndex - 1];
      if (numValue < votants[prevHeure]) {
        setMessage({
          type: 'error',
          text: 'Les votants doivent être cumulatifs (croissants)'
        });
        return;
      }
    }

    setVotants(prev => ({
      ...prev,
      [heure]: numValue
    }));
    setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedBureau) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner un bureau' });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const data = {
        bureauId: selectedBureau,
        tour: electionState.tourActuel,
        inscrits: inscrits,
        votants08h: votants['08h'],
        votants09h: votants['09h'],
        votants10h: votants['10h'],
        votants11h: votants['11h'],
        votants12h: votants['12h'],
        votants13h: votants['13h'],
        votants14h: votants['14h'],
        votants15h: votants['15h'],
        votants16h: votants['16h'],
        votants17h: votants['17h'],
        votants18h: votants['18h'],
        votants19h: votants['19h'],
        votants20h: votants['20h'],
        timestamp: new Date().toISOString()
      };

      // Vérifier si existe déjà
      const existingData = participation.find(p => p.bureauId === selectedBureau);
      
      if (existingData) {
        await update(existingData.rowIndex, data);
        await auditService.log('UPDATE_PARTICIPATION', {
          bureau: selectedBureau,
          tour: electionState.tourActuel
        });
      } else {
        await create(data);
        await auditService.log('CREATE_PARTICIPATION', {
          bureau: selectedBureau,
          tour: electionState.tourActuel
        });
      }

      setMessage({
        type: 'success',
        text: 'Participation enregistrée avec succès'
      });

      await loadParticipation();

      // Notifie les autres vues (consolidation / stats) qu'une écriture vient d'avoir lieu
      window.dispatchEvent(new CustomEvent('sheets:changed', {
        detail: {
          sheetName: (electionState.tourActuel === 1 ? 'Participation_T1' : 'Participation_T2'),
          bureauId: selectedBureau,
          ts: Date.now()
        }
      }));

    } catch (error) {
      console.error('Erreur enregistrement:', error);
      setMessage({
        type: 'error',
        text: `Erreur : ${error.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="participation-saisie">
      <h2>📋 Saisie de la participation - Tour {electionState.tourActuel}</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Bureau de vote :</label>
          <select
            className="bureau-select"
            value={selectedBureau}
            onChange={(e) => setSelectedBureau(e.target.value)}
            required
          >
            <option value="">-- Sélectionner un bureau --</option>
            {bureaux.map(bureau => {
              const rawId = String(bureau.id ?? '').trim();
              const bvLabel = rawId.toUpperCase().startsWith('BV')
                ? rawId.replace(/^BV\s*/i, 'BV ')
                : `BV ${rawId}`;
              return (
                <option key={bureau.id} value={bureau.id}>
                  {bvLabel} — {bureau.nom} ({bureau.inscrits} inscrits)
                </option>
              );
            })}
          </select>
        </div>

        {selectedBureau && (
          <>
            <div className="inscrits-info">
              <strong>Inscrits :</strong> {inscrits.toLocaleString('fr-FR')}
            </div>

            <div className="votants-grid">
              <h3>Votants cumulés par heure :</h3>
              
              {['08h','09h','10h','11h','12h','13h','14h','15h','16h','17h','18h','19h','20h'].map(heure => (
                <div key={heure} className="votants-row">
                  <label>{heure} :</label>
                  <input
                    type="number"
                    min="0"
                    max={inscrits}
                    value={votants[heure]}
                    onChange={(e) => setVotants(prev => ({ ...prev, [heure]: e.target.value }))}
                    onBlur={(e) => handleVotantsChange(heure, e.target.value)}
                  />
                  <span className="percentage">
                    {inscrits > 0 ? ((votants[heure] / inscrits) * 100).toFixed(2) : 0}%
                  </span>
                </div>
              ))}
            </div>

            {message && (
              <div className={`message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="form-actions">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Enregistrement...' : '💾 Enregistrer'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default ParticipationSaisie;

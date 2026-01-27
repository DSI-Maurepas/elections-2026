import React, { useState, useEffect } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import { validateResultats } from '../../utils/validators';
import auditService from '../../services/auditService';

const ResultatsSaisieBureau = () => {
  const { state: electionState } = useElectionState();
  const { data: bureaux, load: loadBureaux } = useGoogleSheets('Bureaux');
  const { data: candidats, load: loadCandidats } = useGoogleSheets('Candidats');
  const { 
    data: resultats, 
    load: loadResultats,
    create,
    update 
  } = useGoogleSheets(electionState.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2');

  const [selectedBureau, setSelectedBureau] = useState('');
  const [formData, setFormData] = useState({
    votants: 0,
    blancs: 0,
    nuls: 0,
    exprimes: 0,
    voix: {}
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadBureaux();
    loadCandidats();
    loadResultats();
  }, [loadBureaux, loadCandidats, loadResultats]);

  useEffect(() => {
    const initialVoix = {};
    candidats.forEach(c => {
      initialVoix[c.id] = 0;
    });

    if (selectedBureau) {
      const existing = resultats.find(r => r.bureauId === selectedBureau);
      if (existing) {
        setFormData({
          votants: existing.votants || 0,
          blancs: existing.blancs || 0,
          nuls: existing.nuls || 0,
          exprimes: existing.exprimes || 0,
          voix: existing.voix || initialVoix
        });
      } else {
        setFormData({
          votants: 0,
          blancs: 0,
          nuls: 0,
          exprimes: 0,
          voix: initialVoix
        });
      }
    }
  }, [selectedBureau, candidats, resultats]);

  useEffect(() => {
    const sommeVoix = Object.values(formData.voix).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
    if (sommeVoix !== formData.exprimes) {
      setFormData(prev => ({
        ...prev,
        exprimes: sommeVoix
      }));
    }
  }, [formData.voix]);

  const handleFieldChange = (field, value) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: numValue
    }));
    setErrors({});
    setMessage(null);
  };

  const handleVoixChange = (candidatId, value) => {
    const numValue = parseInt(value) || 0;
    setFormData(prev => ({
      ...prev,
      voix: {
        ...prev.voix,
        [candidatId]: numValue
      }
    }));
    setErrors({});
    setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedBureau) {
      setMessage({ type: 'error', text: "Veuillez selectionner un bureau" });
      return;
    }

    const validation = validateResultats(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      setMessage({
        type: 'error',
        text: "Veuillez corriger les erreurs avant d'enregistrer"
      });
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const data = {
        bureauId: selectedBureau,
        tour: electionState.tourActuel,
        votants: formData.votants,
        blancs: formData.blancs,
        nuls: formData.nuls,
        exprimes: formData.exprimes,
        voix: formData.voix,
        timestamp: new Date().toISOString()
      };

      const existing = resultats.find(r => r.bureauId === selectedBureau);

      if (existing) {
        await update(existing.rowIndex, data);
        await auditService.log('UPDATE_RESULTATS', {
          bureau: selectedBureau,
          tour: electionState.tourActuel
        });
      } else {
        await create(data);
        await auditService.log('CREATE_RESULTATS', {
          bureau: selectedBureau,
          tour: electionState.tourActuel
        });
      }

      setMessage({
        type: 'success',
        text: "Resultats enregistres avec succes"
      });

      await loadResultats();

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

  const bureauData = bureaux.find(b => b.id === selectedBureau);

  return (
    <div className="resultats-saisie">
      <h2>Saisie des resultats - Tour {electionState.tourActuel}</h2>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Bureau de vote :</label>
          <select
            value={selectedBureau}
            onChange={(e) => setSelectedBureau(e.target.value)}
            required
          >
            <option key="__placeholder" value="">-- Selectionner un bureau --</option>
            {bureaux.map((bureau, index) => (
              <option key={bureau.id ?? `bureau-${index}`} value={bureau.id}>
                {bureau.nom}
              </option>
            ))}
          </select>
        </div>

        {selectedBureau && (
          <>
            <div className="bureau-info">
              <p><strong>Bureau :</strong> {bureauData?.nom}</p>
              <p><strong>President :</strong> {bureauData?.president}</p>
              <p><strong>Secretaire :</strong> {bureauData?.secretaire}</p>
            </div>

            <div className="resultats-grid">
              <h3>Decompte des bulletins :</h3>

              <div className="form-row">
                <label>Votants :</label>
                <input
                  type="number"
                  min="0"
                  value={formData.votants}
                  onChange={(e) => handleFieldChange('votants', e.target.value)}
                  required
                />
                {errors.votants && <span className="error">{errors.votants}</span>}
              </div>

              <div className="form-row">
                <label>Bulletins blancs :</label>
                <input
                  type="number"
                  min="0"
                  value={formData.blancs}
                  onChange={(e) => handleFieldChange('blancs', e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <label>Bulletins nuls :</label>
                <input
                  type="number"
                  min="0"
                  value={formData.nuls}
                  onChange={(e) => handleFieldChange('nuls', e.target.value)}
                  required
                />
              </div>

              <div className="form-row highlight">
                <label>Suffrages exprimes :</label>
                <input
                  type="number"
                  value={formData.exprimes}
                  disabled
                  className="calculated"
                />
                <span className="info">Calcule automatiquement</span>
                {errors.exprimes && <span className="error">{errors.exprimes}</span>}
              </div>

              <div className="control-panel">
                <div className={`control-check ${formData.votants === formData.blancs + formData.nuls + formData.exprimes ? 'valid' : 'invalid'}`}>
                  <strong>Controle :</strong> Votants = Blancs + Nuls + Exprimes
                  <br />
                  {formData.votants} = {formData.blancs} + {formData.nuls} + {formData.exprimes}
                  {formData.votants === formData.blancs + formData.nuls + formData.exprimes ? ' OK' : ' ERREUR'}
                </div>
              </div>
            </div>

            <div className="voix-grid">
              <h3>Voix par candidat :</h3>

              {candidats.map((candidat, index) => (
                <div key={candidat.id ?? `candidat-${index}`} className="candidat-row">
                  <label>{candidat.nom} :</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.voix[candidat.id] || 0}
                    onChange={(e) => handleVoixChange(candidat.id, e.target.value)}
                    required
                  />
                </div>
              ))}

              <div className="control-panel">
                <div className={`control-check ${formData.exprimes === Object.values(formData.voix).reduce((sum, v) => sum + (parseInt(v) || 0), 0) ? 'valid' : 'invalid'}`}>
                  <strong>Controle :</strong> Somme des voix = Exprimes
                  <br />
                  {Object.values(formData.voix).reduce((sum, v) => sum + (parseInt(v) || 0), 0)} = {formData.exprimes}
                  {formData.exprimes === Object.values(formData.voix).reduce((sum, v) => sum + (parseInt(v) || 0), 0) ? ' OK' : ' ERREUR'}
                </div>
              </div>
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
                disabled={loading || Object.keys(errors).length > 0}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer les resultats'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
};

export default ResultatsSaisieBureau;

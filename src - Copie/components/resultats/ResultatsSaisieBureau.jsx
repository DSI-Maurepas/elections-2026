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
  const [simpleMode, setSimpleMode] = useState(false);
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

  
  const getNomListeBySlot = (slot) => {
    if (!Array.isArray(candidats)) return null;
    const tour = electionState?.tourActuel ?? 1;
    const c = candidats.find((cand) =>
      cand?.listeId === slot &&
      ((tour === 1 && cand?.actifT1) || (tour === 2 && cand?.actifT2))
    );
    return c?.nomListe || null;
  };

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
      const selectedBureauObj = (bureaux || []).find(b => b.id === selectedBureau);

      const data = {
        bureauId: selectedBureau,
        tour: electionState.tourActuel,
        inscrits: selectedBureauObj?.inscrits ?? 0,
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

  
  // --- Candidats (affichage + mapping L1..L5) ---
  const getCandidateSlot = (candidat, index) => {
    const raw =
      (candidat && (candidat.id ?? candidat.ID ?? candidat.Id ?? candidat.code ?? candidat.key ?? candidat.listeId ?? candidat.liste ?? candidat.numero)) ?? null;
    const s = raw != null ? String(raw).trim() : '';
    if (/^L[1-5]$/i.test(s)) return s.toUpperCase();
    return `L${index + 1}`;
  };

  const getCandidateName = (candidat, index) => {
    const name =
      (candidat && (candidat.nom ?? candidat.Nom ?? candidat.name ?? candidat.Name ?? candidat.libelle ?? candidat.Libelle)) ?? '';
    const s = name != null ? String(name).trim() : '';
    return s || `Candidat ${index + 1}`;
  };

  const buildDisplayedCandidates = () => {
    const base = Array.isArray(candidats) ? candidats.slice(0, 5) : [];
    const out = [];
    for (let i = 0; i < 5; i++) {
      out.push(base[i] ?? {});
    }
    return out;
  };

const bureauData = bureaux.find(b => b.id === selectedBureau);

  const sumVoixCandidats = Object.values(formData.voix || {}).reduce((acc, v) => acc + (Number(v) || 0), 0);
  const exprimesValue = Number(formData.exprimes) || 0;
  const controleVoixStatus = (exprimesValue === 0 && sumVoixCandidats === 0)
    ? 'neutral'
    : (sumVoixCandidats === exprimesValue ? 'valid' : 'invalid');

  const isControlBulletinsOk = (Number(formData.votants) || 0) === ((Number(formData.blancs) || 0) + (Number(formData.nuls) || 0) + (Number(formData.exprimes) || 0));
  const isControlVoixOk = (controleVoixStatus === 'valid');
  const isControlsOk = isControlBulletinsOk && isControlVoixOk;

  return (
    <div className="resultats-saisie">
      <style>{`
        /* ===== ResultatsSaisieBureau — layout dashboard (scopé) ===== */
        .resultats-saisie .rs-title{
          margin-bottom: 14px;
        }
        .resultats-saisie .rs-layout{
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-top: 12px;
        }
        .resultats-saisie .rs-row{
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: stretch;
        }
        @media (min-width: 980px){
          .resultats-saisie .rs-row.rs-row--top{
            grid-template-columns: 1.05fr 1.35fr 1.10fr; /* Bureau | Décompte | Exprimés */
            align-items: stretch;
          }
          .resultats-saisie .rs-row.rs-row--bottom{
            grid-template-columns: 1.55fr 1fr; /* Voix | Contrôles */
            align-items: stretch;
          }
        }

        .resultats-saisie .rs-card{
          border-radius: 18px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          box-shadow: 0 14px 28px rgba(2, 6, 23, 0.08);
          background: rgba(255,255,255,0.96);
          padding: 14px 14px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .resultats-saisie .rs-card h3{
          margin: 0 0 10px 0;
        }
        .resultats-saisie .rs-card .rs-fields,
        .resultats-saisie .rs-card .rs-exprimes-line,
        .resultats-saisie .rs-card .rs-voix-list,
        .resultats-saisie .rs-card .control-panel{
          flex: 1 1 auto;
        }
        .resultats-saisie .rs-card--bureau{
          background: linear-gradient(135deg, rgba(59,130,246,0.12), rgba(255,255,255,0.96));
          border: 2px solid rgba(59,130,246,0.28);
        }
        .resultats-saisie .rs-card--exprimes{
          background: linear-gradient(135deg, rgba(245,158,11,0.16), rgba(255,255,255,0.96));
          border: 2px solid rgba(245,158,11,0.35);
        }
        .resultats-saisie .rs-card--voix{
          background: linear-gradient(135deg, rgba(16,185,129,0.10), rgba(255,255,255,0.96));
          border: 2px solid rgba(16,185,129,0.22);
        }

        .resultats-saisie .rs-bureau-lines{
          display: grid;
          gap: 14px;
          font-size: 1.05rem;
          line-height: 1.5;
        }
        .resultats-saisie .rs-bureau-lines strong{
          font-weight: 900;
        }

        .resultats-saisie .rs-fields{
          display: grid;
          gap: 10px;
        }
        .resultats-saisie .rs-field{
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 10px;
          align-items: center;
        }
        .resultats-saisie .rs-field label{
          margin: 0;
          font-weight: 800;
        }
        .resultats-saisie .rs-field .info{
          margin-left: 10px;
          opacity: 0.8;
          font-weight: 700;
          white-space: nowrap;
        }
        @media (max-width: 640px){
          .resultats-saisie .rs-field{
            grid-template-columns: 1fr;
          }
          .resultats-saisie .rs-field .info{
            margin-left: 0;
            margin-top: 6px;
            white-space: normal;
          }
        }

        .resultats-saisie .rs-exprimes-line{
          display: grid;
          gap: 10px;
        }
        .resultats-saisie .rs-exprimes-badge{
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.90);
          border: 1px solid rgba(15,23,42,0.12);
          box-shadow: 0 10px 20px rgba(2,6,23,0.06);
        }
        .resultats-saisie .rs-exprimes-badge strong{
          font-size: 1.35rem;
          font-weight: 900;
        }
        .resultats-saisie .rs-exprimes-badge span{
          font-weight: 800;
          opacity: 0.8;
          text-align: right;
        }

        /* Voix : rendu visuel */
        /* ===== Mise en évidence SAISIE — Voix par candidat ===== */
        .resultats-saisie .rs-card--voix{
          border: 2px dashed rgba(16,185,129,0.55);
          box-shadow: 0 18px 36px rgba(16,185,129,0.18);
          background: linear-gradient(135deg, rgba(16,185,129,0.16), rgba(255,255,255,0.96));
        }
        .resultats-saisie .rs-card--voix h3{
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .resultats-saisie .rs-card--voix h3::after{
          content: "✍️ À SAISIR";
          font-size: 0.78rem;
          font-weight: 900;
          letter-spacing: 0.04em;
          padding: 4px 8px;
          border-radius: 999px;
          background: rgba(16,185,129,0.18);
          color: #065f46;
          border: 1px solid rgba(16,185,129,0.45);
        }
        .resultats-saisie .rs-card--voix input[type="number"]{
          border: 2px solid rgba(16,185,129,0.55);
          background: #ffffff;
          box-shadow: inset 0 0 0 1px rgba(16,185,129,0.15);
        }
        .resultats-saisie .rs-card--voix input[type="number"]:focus{
          outline: none;
          border-color: rgba(5,150,105,0.9);
          box-shadow: 0 0 0 4px rgba(16,185,129,0.25);
        }
        @media (min-width: 980px){
          .resultats-saisie .rs-card--voix{
            animation: rsPulse 3.5s ease-in-out infinite;
          }
        }
        @keyframes rsPulse{
          0%{ box-shadow: 0 18px 36px rgba(16,185,129,0.18); }
          50%{ box-shadow: 0 22px 44px rgba(16,185,129,0.28); }
          100%{ box-shadow: 0 18px 36px rgba(16,185,129,0.18); }
        }
    
        .resultats-saisie .rs-voix-list{
          display: grid;
          gap: 10px;
        }
        .resultats-saisie .rs-voix-item{
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 10px;
          align-items: center;
          padding: 10px 10px;
          border-radius: 14px;
          background: rgba(255,255,255,0.92);
          border: 1px solid rgba(15,23,42,0.10);
        }
        @media (max-width: 720px){
          .resultats-saisie .rs-voix-item{
            grid-template-columns: 1fr;
          }
        }
        .resultats-saisie .rs-voix-label{
          font-weight: 900;
        }
        .resultats-saisie .rs-voix-barwrap{
          position: relative;
          height: 34px;
          border-radius: 999px;
          background: rgba(15,23,42,0.06);
          overflow: hidden;
          border: 1px solid rgba(15,23,42,0.10);
        }
        .resultats-saisie .rs-voix-bar{
          position: absolute;
          inset: 0 auto 0 0;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(59,130,246,0.95), rgba(16,185,129,0.95));
          width: 0%;
          min-width: 0%;
          transition: width 520ms ease;
        }

        /* ===== Animations barres voix ===== */
        .resultats-saisie .rs-voix-bar::after{
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, rgba(255,255,255,0.00), rgba(255,255,255,0.20), rgba(255,255,255,0.00));
          transform: translateX(-60%);
          animation: rsShimmer 2.2s ease-in-out infinite;
          opacity: 0.55;
          pointer-events: none;
        }
        @keyframes rsShimmer{
          0%{ transform: translateX(-60%); }
          50%{ transform: translateX(60%); }
          100%{ transform: translateX(140%); }
        }

        /* ===== Verrouillage visuel contrôles KO ===== */
        .resultats-saisie .rs-controls.is-ko{
          border: 2px solid rgba(239, 68, 68, 0.55);
          box-shadow: 0 18px 36px rgba(239, 68, 68, 0.14);
          background: linear-gradient(135deg, rgba(239,68,68,0.08), rgba(255,255,255,0.96));
        }
        .resultats-saisie .rs-lock-banner{
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(239, 68, 68, 0.35);
          background: rgba(239, 68, 68, 0.08);
          font-weight: 900;
          line-height: 1.25;
        }
        .resultats-saisie .form-actions.is-ko .btn-primary{
          filter: grayscale(0.2);
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.28), 0 16px 28px rgba(2,6,23,0.10);
        }

        /* ===== Mode Président (ultra simplifié) ===== */
        .resultats-saisie .rs-toolbar{
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid rgba(15, 23, 42, 0.12);
          background: rgba(255,255,255,0.92);
          box-shadow: 0 10px 18px rgba(2,6,23,0.06);
          margin: 12px 0 8px;
          flex-wrap: wrap;
        }
        .resultats-saisie .rs-toggle{
          display: inline-flex;
          align-items: center;
          gap: 10px;
          font-weight: 900;
        }
        .resultats-saisie .rs-toggle button{
          border: 1px solid rgba(15, 23, 42, 0.18);
          background: rgba(255,255,255,0.95);
          border-radius: 999px;
          padding: 7px 10px;
          font-weight: 900;
          cursor: pointer;
          box-shadow: 0 10px 18px rgba(2,6,23,0.06);
        }
        .resultats-saisie .rs-toggle button.is-on{
          border-color: rgba(59, 130, 246, 0.55);
          background: rgba(59, 130, 246, 0.10);
        }
        .resultats-saisie .rs-simple-note{
          font-weight: 800;
          opacity: 0.8;
        }

        .resultats-saisie .rs-voix-bartext{
          position: relative;
          z-index: 2;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 10px;
          font-weight: 900;
          color: #0f172a;
          text-shadow: 0 1px 0 rgba(255,255,255,0.5);
        }

        /* Contrôles : compact et aligné */
        .resultats-saisie .rs-controls .resultats-controls{
          display: grid;
          gap: 10px;
        }
        .resultats-saisie .control-check{
          border-radius: 14px;
          padding: 10px 12px;
          line-height: 1.25;
        }
      `}</style>

      <h2 className="rs-title">Saisie des resultats - Tour {electionState.tourActuel}</h2>

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
                {bureau.id} — {bureau.nom}
              </option>
            ))}
          </select>
        </div>

        {selectedBureau && (
          <>
            <div className="rs-toolbar">
            <div className="rs-toggle">
              <span>👨‍💼 Mode “Président du bureau”</span>
              <button
                type="button"
                className={simpleMode ? 'is-on' : ''}
                onClick={() => setSimpleMode((v) => !v)}
                aria-pressed={simpleMode}
                title="Affichage simplifié pour saisie rapide"
              >
                {simpleMode ? 'Activé' : 'Désactivé'}
              </button>
            </div>
            <div className="rs-simple-note">
              {simpleMode ? 'Saisie rapide : focus sur Décompte, Voix, Contrôles.' : 'Affichage complet.'}
            </div>
          </div>

          <div className="rs-layout">
            {/* LIGNE 1 : Bureau | Décompte | Exprimés */}
            <div className="rs-row rs-row--top">
              {/* Bloc bleu compact */}
              {!simpleMode && (
              <div className="rs-card rs-card--bureau">
                <h3>🏢 Bureau</h3>
                <div className="rs-bureau-lines">
                  <div><strong>Bureau :</strong> {bureauData?.nom}</div>
                  <div><strong>President :</strong> {bureauData?.president}</div>
                  <div><strong>Secretaire :</strong> {bureauData?.secretaire}</div>
                </div>
              </div>
              )}

              {/* Décompte des bulletins */}
              <div className="rs-card">
                <h3>📦 Decompte des bulletins</h3>
                <div className="rs-fields">
                  <div className="rs-field">
                    <label>Votants :</label>
                    <div>
                      <input
                        type="number"
                        min="0"
                        value={formData.votants}
                        onChange={(e) => handleFieldChange('votants', e.target.value)}
                        required
                      />
                      {errors.votants && <span className="error">{errors.votants}</span>}
                    </div>
                  </div>

                  <div className="rs-field">
                    <label>Bulletins blancs :</label>
                    <div>
                      <input
                        type="number"
                        min="0"
                        value={formData.blancs}
                        onChange={(e) => handleFieldChange('blancs', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="rs-field">
                    <label>Bulletins nuls :</label>
                    <div>
                      <input
                        type="number"
                        min="0"
                        value={formData.nuls}
                        onChange={(e) => handleFieldChange('nuls', e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Suffrages exprimés (calcul auto) */}
              {!simpleMode && (
              <div className="rs-card rs-card--exprimes">
                <h3>🧮 Suffrages exprimés</h3>
                <div className="rs-exprimes-line">
                  <div className="rs-exprimes-badge">
                    <div>
                      <div style={{ fontWeight: 900, opacity: 0.85 }}>Total</div>
                      <strong>{formData.exprimes}</strong>
                    </div>
                    <span>⚙️ Calcul automatique</span>
                  </div>

                  <div className="rs-field" style={{ gridTemplateColumns: '1fr' }}>
                    <input
                      type="number"
                      value={formData.exprimes}
                      disabled
                      className="calculated"
                    />
                    {errors.exprimes && <span className="error">{errors.exprimes}</span>}
                  </div>
                </div>
              </div>
              )}
            </div>

            {/* LIGNE 2 : Voix (visuel) | Contrôles */}
            <div className="rs-row rs-row--bottom">
              {/* Voix par candidat (visuel + saisie) */}
              <div className="rs-card rs-card--voix">
                <h3>📊 Voix par candidat</h3>

                {(() => {
                  const displayed = buildDisplayedCandidates();
                  const maxVoix = Math.max(0, ...Object.values(formData.voix || {}).map(v => Number(v) || 0));
                  return (
                    <div className="rs-voix-list">
                      {displayed.map((candidat, index) => {
                        const slot = getCandidateSlot(candidat, index);
                        const label = getCandidateName(candidat, index);
                        const v = Number(formData.voix?.[slot] ?? 0) || 0;
                        const pct = maxVoix > 0 ? (v / maxVoix) * 100 : 0;

                        return (
                          <div key={slot} className="rs-voix-item">
                            <div>
                              <div className="rs-voix-label">{slot} — {getNomListeBySlot(slot) || label}</div>
                              <div style={{ marginTop: 8 }}>
                                <input
                                  type="number"
                                  min="0"
                                  value={formData.voix?.[slot] ?? 0}
                                  onChange={(e) => handleVoixChange(slot, e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="rs-voix-barwrap" aria-label={`Progression ${slot}`}>
                              <div className="rs-voix-bar" style={{ width: `${pct}%` }} />
                              <div className="rs-voix-bartext">{v.toLocaleString('fr-FR')} voix</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Contrôles à droite */}
              <div className={`rs-card rs-controls ${!isControlsOk ? 'is-ko' : ''}`}>
                <h3>✅ Contrôles</h3>
                <div className="control-panel">
                  <div className="resultats-controls">
                    <div className={`control-check ${formData.votants === formData.blancs + formData.nuls + formData.exprimes ? 'valid' : 'invalid'}`}>
                      <strong>Contrôle :</strong> Votants = Blancs + Nuls + Exprimés
                      <br />
                      {formData.votants} = {formData.blancs} + {formData.nuls} + {formData.exprimes}
                      {formData.votants === formData.blancs + formData.nuls + formData.exprimes ? ' OK' : ' ERREUR'}
                    </div>

                    <div className={`control-check ${controleVoixStatus}`}>
                      <strong>Contrôle :</strong> Σ voix candidats = Exprimés
                      <br />
                      {sumVoixCandidats} = {formData.exprimes}
                      {controleVoixStatus === 'neutral'
                        ? ' (en attente)'
                        : (sumVoixCandidats === exprimesValue ? ' OK' : ' ERREUR')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {message && (
              <div className={`message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className={`form-actions ${!isControlsOk ? 'is-ko' : ''}`}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading || Object.keys(errors).length > 0}
              >
                {loading ? 'Enregistrement...' : 'Enregistrer les resultats'}
              </button>
            </div>
          </div>
          </>
        )}
      </form>
    </div>
  );
};


export default ResultatsSaisieBureau;

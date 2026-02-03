import React, { useEffect, useMemo, useState } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import auditService from '../../services/auditService';
import authService from '../../services/authService';

// IMPORTANT:
// On N'INSTANCIE PAS useElectionState ici.
// La source unique de vérité est dans App.jsx (évite désynchronisations + besoin de rafraîchir).
const PassageSecondTour = ({
  electionState,
  passerSecondTour,
  reloadElectionState,
}) => {
  const { data: candidats, load: loadCandidats } = useGoogleSheets('Candidats');
  const { data: resultats, load: loadResultats } = useGoogleSheets('Resultats_T1');

  const [classement, setClassement] = useState([]);
  const [candidatsQualifies, setCandidatsQualifies] = useState([]);
  const [egalite, setEgalite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [adminPwd, setAdminPwd] = useState('');
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [showConfirmT2Modal, setShowConfirmT2Modal] = useState(false);
  const [pendingQualified, setPendingQualified] = useState([]);

  // Flag piloté par l'Administration (ElectionsState: secondTourEnabled)
  // Tolérant aux types (booléen, number, string)
  const secondTourEnabled = useMemo(() => {
    if (!electionState) return false;

    const raw =
      electionState.secondTourEnabled ??
      electionState.passageSecondTourEnabled ??
      electionState.t2Enabled ??
      electionState['secondTourEnabled'];

    if (raw === true) return true;
    if (raw === false) return false;

    if (typeof raw === 'number') return raw === 1;

    if (typeof raw === 'string') {
      const s = raw.trim().toLowerCase();
      if (!s) return false;
      return (
        s === 'true' ||
        s === '1' ||
        s === 'oui' ||
        s === 'vrai' ||
        s === 'actif' ||
        s === 'enabled' ||
        s === 'on' ||
        s === 'yes'
      );
    }

    return false;
  }, [electionState]);

  // Détecte si l'application est déjà en 2nd tour (tourActuel/tour/currentTour)
  const t2Confirmed = useMemo(() => {
    const raw =
      electionState?.tourActuel ??
      electionState?.tour ??
      electionState?.currentTour ??
      electionState?.['tourActuel'] ??
      electionState?.['tour'];

    const n = Number(raw);
    return n === 2;
  }, [electionState]);

  useEffect(() => {
    loadCandidats?.();
    loadResultats?.();
  }, [loadCandidats, loadResultats]);

  useEffect(() => {
    if (!Array.isArray(resultats) || !Array.isArray(candidats)) return;
    if (resultats.length === 0 || candidats.length === 0) return;

    const totalExprimes = resultats.reduce((sum, r) => sum + (r?.exprimes || 0), 0);

    // Candidats T1 (par défaut : ceux marqués ActifT1). Si la colonne n'existe pas, on garde tout.
    const candidatsT1 = (candidats || []).filter((c) => {
      const raw = c?.actifT1 ?? c?.ActifT1;
      if (raw === undefined || raw === null) return true;
      return raw === true || raw === 'TRUE' || raw === 'true' || raw === 1 || raw === '1';
    });

    const candidatsAvecVoix = candidatsT1.map((candidat) => {
      const candidatKey =
        candidat?.listeId ??
        candidat?.listeID ??
        candidat?.ListeID ??
        candidat?.id ??
        candidat?.ID ??
        candidat?.key;

      const voix = resultats.reduce((sum, r) => {
        const v = r?.voix || {};
        const k = candidatKey != null ? String(candidatKey) : '';
        return sum + (parseInt(v?.[k]) || 0);
      }, 0);

      const displayName =
        candidat?.nomListe ??
        candidat?.NomListe ??
        candidat?.nom ??
        candidat?.Nom ??
        candidat?.listeId ??
        candidat?.ListeID ??
        candidat?.id ??
        '—';

      return {
        ...candidat,
        id: candidatKey ?? candidat?.id,
        nom: displayName,
        voix,
        pourcentage: totalExprimes > 0 ? (voix / totalExprimes) * 100 : 0,
      };
    });

    candidatsAvecVoix.sort((a, b) => (b.voix || 0) - (a.voix || 0));
    setClassement(candidatsAvecVoix);

    if (candidatsAvecVoix.length >= 2) {
      const premier = candidatsAvecVoix[0];
      const second = candidatsAvecVoix[1];

      if ((premier?.voix || 0) === (second?.voix || 0)) {
        setEgalite(true);
        setCandidatsQualifies([]);
      } else {
        setEgalite(false);
        setCandidatsQualifies([premier, second]);
        // Ne pas forcer un message WARNING ici (évite les doublons d'affichage).
        setMessage((prev) => (prev?.type === 'warning' ? null : prev));
      }
    }
  }, [resultats, candidats]);

  const handlePassageT2 = async () => {
    if (!secondTourEnabled) {
      setMessage({
        type: 'warning',
        text: "⛔ Le passage au 2nd tour est désactivé. Active-le via l'Administration.",
      });
      return;
    }

    if (candidatsQualifies.length !== 2) {
      setMessage({
        type: 'error',
        text: 'Vous devez sélectionner exactement 2 candidats',
      });
      return;
    }

    // Remplace le confirm() navigateur par un modal charté.
    setPendingQualified(candidatsQualifies);
    setShowConfirmT2Modal(true);
  };

  const confirmPassageT2 = async () => {
    const candidats = Array.isArray(pendingQualified) ? pendingQualified : [];
    if (candidats.length !== 2) {
      setMessage({ type: 'error', text: 'Impossible de confirmer : 2 candidats requis.' });
      setShowConfirmT2Modal(false);
      return;
    }
    try {
      setLoading(true);
      await passerSecondTour(candidats);
      // S'assure que l'état global (App + Navigation) est à jour immédiatement
      await reloadElectionState?.();

      try {
        await auditService.log('PASSAGE_SECOND_TOUR', {
          candidats: candidats.map((c) => ({ id: c.id, nom: c.nom, voix: c.voix })),
        });
      } catch (e) {
        console.warn('Audit log failed (PASSAGE_SECOND_TOUR):', e);
      }

      setMessage({
        type: 'success',
        text: '✅ Passage au 2nd tour effectué avec succès',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Erreur: ${error?.message || 'Erreur inconnue'}`,
      });
    } finally {
      setLoading(false);
      setShowConfirmT2Modal(false);
      setPendingQualified([]);
    }
  };

  const cancelPassageT2 = () => {
    setShowConfirmT2Modal(false);
    setPendingQualified([]);
  };

  const handleValidateAdmin = () => {
    const ok = authService?.adminSignIn ? authService.adminSignIn(adminPwd) : false;
    if (ok) {
      setAdminUnlocked(true);
      setAdminError('');
    } else {
      setAdminUnlocked(false);
      setAdminError('Mot de passe administrateur incorrect.');
    }
  };

  // ====== Styles inline (pour ne pas dépendre d'une feuille CSS externe et éviter les régressions) ======
  const styles = {
    card: {
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
      padding: 16,
      border: '1px solid rgba(0,0,0,0.06)',
    },
    cardTitle: {
      margin: 0,
      marginBottom: 12,
      fontSize: 18,
      fontWeight: 800,
    },
    tableWrap: {
      overflowX: 'auto',
      borderRadius: 14,
      border: '1px solid rgba(0,0,0,0.06)',
    },
    table: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: 0,
      overflow: 'hidden',
    },
    th: {
      textAlign: 'left',
      fontSize: 12,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      opacity: 0.9,
      padding: '12px 12px',
      borderBottom: '1px solid rgba(0,0,0,0.08)',
      background: 'rgba(0,0,0,0.03)',
      position: 'sticky',
      top: 0,
      zIndex: 1,
    },
    td: {
      padding: '12px 12px',
      borderBottom: '1px solid rgba(0,0,0,0.06)',
      verticalAlign: 'middle',
    },
    trQualified: {
      background: 'rgba(34, 197, 94, 0.08)', // vert clair
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      background: 'rgba(34, 197, 94, 0.12)',
      border: '1px solid rgba(34, 197, 94, 0.35)',
    },
    hintBox: {
      background: 'rgba(0,0,0,0.03)',
      borderRadius: 14,
      boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
      padding: 14,
      border: '1px solid rgba(0,0,0,0.06)',
      marginBottom: 12,
    },
    qualifiesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 12,
      marginTop: 12,
    },
    miniCard: (accent = 'rgba(34,197,94,0.75)') => ({
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 8px 20px rgba(0,0,0,0.08)',
      padding: 14,
      border: `1px solid rgba(0,0,0,0.06)`,
      outline: `2px solid ${accent}`,
      outlineOffset: -2,
    }),
    miniTop: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 10,
      gap: 10,
    },
    miniRank: {
      fontWeight: 900,
      fontSize: 12,
      textTransform: 'uppercase',
      opacity: 0.8,
      letterSpacing: 0.6,
    },
    miniName: {
      fontWeight: 900,
      fontSize: 16,
      lineHeight: 1.1,
    },
    miniNumber: {
      fontWeight: 900,
      fontSize: 18,
    },
    barWrap: {
      height: 10,
      background: 'rgba(0,0,0,0.06)',
      borderRadius: 999,
      overflow: 'hidden',
    },
    bar: (pct) => ({
      height: '100%',
      width: `${Math.max(0, Math.min(100, pct))}%`,
      background: 'rgba(34,197,94,0.8)',
      borderRadius: 999,
      transition: 'width 450ms ease',
    }),

    // Modal charté (remplace window.confirm)
    modalOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
      zIndex: 9999,
    },
    modalCard: {
      width: 'min(720px, 100%)',
      background: '#fff',
      borderRadius: 16,
      boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
      border: '1px solid rgba(0,0,0,0.10)',
      overflow: 'hidden',
    },
    modalHeader: {
      padding: '14px 16px',
      background: 'rgba(37, 99, 235, 0.12)', // bleu T2
      borderBottom: '1px solid rgba(37, 99, 235, 0.25)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    modalTitle: {
      margin: 0,
      fontSize: 16,
      fontWeight: 900,
      color: '#0f2f6b',
    },
    modalBody: {
      padding: 16,
      fontSize: 14,
      color: 'rgba(0,0,0,0.78)',
      lineHeight: 1.4,
    },
    modalList: {
      marginTop: 10,
      marginBottom: 0,
      paddingLeft: 18,
    },
    modalFooter: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      padding: 16,
      borderTop: '1px solid rgba(0,0,0,0.08)',
      background: 'rgba(0,0,0,0.02)',
    },
    modalBtn: {
      height: 44,
      minWidth: 120,
      padding: '0 16px',
      borderRadius: 12,
      border: '1px solid rgba(0,0,0,0.10)',
      fontWeight: 800,
      fontSize: 14,
      cursor: 'pointer',
    },
    modalBtnCancel: {
      background: '#fff',
      color: 'rgba(0,0,0,0.85)',
    },
    modalBtnConfirm: {
      background: 'rgba(37, 99, 235, 0.95)',
      border: '1px solid rgba(37, 99, 235, 0.95)',
      color: '#fff',
      boxShadow: '0 10px 24px rgba(37, 99, 235, 0.25)',
    },
  };

  const maxVoix = useMemo(() => {
    if (!Array.isArray(classement) || classement.length === 0) return 0;
    return classement.reduce((m, c) => Math.max(m, c?.voix || 0), 0);
  }, [classement]);

  return (
    <>
      <div className="passage-t2">
      <h2>➡️ Passage au 2nd tour</h2>

      <style>{`
        .tour-info-card{
          margin: 14px 0 0 0;
          padding: 14px;
          border-radius: 14px;
          border: 1px solid rgba(0,0,0,0.06);
          background: rgba(255,255,255,0.92);
          box-shadow: 0 10px 26px rgba(0,0,0,0.06);
        }
        .tour-info-row{
          display:flex;
          gap: 14px;
          flex-wrap: wrap;
          align-items: stretch;
        }
        .tour-info-item{
          flex: 1 1 220px;
          padding: 10px 12px;
          border-radius: 12px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(0,0,0,0.06);
        }
        .tour-info-item .label{
          font-size: 12px;
          font-weight: 800;
          opacity: 0.8;
          text-transform: uppercase;
          letter-spacing: .4px;
        }
        .tour-info-item .value{
          margin-top: 6px;
          font-size: 18px;
          font-weight: 900;
        }
      `}</style>


      {!secondTourEnabled && (
        <div className="message warning" style={{ marginBottom: 12 }}>
          ⛔ Le passage au 2nd tour est actuellement <strong>désactivé</strong>. Active-le via{' '}
          <strong>Administration</strong> (Passage au 2nd tour = Actif / Inactif).
        </div>
      )}

      {/* Bloc clair arrondi + ombre portée */}
      <div style={{ ...styles.hintBox, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>📊 Classement 1er tour</div>
            <div style={{ opacity: 0.85, fontSize: 13, marginTop: 4 }}>
              Les <strong>2 premiers</strong> sont qualifiés (sauf égalité).
            </div>
          </div>
          {candidatsQualifies.length === 2 && !egalite && (
            <span style={styles.badge}>✅ 2 qualifiés détectés</span>
          )}
        </div>
      </div>

      {/* Tableau arrondi + 2 qualifiés en vert */}
      <div style={{ ...styles.card, padding: 14, marginBottom: 16 }}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Rang</th>
                <th style={styles.th}>Candidat</th>
                <th style={styles.th}>Voix</th>
                <th style={styles.th}>%</th>
                <th style={styles.th}>Qualifié</th>
              </tr>
            </thead>
            <tbody>
              {classement.map((c, index) => {
                const isQualified = index < 2;
                const pctBar = maxVoix > 0 ? ((c?.voix || 0) / maxVoix) * 100 : 0;

                return (
                  <tr key={`${c.id || c.nom || c.candidat || index}`} style={isQualified ? styles.trQualified : undefined}>
                    <td style={styles.td}>{index + 1}</td>
                    <td style={styles.td}>
                      <strong>{c.nom}</strong>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <div style={{ fontWeight: 800 }}>{(c.voix || 0).toLocaleString('fr-FR')}</div>
                        {/* mini graphique (barre animée) */}
                        <div style={styles.barWrap} title="Visualisation relative (voix)">
                          <div style={styles.bar(pctBar)} />
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>{(c.pourcentage || 0).toFixed(2)}%</td>
                    <td style={styles.td}>{isQualified ? '✅' : '❌'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {egalite && (
          <div className="message warning" style={{ marginTop: 12 }}>
            ⚠️ Égalité parfaite entre les 2 premiers candidats. Décision admin requise.
          </div>
        )}
      </div>

      {message && <div className={`message ${message.type}`}>{message.text}</div>}

      {/* Bloc "Candidats qualifiés" */}
      {!egalite && candidatsQualifies.length === 2 && (
        <div style={{ ...styles.card, marginBottom: 16 }}>
          <h3 style={styles.cardTitle}>🏁 Candidats qualifiés pour le 2nd tour</h3>
          <div style={{ opacity: 0.85, fontSize: 13 }}>
            Vérifie les noms et les voix avant confirmation.
          </div>

          <div style={styles.qualifiesGrid}>
            <div style={styles.miniCard('rgba(34,197,94,0.65)')}>
              <div style={styles.miniTop}>
                <div style={styles.miniRank}>1er</div>
                <div style={{ ...styles.miniNumber }}>{(candidatsQualifies[0].voix || 0).toLocaleString('fr-FR')} voix</div>
              </div>
              <div style={styles.miniName}>{candidatsQualifies[0].nom}</div>
              <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                {(candidatsQualifies[0].pourcentage || 0).toFixed(2)}%
              </div>
              <div style={{ marginTop: 10, ...styles.barWrap }}>
                <div style={styles.bar(maxVoix > 0 ? ((candidatsQualifies[0].voix || 0) / maxVoix) * 100 : 0)} />
              </div>
            </div>

            <div style={styles.miniCard('rgba(34,197,94,0.55)')}>
              <div style={styles.miniTop}>
                <div style={styles.miniRank}>2ème</div>
                <div style={{ ...styles.miniNumber }}>{(candidatsQualifies[1].voix || 0).toLocaleString('fr-FR')} voix</div>
              </div>
              <div style={styles.miniName}>{candidatsQualifies[1].nom}</div>
              <div style={{ marginTop: 8, opacity: 0.85, fontSize: 13 }}>
                {(candidatsQualifies[1].pourcentage || 0).toFixed(2)}%
              </div>
              <div style={{ marginTop: 10, ...styles.barWrap }}>
                <div style={styles.bar(maxVoix > 0 ? ((candidatsQualifies[1].voix || 0) / maxVoix) * 100 : 0)} />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 📅 Infos officielles du 2nd tour (évite doublon avec ConfigurationT2) */}
      <div className="tour-info-card">
        <div className="tour-info-row">
          <div className="tour-info-item">
            <div className="label">Date du 2nd tour</div>
            <div className="value">
              {electionState?.dateT2 ? new Date(electionState.dateT2).toLocaleDateString('fr-FR') : '—'}
            </div>
          </div>
          <div className="tour-info-item">
            <div className="label">Horaires</div>
            <div className="value">08h00 – 20h00</div>
          </div>
        </div>
      </div>

      <div className="actions" style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
        <input
          type="password"
          value={adminPwd}
          onChange={(e) => {
            setAdminPwd(e.target.value);
            if (adminError) setAdminError('');
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleValidateAdmin();
          }}
          placeholder="Saisissez le mot de passe administrateur"
          aria-label="Mot de passe administrateur"
          style={{
            flex: 1,
            minWidth: 260,
            height: 44,
            padding: '0 14px',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.12)',
            outline: 'none',
          }}
        />

        <button
          type="button"
          className="btn-primary"
          onClick={handleValidateAdmin}
          style={{ height: 44, padding: '0 18px', background: 'rgba(15,23,42,0.92)' }}
        >
          Valider
        </button>

        <button
          className="btn-primary"
          disabled={!adminUnlocked || !secondTourEnabled || egalite || t2Confirmed}
          onClick={handlePassageT2}
          style={{
            height: 44,
            padding: '0 18px',
            background: adminUnlocked ? 'rgba(37,99,235,0.92)' : 'rgba(156,163,175,0.7)',
          }}
          title={
            !adminUnlocked
              ? 'Saisissez et validez le mot de passe administrateur'
              : !secondTourEnabled
              ? 'Passage au 2nd tour désactivé'
              : egalite
              ? 'Égalité parfaite : décision admin requise'
              : ''
          }
        >
          {adminUnlocked ? 'Passage au 2nd tour actif' : '➡️ Confirmer passage au 2nd tour'}
        </button>
      </div>
      {adminError && (
        <div className="message warning" style={{ marginTop: 10 }}>
          {adminError}
        </div>
      )}
      </div>

      {showConfirmT2Modal && (
        <div style={styles.modalOverlay} role="dialog" aria-modal="true">
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Confirmer le passage au 2nd tour</h3>
            </div>
            <div style={styles.modalBody}>
              <div>Vous allez confirmer officiellement le passage au 2nd tour avec :</div>
              <ol style={styles.modalList}>
                {pendingQualified.map((c, idx) => (
                  <li key={c?.id || c?.nom || idx}>{c?.nom || '-'}</li>
                ))}
              </ol>
            </div>
            <div style={styles.modalFooter}>
              <button
                type="button"
                onClick={() => setShowConfirmT2Modal(false)}
                style={{ ...styles.modalBtn, ...styles.modalBtnCancel }}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={confirmPassageT2}
                disabled={loading}
                style={{
                  ...styles.modalBtn,
                  ...styles.modalBtnConfirm,
                  ...(loading ? { opacity: 0.65, cursor: 'not-allowed' } : null),
                }}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PassageSecondTour;
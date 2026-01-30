import React, { useEffect, useMemo, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import auditService from '../../services/auditService';

const PassageSecondTour = () => {
  const { state: electionState, passerSecondTour } = useElectionState();
  const { data: candidats, load: loadCandidats } = useGoogleSheets('Candidats');
  const { data: resultats, load: loadResultats } = useGoogleSheets('Resultats_T1');

  const [classement, setClassement] = useState([]);
  const [candidatsQualifies, setCandidatsQualifies] = useState([]);
  const [egalite, setEgalite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

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

  useEffect(() => {
    loadCandidats?.();
    loadResultats?.();
  }, [loadCandidats, loadResultats]);

  useEffect(() => {
    if (!Array.isArray(resultats) || !Array.isArray(candidats)) return;
    if (resultats.length === 0 || candidats.length === 0) return;

    const totalExprimes = resultats.reduce((sum, r) => sum + (r?.exprimes || 0), 0);

    const candidatsAvecVoix = candidats.map((candidat) => {
      const voix = resultats.reduce((sum, r) => sum + (r?.voix?.[candidat.id] || 0), 0);
      return {
        ...candidat,
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
        setMessage({
          type: 'warning',
          text: '⚠️ Égalité parfaite entre les 2 premiers candidats. Décision admin requise.',
        });
      } else {
        setEgalite(false);
        setCandidatsQualifies([premier, second]);
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

    if (
      window.confirm(
        `Confirmer le passage au 2nd tour avec:\n1. ${candidatsQualifies[0].nom}\n2. ${candidatsQualifies[1].nom}`
      )
    ) {
      try {
        setLoading(true);
        await passerSecondTour(candidatsQualifies);

        try {
          await auditService.log('PASSAGE_SECOND_TOUR', {
            candidats: candidatsQualifies.map((c) => ({ id: c.id, nom: c.nom, voix: c.voix })),
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
      }
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
  };

  const maxVoix = useMemo(() => {
    if (!Array.isArray(classement) || classement.length === 0) return 0;
    return classement.reduce((m, c) => Math.max(m, c?.voix || 0), 0);
  }, [classement]);

  return (
    <div className="passage-t2">
      <h2>➡️ Passage au 2nd tour</h2>

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
                  <tr key={c.id} style={isQualified ? styles.trQualified : undefined}>
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

      <div className="actions">
        <button
          onClick={handlePassageT2}
          disabled={!secondTourEnabled || loading || egalite || candidatsQualifies.length !== 2}
          className="btn-primary"
          title={!secondTourEnabled ? "Désactivé : activer via Administration" : undefined}
        >
          {loading
            ? 'Traitement...'
            : !secondTourEnabled
              ? '⛔ Passage au 2nd tour désactivé'
              : '➡️ Confirmer passage au 2nd tour'}
        </button>
      </div>
    </div>
  );
};

export default PassageSecondTour;

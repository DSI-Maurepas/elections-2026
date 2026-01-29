import React, { useEffect, useMemo, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Consolidation des résultats
 * - Totaux communaux
 * - Statistiques agrégées
 * - Tableau par candidat
 *
 * IMPORTANT :
 * - Ne touche pas à Participation
 * - Ne modifie pas les données dans Sheets (affichage/consolidation locale uniquement)
 */
const ResultatsConsolidation = () => {
  const { state: electionState } = useElectionState();

  const { data: bureaux, load: loadBureaux } = useGoogleSheets('Bureaux');
  const { data: candidats, load: loadCandidats } = useGoogleSheets('Candidats');
  const { data: resultats, load: loadResultats } = useGoogleSheets(
    electionState.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2'
  );

  const [totaux, setTotaux] = useState({
    inscrits: 0,
    votants: 0,
    blancs: 0,
    nuls: 0,
    exprimes: 0
  });

  const [classementCandidats, setClassementCandidats] = useState([]);

  // ---------- Helpers ----------
  const clampPct = (v) => Math.min(100, Math.max(0, Number(v) || 0));

  const isValidHexColor = (hex) =>
    typeof hex === 'string' && /^#([0-9a-fA-F]{6})$/.test(hex.trim());

  const yiqTextColor = (hex) => {
    if (!isValidHexColor(hex)) return '#111827';
    const h = hex.trim().replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    // YIQ perceived brightness
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 140 ? '#111827' : '#FFFFFF';
  };

  const getCandidateDisplayName = (c) => {
    if (!c) return '';
    const nomListe = (c.nomListe || '').toString().trim();
    const prenom = (c.teteListePrenom || '').toString().trim();
    const nom = (c.teteListeNom || '').toString().trim();
    if (nomListe) return nomListe;
    const full = `${prenom} ${nom}`.trim();
    return full || (c.listeId || c.id || '—');
  };

  // Palette stable (fallback si Couleur absente ou invalide)
  const PALETTE = useMemo(
    () => ['#2D7FF9', '#22C55E', '#F97316', '#A855F7', '#EF4444', '#14B8A6', '#EAB308', '#64748B'],
    []
  );

  const hashToIndex = (str) => {
    const s = String(str ?? '');
    let h = 0;
    for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  };

  const getCandidateColor = (candidat, fallbackIndex = 0) => {
    const explicit = candidat?.couleur;
    if (isValidHexColor(explicit)) return explicit.trim();
    const key = candidat?.listeId || candidat?.id || candidat?.nomListe || '';
    const idx = (hashToIndex(key) + fallbackIndex) % PALETTE.length;
    return PALETTE[idx];
  };

  // ---------- Chargements ----------
  useEffect(() => {
    loadBureaux();
    loadCandidats();
    loadResultats();
  }, [loadBureaux, loadCandidats, loadResultats]);

  // ---------- Consolidation locale ----------
  useEffect(() => {
    if (bureaux.length === 0 && resultats.length === 0) {
      setTotaux({ inscrits: 0, votants: 0, blancs: 0, nuls: 0, exprimes: 0 });
      setClassementCandidats([]);
      return;
    }

    // Totaux communaux
    const totalInscrits = bureaux.reduce((sum, b) => sum + (Number(b.inscrits) || 0), 0);

    const totalVotants = resultats.reduce((sum, r) => sum + (Number(r.votants) || 0), 0);
    const totalBlancs = resultats.reduce((sum, r) => sum + (Number(r.blancs) || 0), 0);
    const totalNuls = resultats.reduce((sum, r) => sum + (Number(r.nuls) || 0), 0);

    // ⚠️ Robustesse : si la colonne "exprimes" est vide/0 mais votants/blancs/nuls existent,
    // on affiche un exprimés calculé (affichage uniquement, sans écrire dans Sheets).
    const totalExprimesRaw = resultats.reduce((sum, r) => sum + (Number(r.exprimes) || 0), 0);
    const totalExprimesSafe =
      totalExprimesRaw > 0 ? totalExprimesRaw : Math.max(0, totalVotants - totalBlancs - totalNuls);

    setTotaux({
      inscrits: totalInscrits,
      votants: totalVotants,
      blancs: totalBlancs,
      nuls: totalNuls,
      exprimes: totalExprimesSafe
    });

    // Candidats actifs selon le tour
    const candidatsActifs = (candidats || []).filter((c) =>
      electionState.tourActuel === 1 ? !!c.actifT1 : !!c.actifT2
    );

    // Classement candidats (jointure sur listeId <-> voix[Lx])
    if (candidatsActifs.length > 0) {
      const candidatsAvecTotaux = candidatsActifs.map((candidat) => {
        const listeId = candidat?.listeId;
        const totalVoix = resultats.reduce((sum, r) => {
          const voix = r?.voix?.[listeId];
          return sum + (Number(voix) || 0);
        }, 0);

        return {
          ...candidat,
          totalVoix,
          pourcentage: totalExprimesSafe > 0 ? (totalVoix / totalExprimesSafe) * 100 : 0,
          displayName: getCandidateDisplayName(candidat)
        };
      });

      candidatsAvecTotaux.sort((a, b) => (Number(b.totalVoix) || 0) - (Number(a.totalVoix) || 0));
      setClassementCandidats(candidatsAvecTotaux);
    } else {
      setClassementCandidats([]);
    }
  }, [resultats, candidats, bureaux, electionState.tourActuel]);

  const nbBureaux = bureaux.length;

  const nbBureauxDeclares = useMemo(() => {
    if (nbBureaux === 0) return 0;
    const declaredSet = new Set(resultats.map((r) => r.bureauId));
    return bureaux.filter((b) => declaredSet.has(b.id)).length;
  }, [bureaux, resultats, nbBureaux]);

  const tauxParticipation = useMemo(() => {
    if (!totaux.inscrits) return 0;
    return (totaux.votants / totaux.inscrits) * 100;
  }, [totaux]);

  const totalAbstentions = useMemo(() => {
    const a = (Number(totaux.inscrits) || 0) - (Number(totaux.votants) || 0);
    return a < 0 ? 0 : a;
  }, [totaux]);

  const tauxBlancs = useMemo(() => {
    if (!totaux.votants) return 0;
    return (totaux.blancs / totaux.votants) * 100;
  }, [totaux]);

  const tauxNuls = useMemo(() => {
    if (!totaux.votants) return 0;
    return (totaux.nuls / totaux.votants) * 100;
  }, [totaux]);

  const top1 = classementCandidats[0];
  const top2 = classementCandidats[1];

  const ecartVoix = useMemo(() => {
    if (!top1 || !top2) return null;
    return (Number(top1.totalVoix) || 0) - (Number(top2.totalVoix) || 0);
  }, [top1, top2]);

  const ecartLabel = useMemo(() => {
    if (!top1 || !top2) return 'N/A';
    return `${getCandidateDisplayName(top1)} vs ${getCandidateDisplayName(top2)}`;
  }, [top1, top2]);

  const maxVoix = useMemo(() => {
    const v = classementCandidats.map((c) => Number(c.totalVoix) || 0);
    return v.length ? Math.max(...v) : 0;
  }, [classementCandidats]);

  return (
    <div className="resultats-consolidation">

      <style>{`
        /* ===== RésultatsConsolidation — ajouts UI (scopés) ===== */
        .resultats-consolidation .stats-cards{
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }
        .resultats-consolidation .stats-card--participation{
          border: 2px solid rgba(59, 130, 246, 0.55);
          background: linear-gradient(135deg, rgba(59, 130, 246, 0.16), rgba(255,255,255,0.92));
          box-shadow: 0 12px 22px rgba(2, 6, 23, 0.08);
        }
        /* Tableau candidats: largeur + 1ère colonne fixée (desktop) */
        .resultats-consolidation .candidats-table.candidats-table--responsive{
          width:100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        @media (min-width: 901px){
          .resultats-consolidation .candidats-table.candidats-table--responsive td.candidat-name,
          .resultats-consolidation .candidats-table.candidats-table--responsive th:first-child{
            position: sticky;
            left: 0;
            z-index: 2;
            background: rgba(255,255,255,0.96);
          }
          .resultats-consolidation .candidats-table.candidats-table--responsive td.candidat-name{
            z-index: 3;
          }
        }
        /* Mobile/tablette: rendu "cartes" sans scroll horizontal */
        @media (max-width: 900px){
          .resultats-consolidation .candidats-table.candidats-table--responsive thead{
            display:none;
          }
          .resultats-consolidation .candidats-table.candidats-table--responsive,
          .resultats-consolidation .candidats-table.candidats-table--responsive tbody,
          .resultats-consolidation .candidats-table.candidats-table--responsive tr,
          .resultats-consolidation .candidats-table.candidats-table--responsive td{
            display:block;
            width:100%;
          }
          .resultats-consolidation .candidats-table.candidats-table--responsive tr{
            margin: 10px 0 14px;
            padding: 10px 10px 6px;
            border-radius: 16px;
            border: 1px solid rgba(15, 23, 42, 0.12);
            box-shadow: 0 12px 24px rgba(2, 6, 23, 0.08);
            background: rgba(255,255,255,0.96);
          }
          .resultats-consolidation .candidats-table.candidats-table--responsive td{
            padding: 8px 10px;
            border: none;
          }
          .resultats-consolidation .candidats-table.candidats-table--responsive td.candidat-name{
            padding: 6px 10px 10px;
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
            margin-bottom: 8px;
          }
          .resultats-consolidation .candidats-table.candidats-table--responsive td[data-label]{
            display:flex;
            align-items:center;
            justify-content: space-between;
            gap: 12px;
          }
          .resultats-consolidation .candidats-table.candidats-table--responsive td[data-label]::before{
            content: attr(data-label);
            font-weight: 900;
            opacity: 0.75;
            white-space: nowrap;
          }
        }
      `}</style>

      <h2> Consolidation communale - Tour {electionState.tourActuel}</h2>

      {/* 6 cartes totaux */}
      <div className="totaux-grid totaux-grid-6">
        <div className="total-card total-card--inscrits">
          <div className="card-value">{totaux.inscrits.toLocaleString('fr-FR')}</div>
          <div className="card-label">Inscrits</div>
        </div>

        <div className="total-card total-card--votants">
          <div className="card-value">{totaux.votants.toLocaleString('fr-FR')}</div>
          <div className="card-label">Votants</div>
        </div>

        <div className="total-card total-card--exprimes">
          <div className="card-value">{totaux.exprimes.toLocaleString('fr-FR')}</div>
          <div className="card-label">Exprimés</div>
        </div>

        <div className="total-card total-card--blancs">
          <div className="card-value">{totaux.blancs.toLocaleString('fr-FR')}</div>
          <div className="card-label">Blancs</div>
        </div>

        <div className="total-card total-card--nuls">
          <div className="card-value">{totaux.nuls.toLocaleString('fr-FR')}</div>
          <div className="card-label">Nuls</div>
        </div>

        <div className="total-card total-card--abstentions">
          <div className="card-value">{totalAbstentions.toLocaleString('fr-FR')}</div>
          <div className="card-label">Abstentions</div>
        </div>
      </div>

      {/* Statistiques */}
      <div className="resultats-stats">
        <h3>📌 Statistiques :</h3>

        <div className="stats-cards">
          <div className="stats-card stats-card--declares">
            <div className="stats-value">
              <strong>{nbBureauxDeclares.toLocaleString('fr-FR')}</strong> <span className="stats-sep">/</span>{' '}
              <strong>{nbBureaux.toLocaleString('fr-FR')}</strong>
            </div>
            <div className="stats-label">Bureaux déclarés</div>
          </div>

          <div className="stats-card stats-card--blancs">
            <div className="stats-value">
              <strong>{tauxBlancs.toFixed(2)}%</strong>
              <span className="stats-sub">
                <strong>{totaux.blancs.toLocaleString('fr-FR')}</strong> / <strong>{totaux.votants.toLocaleString('fr-FR')}</strong>
              </span>
            </div>
            <div className="stats-label">Taux de blancs</div>
          </div>

          <div className="stats-card stats-card--nuls">
            <div className="stats-value">
              <strong>{tauxNuls.toFixed(2)}%</strong>
              <span className="stats-sub">
                <strong>{totaux.nuls.toLocaleString('fr-FR')}</strong> / <strong>{totaux.votants.toLocaleString('fr-FR')}</strong>
              </span>
            </div>
            <div className="stats-label">Taux de nuls</div>
          </div>

          <div className="stats-card stats-card--ecart">
            <div className="stats-value">
              <strong>{ecartVoix === null ? 'N/A' : `${ecartVoix.toLocaleString('fr-FR')} voix`}</strong>
              <span className="stats-sub">{ecartLabel}</span>
            </div>
            <div className="stats-label">Écart 1er / 2ème</div>
          </div>
          <div className="stats-card stats-card--participation">
            <div className="stats-value">
              <strong>{tauxParticipation.toFixed(2)}%</strong>
              <span className="stats-sub">
                {totaux.votants.toLocaleString('fr-FR')} / {totaux.inscrits.toLocaleString('fr-FR')}
              </span>
            </div>
            <div className="stats-label">Taux de participation (communal)</div>
          </div>
        </div>
        <br />
      </div>

      {/* Résultats par candidat */}
      <div className="resultats-candidats">
        <h3>🧑‍💼 Résultats par candidat :</h3>

        <table className="candidats-table candidats-table--responsive">
          <thead>
            <tr>
              <th style={{ background: '#1f3b6d', color: '#fff' }}>Candidat</th>
              <th>Voix</th>
              <th>%</th>
              <th>Statut</th>
              <th style={{ width: '36%' }}>Barre</th>
            </tr>
          </thead>
          <tbody>
            {classementCandidats.map((candidat, index) => {
              const color = getCandidateColor(candidat, index);
              const isQualifie = electionState.tourActuel === 1 && index < 2;
              const statut = electionState.tourActuel === 1 ? (isQualifie ? 'Qualifié' : 'Éliminé') : '—';

              const pct = clampPct(candidat.pourcentage);
              const ratioToWinner = maxVoix > 0 ? (Number(candidat.totalVoix) || 0) / maxVoix : 0;
              const pctBar = clampPct(ratioToWinner * 100);

              // Texte toujours visible : couleur adaptée au fond (barre ou fond gris)
              const textColor = pctBar < 28 ? '#111827' : yiqTextColor(color);
              const textShadow = pctBar < 28 ? 'none' : '0 1px 1px rgba(0,0,0,0.35)';

              return (
                <tr
                  key={(candidat.listeId || candidat.id) ?? `candidat-${index}`}
                  className={isQualifie ? 'qualified' : ''}
                >
                  <td className="candidat-name" style={isQualifie ? { background: 'rgba(34,197,94,0.12)' } : undefined}>
                    <span className="candidat-color-dot" style={{ backgroundColor: color }} />
                    <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>
                      {candidat.displayName || getCandidateDisplayName(candidat)}
                    </span>
                  </td>

                  <td data-label="Voix">{(Number(candidat.totalVoix) || 0).toLocaleString('fr-FR')}</td>
                  <td data-label="%">{pct.toFixed(2)}%</td>
                  <td data-label="Statut">
                    {electionState.tourActuel === 1 ? (
                      <span className={`badge ${isQualifie ? 'badge--ok' : 'badge--ko'}`}>
                        {isQualifie ? '✅ Qualifié' : '⛔ Éliminé'}
                      </span>
                    ) : (
                      <span className="badge badge--neutral">{statut}</span>
                    )}
                  </td>

                  <td data-label="Barre">
                    <div style={{ position: 'relative', width: '100%', minWidth: 220 }}>
                      <div
                        className="bar-container"
                        style={{
                          position: 'relative',
                          height: 18,
                          borderRadius: 10,
                          background: '#e5e7eb',
                          overflow: 'hidden'
                        }}
                      >
                        <div
                          className="bar-fill"
                          style={{
                            width: `${pctBar}%`,
                            height: '100%',
                            backgroundColor: color
                          }}
                        />
                        <div
                          style={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 13,
                            color: textColor,
                            textShadow
                          }}
                          aria-label={`Pourcentage ${pct.toFixed(1)}%`}
                        >
                          {pct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}

            {classementCandidats.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '18px 8px', opacity: 0.75 }}>
                  Aucun candidat actif trouvé pour le tour {electionState.tourActuel} (vérifier ActifT1/ActifT2 dans l’onglet Candidats).
                </td>
              </tr>
            )}
          </tbody>
        </table>

{/* Classement officiel (UI moderne) */}
        <div
          className="classement-officiel"
          style={{
            marginTop: 22,
            borderRadius: 18,
            border: '1px solid rgba(15, 23, 42, 0.12)',
            boxShadow: '0 14px 30px rgba(2, 6, 23, 0.10)',
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.10) 0%, rgba(255,255,255,0.95) 55%, rgba(34, 197, 94, 0.08) 100%)',
            padding: '16px 16px 14px 16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
<div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', lineHeight: 1.1, color: '#0f172a' }}>
                  Classement officiel
                </div>
                <div style={{ marginTop: 2, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 10px',
                      borderRadius: 999,
                      fontWeight: 900,
                      background: 'rgba(255,255,255,0.92)',
                      border: '1px solid rgba(15, 23, 42, 0.12)',
                      boxShadow: '0 8px 14px rgba(2, 6, 23, 0.06)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                     Tour {electionState.tourActuel}
                  </span>

                  {electionState.tourActuel === 1 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 10px',
                        borderRadius: 999,
                        fontWeight: 900,
                        background: 'rgba(255,255,255,0.92)',
                        border: '1px solid rgba(15, 23, 42, 0.12)',
                        boxShadow: '0 8px 14px rgba(2, 6, 23, 0.06)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                       Top 2 qualifiés
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <span style={{ fontWeight: 800, color: 'rgba(15,23,42,0.75)' }}>Suffrages exprimés</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 14,
                  fontWeight: 900,
                  background: 'rgba(255,255,255,0.92)',
                  border: '2px solid rgba(59, 130, 246, 0.30)',
                  boxShadow: '0 10px 18px rgba(2, 6, 23, 0.08)',
                  color: '#0f172a',
                  whiteSpace: 'nowrap',
                }}
              >
                 {(Number(totaux.exprimes) || 0).toLocaleString('fr-FR')}
              </span>
            </div>
          </div>

          {/* Liste graphique */}
          {classementCandidats.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {(() => {
                const maxVoix = Math.max(0, ...classementCandidats.map((c) => Number(c.totalVoix) || 0));
                return classementCandidats.map((c, idx) => {
                  const voix = Number(c.totalVoix) || 0;
                  const pct = clampPct(c.pourcentage);
                  const rankEmoji = idx === 0 ? '' : idx === 1 ? '' : idx === 2 ? '' : '';
                  const color = isValidHexColor(c.couleur) ? c.couleur : getCandidateColor(c.listeId, idx);
                  const barPct = maxVoix > 0 ? (voix / maxVoix) * 100 : 0;

                  const isQualifie = electionState.tourActuel === 1 && idx < 2;

                  return (
                    <div
                      key={c.listeId || idx}
                      style={{
                        borderRadius: 16,
                        padding: '10px 12px',
                        background: 'rgba(255,255,255,0.92)',
                        border: `2px solid ${isQualifie ? color : 'rgba(15, 23, 42, 0.10)'}`,
                        boxShadow: '0 10px 18px rgba(2, 6, 23, 0.08)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 260 }}>
<div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  width: 14,
                                  height: 28,
                                  borderRadius: 999,
                                  background: color,
                                  boxShadow: '0 0 0 5px rgba(15, 23, 42, 0.06)',
                                  flex: '0 0 auto',
                                }}
                              />
                              <span style={{ fontWeight: 900, fontSize: '1.05rem', color: '#0f172a' }}>
                                {c.displayName || getCandidateDisplayName(c)}
                              </span>
                              {isQualifie && (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '5px 10px',
                                    borderRadius: 999,
                                    fontWeight: 900,
                                    background: 'rgba(255,255,255,0.92)',
                                    border: `1px solid ${color}`,
                                    color: '#0f172a',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  ✅ Qualifié
                                </span>
                              )}
                            </div>
                            <div style={{ marginTop: 3, color: 'rgba(15,23,42,0.70)', fontWeight: 800 }}>
                              {voix.toLocaleString('fr-FR')} voix · {pct.toFixed(2)}%
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 10px',
                              borderRadius: 999,
                              fontWeight: 900,
                              background: 'rgba(255,255,255,0.92)',
                              border: '1px solid rgba(15, 23, 42, 0.12)',
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                            }}
                          >
                             {pct.toFixed(2)}%
                          </span>
                        </div>
                      </div>

                      {/* Barre relative au 1er (max voix) */}
                      <div style={{ marginTop: 10 }}>
                        <div
                          style={{
                            height: 14,
                            borderRadius: 999,
                            background: 'rgba(15, 23, 42, 0.10)',
                            overflow: 'hidden',
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              width: `${clampPct(barPct)}%`,
                              height: '100%',
                              background: color,
                              borderRadius: 999,
                              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontSize: 12,
                              color: barPct >= 35 ? yiqTextColor(color) : '#0f172a',
                              textShadow: barPct >= 35 ? '0 1px 2px rgba(0,0,0,0.25)' : 'none',
                              pointerEvents: 'none',
                            }}
                            aria-hidden="true"
                          >
                            {barPct.toFixed(0)}% du leader
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>
              Aucun classement disponible : candidats inactifs pour ce tour, ou résultats non chargés.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultatsConsolidation;

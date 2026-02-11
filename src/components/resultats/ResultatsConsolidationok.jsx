import React, { useEffect, useMemo, useState } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import { getAuthState, isBV } from '../../services/authService';

/**
 * Normalise les bureauId pour un matching robuste
 */
const normalizeBureauId = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value).trim().toUpperCase();
  const m = s.match(/(\d+)/);
  return m ? m[1] : s;
};

/**
 * Consolidation des résultats
 * 
 * ⚠️ CORRECTION (2026-02-09) :
 * - Les BV voient les inscrits communaux en CONTEXTE uniquement
 * - Les calculs (participation, abstentions) utilisent les données du BUREAU pour les BV
 * - Les Global/Admin voient la consolidation complète communale
 *
 * IMPORTANT :
 * - Ne touche pas à Participation
 * - Ne modifie pas les données dans Sheets (affichage/consolidation locale uniquement)
 */
const ResultatsConsolidation = ({ electionState}) => {
  // Détection du profil utilisateur
  const auth = useMemo(() => getAuthState(), []);
  const isBureau = isBV(auth);
  const bureauId = auth?.bureauId ?? null;

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

  const [totauxCommunaux, setTotauxCommunaux] = useState({
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
      setTotauxCommunaux({ inscrits: 0, votants: 0, blancs: 0, nuls: 0, exprimes: 0 });
      setClassementCandidats([]);
      return;
    }

    // ⚠️ CORRECTION : Totaux communaux (TOUS les bureaux - pour contexte)
    const totalInscritsCommune = bureaux.reduce((sum, b) => sum + (Number(b.inscrits) || 0), 0);
    const totalVotantsCommune = resultats.reduce((sum, r) => sum + (Number(r.votants) || 0), 0);
    const totalBlancsCommune = resultats.reduce((sum, r) => sum + (Number(r.blancs) || 0), 0);
    const totalNulsCommune = resultats.reduce((sum, r) => sum + (Number(r.nuls) || 0), 0);
    const totalExprimesRawCommune = resultats.reduce((sum, r) => sum + (Number(r.exprimes) || 0), 0);
    const totalExprimesSafeCommune =
      totalExprimesRawCommune > 0 ? totalExprimesRawCommune : Math.max(0, totalVotantsCommune - totalBlancsCommune - totalNulsCommune);

    setTotauxCommunaux({
      inscrits: totalInscritsCommune,
      votants: totalVotantsCommune,
      blancs: totalBlancsCommune,
      nuls: totalNulsCommune,
      exprimes: totalExprimesSafeCommune
    });

    // ⚠️ CORRECTION : Pour les BV, utiliser les données du BUREAU uniquement
    let totalInscrits, totalVotants, totalBlancs, totalNuls, totalExprimesSafe;

    if (isBureau && bureauId) {
      // Filtrer les données du bureau uniquement
      const normalized = normalizeBureauId(bureauId);
      const bureauData = bureaux.find((b) => normalizeBureauId(b?.id ?? '') === normalized);
      const resultatsBureau = resultats.filter((r) => normalizeBureauId(r?.bureauId ?? '') === normalized);

      totalInscrits = bureauData ? Number(bureauData.inscrits) || 0 : 0;
      totalVotants = resultatsBureau.reduce((sum, r) => sum + (Number(r.votants) || 0), 0);
      totalBlancs = resultatsBureau.reduce((sum, r) => sum + (Number(r.blancs) || 0), 0);
      totalNuls = resultatsBureau.reduce((sum, r) => sum + (Number(r.nuls) || 0), 0);
      
      const totalExprimesRaw = resultatsBureau.reduce((sum, r) => sum + (Number(r.exprimes) || 0), 0);
      totalExprimesSafe = totalExprimesRaw > 0 ? totalExprimesRaw : Math.max(0, totalVotants - totalBlancs - totalNuls);
    } else {
      // Global/Admin : utiliser les totaux communaux
      totalInscrits = totalInscritsCommune;
      totalVotants = totalVotantsCommune;
      totalBlancs = totalBlancsCommune;
      totalNuls = totalNulsCommune;
      totalExprimesSafe = totalExprimesSafeCommune;
    }

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
      // ⚠️ CORRECTION : Pour les BV, utiliser uniquement les résultats de LEUR bureau
      const resultsForClassement = isBureau && bureauId
        ? resultats.filter((r) => normalizeBureauId(r?.bureauId ?? '') === normalizeBureauId(bureauId))
        : resultats;

      const candidatsAvecTotaux = candidatsActifs.map((candidat) => {
        const listeId = candidat?.listeId;
        const totalVoix = resultsForClassement.reduce((sum, r) => {
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
  }, [resultats, candidats, bureaux, electionState.tourActuel, isBureau, bureauId]);

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

  return (
    <div className="resultats-consolidation">

      <style>{`
        /* ===== RésultatsConsolidation — ajouts UI (scopés) ===== */
        .resultats-consolidation .stats-grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 14px;
        }
        .resultats-consolidation .stats-grid-1 {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }
        .resultats-consolidation .stats-card {
          padding: 20px 24px;
          border-radius: 18px;
          box-shadow: 0 10px 18px rgba(2, 6, 23, 0.08);
        }
        .resultats-consolidation .stats-card-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.95rem;
          font-weight: 800;
          color: rgba(15, 23, 42, 0.7);
          margin-bottom: 12px;
        }
        .resultats-consolidation .stats-card-value {
          font-size: 2.2rem;
          font-weight: 900;
          color: #0f172a;
          line-height: 1;
        }
        .resultats-consolidation .stats-card-meta {
          margin-top: 8px;
          font-size: 0.95rem;
          font-weight: 700;
          color: rgba(15, 23, 42, 0.6);
        }

        /* Responsive: passage en 1 colonne sur mobile */
        @media (max-width: 900px) {
          .resultats-consolidation .stats-grid-3 {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ marginTop: 22 }}>
        {/* Titre principal */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                🏛️ Consolidation {isBureau ? 'du bureau' : 'communale'} - Tour {electionState.tourActuel}
              </div>
            </div>
            {isBureau && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 999,
                fontWeight: 800,
                background: 'rgba(59, 130, 246, 0.10)',
                border: '1px solid rgba(59, 130, 246, 0.30)',
                color: '#0f172a',
                fontSize: '0.85rem'
              }}>
                📊 Bureau BV{bureauId}
              </div>
            )}
          </div>
        </div>
        {(isBureau && electionState.tourActuel === 2) ? (
          <>
            {/* ===== BV — Tour 2 : 6 blocs (2 lignes) ===== */}
            <div className="stats-grid-3">
          {/* Inscrits */}
          <div className="stats-card" style={{
            border: '2px solid rgba(34, 197, 94, 0.55)',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.11) 0%, rgba(134, 239, 172, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              📋 Inscrits {isBureau ? '(votre bureau)' : ''}
            </div>
            <div className="stats-card-value">
              {(Number(totaux.inscrits) || 0).toLocaleString('fr-FR')}
            </div>
            {isBureau && (
              <div className="stats-card-meta" style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                Contexte communal : {(Number(totauxCommunaux.inscrits) || 0).toLocaleString('fr-FR')} inscrits ({nbBureaux} bureaux)
              </div>
            )}
            {!isBureau && (
              <div className="stats-card-meta">
                {nbBureaux} bureau{nbBureaux > 1 ? 'x' : ''}
              </div>
            )}
          </div>

          {/* Participation */}
          <div className="stats-card" style={{
            border: '2px solid rgba(59, 130, 246, 0.55)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.11) 0%, rgba(147, 197, 253, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              ✅ Participation {isBureau ? '(votre bureau)' : ''}
            </div>
            <div className="stats-card-value">
              {clampPct(tauxParticipation).toFixed(2)}%
            </div>
            <div className="stats-card-meta">
              {(Number(totaux.votants) || 0).toLocaleString('fr-FR')} / {(Number(totaux.inscrits) || 0).toLocaleString('fr-FR')}
            </div>
          </div>

          {/* Écart 1er/2ème */}
          <div className="stats-card" style={{
            border: '2px solid rgba(168, 85, 247, 0.55)',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.11) 0%, rgba(192, 132, 252, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              📈 Écart 1er / 2ème
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
              <div className="stats-card-value">
                {ecartVoix !== null ? ecartVoix.toLocaleString('fr-FR') : 'N/A'} voix
              </div>
              <div className="stats-card-meta" style={{ fontSize: '1.1rem' }}>
                {ecartLabel}
              </div>
            </div>
          </div>
            </div>

            <div className="stats-grid-3">
          {/* Taux de blancs */}
          <div className="stats-card" style={{
            border: '2px solid rgba(148, 163, 184, 0.55)',
            background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.11) 0%, rgba(203, 213, 225, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              📄 Taux de blancs
            </div>
            <div className="stats-card-value">
              {clampPct(tauxBlancs).toFixed(2)}%
            </div>
            <div className="stats-card-meta">
              {(Number(totaux.blancs) || 0).toLocaleString('fr-FR')} / {(Number(totaux.votants) || 0).toLocaleString('fr-FR')}
            </div>
          </div>

          {/* Taux de nuls */}
          <div className="stats-card" style={{
            border: '2px solid rgba(239, 68, 68, 0.55)',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.11) 0%, rgba(248, 113, 113, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              🚫 Taux de nuls
            </div>
            <div className="stats-card-value">
              {clampPct(tauxNuls).toFixed(2)}%
            </div>
            <div className="stats-card-meta">
              {(Number(totaux.nuls) || 0).toLocaleString('fr-FR')} / {(Number(totaux.votants) || 0).toLocaleString('fr-FR')}
            </div>
          </div>
          {/* Abstentions */}
          <div className="stats-card" style={{
            border: '2px solid rgba(249, 115, 22, 0.55)',
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.11) 0%, rgba(251, 146, 60, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              ❌ Abstentions
            </div>
            <div className="stats-card-value">
              {totalAbstentions.toLocaleString('fr-FR')}
            </div>
            <div className="stats-card-meta">
              {clampPct(100 - tauxParticipation).toFixed(2)}%
            </div>
          </div>
            </div>
          </>
        ) : (
          <>


        {/* ===== Première ligne : 3 blocs ===== */}
        <div className="stats-grid-3">
          {/* Inscrits */}
          <div className="stats-card" style={{
            border: '2px solid rgba(34, 197, 94, 0.55)',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.11) 0%, rgba(134, 239, 172, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              📋 Inscrits {isBureau ? '(votre bureau)' : ''}
            </div>
            <div className="stats-card-value">
              {(Number(totaux.inscrits) || 0).toLocaleString('fr-FR')}
            </div>
            {isBureau && (
              <div className="stats-card-meta" style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                Contexte communal : {(Number(totauxCommunaux.inscrits) || 0).toLocaleString('fr-FR')} inscrits ({nbBureaux} bureaux)
              </div>
            )}
            {!isBureau && (
              <div className="stats-card-meta">
                {nbBureaux} bureau{nbBureaux > 1 ? 'x' : ''}
              </div>
            )}
          </div>

          {/* Participation */}
          <div className="stats-card" style={{
            border: '2px solid rgba(59, 130, 246, 0.55)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.11) 0%, rgba(147, 197, 253, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              ✅ Participation {isBureau ? '(votre bureau)' : ''}
            </div>
            <div className="stats-card-value">
              {clampPct(tauxParticipation).toFixed(2)}%
            </div>
            <div className="stats-card-meta">
              {(Number(totaux.votants) || 0).toLocaleString('fr-FR')} / {(Number(totaux.inscrits) || 0).toLocaleString('fr-FR')}
            </div>
          </div>

          {/* Abstentions */}
          <div className="stats-card" style={{
            border: '2px solid rgba(249, 115, 22, 0.55)',
            background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.11) 0%, rgba(251, 146, 60, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              ❌ Abstentions
            </div>
            <div className="stats-card-value">
              {totalAbstentions.toLocaleString('fr-FR')}
            </div>
            <div className="stats-card-meta">
              {clampPct(100 - tauxParticipation).toFixed(2)}%
            </div>
          </div>
        </div>

        {/* ===== Deuxième ligne : 3 blocs ===== */}
        <div className="stats-grid-3">
          {/* Bureaux déclarés */}
          <div className="stats-card" style={{
            border: '2px solid rgba(34, 197, 94, 0.55)',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.11) 0%, rgba(134, 239, 172, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              📊 Bureaux déclarés
            </div>
            <div className="stats-card-value">
              {nbBureauxDeclares} / {nbBureaux}
            </div>
            <div className="stats-card-meta">
              {nbBureaux > 0 ? ((nbBureauxDeclares / nbBureaux) * 100).toFixed(0) : 0}%
            </div>
          </div>

          {/* Taux de blancs */}
          <div className="stats-card" style={{
            border: '2px solid rgba(148, 163, 184, 0.55)',
            background: 'linear-gradient(135deg, rgba(148, 163, 184, 0.11) 0%, rgba(203, 213, 225, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              📄 Taux de blancs
            </div>
            <div className="stats-card-value">
              {clampPct(tauxBlancs).toFixed(2)}%
            </div>
            <div className="stats-card-meta">
              {(Number(totaux.blancs) || 0).toLocaleString('fr-FR')} / {(Number(totaux.votants) || 0).toLocaleString('fr-FR')}
            </div>
          </div>

          {/* Taux de nuls */}
          <div className="stats-card" style={{
            border: '2px solid rgba(239, 68, 68, 0.55)',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.11) 0%, rgba(248, 113, 113, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              🚫 Taux de nuls
            </div>
            <div className="stats-card-value">
              {clampPct(tauxNuls).toFixed(2)}%
            </div>
            <div className="stats-card-meta">
              {(Number(totaux.nuls) || 0).toLocaleString('fr-FR')} / {(Number(totaux.votants) || 0).toLocaleString('fr-FR')}
            </div>
          </div>
        </div>

        {/* ===== Troisième ligne : 1 bloc pleine largeur ===== */}
        <div className="stats-grid-1">
          {/* Écart 1er/2ème */}
          <div className="stats-card" style={{
            border: '2px solid rgba(168, 85, 247, 0.55)',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.11) 0%, rgba(192, 132, 252, 0.07) 100%)'
          }}>
            <div className="stats-card-label">
              📈 Écart 1er / 2ème
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
              <div className="stats-card-value">
                {ecartVoix !== null ? ecartVoix.toLocaleString('fr-FR') : 'N/A'} voix
              </div>
              <div className="stats-card-meta" style={{ fontSize: '1.1rem' }}>
                {ecartLabel}
              </div>
            </div>
          </div>
        </div>

        
          </>
        )}

        {/* ===== Classement officiel ===== */}
        <div
          style={{
            marginTop: 22,
            borderRadius: 18,
            border: '1px solid rgba(15, 23, 42, 0.42)',
            boxShadow: '0 14px 30px rgba(2, 6, 23, 0.50)',
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.70) 0%, rgba(255,255,255,0.75) 55%, rgba(34, 197, 94, 0.08) 100%)',
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
              maxWidth: '100%',
              minWidth: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, maxWidth: '100%', minWidth: 0 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: '1.1rem', lineHeight: 1.1, color: '#0f172a' }}>
                  🏆 Résultats par candidat {isBureau ? '(votre bureau)' : ''}
                  <div style={{ marginTop: 2, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <br />
				  </div>
                  {electionState.tourActuel === 1 && !isBureau && (
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
                  maxWidth: '100%',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: '0 1 auto',
                        maxWidth: '100%',
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: '1 1 auto',
                      }}
                    >
                      🗳️ Tour {electionState.tourActuel}   📋 Les 2 listes qualifiées
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
                maxWidth: '100%',
                minWidth: 0,
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
                ✍️ {(Number(totaux.exprimes) || 0).toLocaleString('fr-FR')}
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
                  const color = isValidHexColor(c.couleur) ? c.couleur : getCandidateColor(c.listeId, idx);

                  const isQualifie = electionState.tourActuel === 1 && idx < 2 && !isBureau;

                  return (
                    <div
                      key={c.listeId || idx}
                      style={{
                        borderRadius: 16,
                        padding: '10px 22px',
                        background: 'rgba(255,255,255,0.92)',
                        border: `2px solid ${isQualifie ? color : 'rgba(15, 23, 42, 0.10)'}`,
                        boxShadow: '0 10px 18px rgba(2, 6, 23, 0.08)',
                        width: '100%',
                        maxWidth: '100%',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 260px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  width: 50,
                                  height: 18,
                                  borderRadius: 999,
                                  background: color,
                                  boxShadow: '0 0 0 5px rgba(15, 23, 42, 0.06)',
                                  flex: '0 0 auto',
                                }}
                              />
                              <span style={{ fontWeight: 900, fontSize: '1rem', color: '#0f172a' }}>
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
                                  ✅ Liste qualifiée
                                </span>
                              )}
                            </div>
                            <div style={{ marginTop: 1, color: 'rgba(15,23,42,0.70)', fontWeight: 1000 }}>
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
                            📊 {pct.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div style={{ opacity: 0.95 }}>
              Aucun classement disponible : candidats inactifs pour ce tour, ou résultats non chargés.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultatsConsolidation;

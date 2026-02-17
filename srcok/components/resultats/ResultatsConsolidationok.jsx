import React, { useEffect, useMemo, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Consolidation des résultats
 * - Totaux communaux
 * - Statistiques agrégées
 * - Tableau par candidat
 *
 * IMPORTANT : ne modifie pas les calculs métiers (uniquement mise en forme + robustesse d'affichage).
 */
const ResultatsConsolidation = () => {
  const { state: electionState } = useElectionState();

  const {
    data: bureaux,
    load: loadBureaux
  } = useGoogleSheets('Bureaux');

  const {
    data: candidats,
    load: loadCandidats
  } = useGoogleSheets('Candidats');

  const {
    data: resultats,
    load: loadResultats
  } = useGoogleSheets(electionState.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2');

  const [totaux, setTotaux] = useState({
    inscrits: 0,
    votants: 0,
    blancs: 0,
    nuls: 0,
    exprimes: 0
  });

  const [classementCandidats, setClassementCandidats] = useState([]);

  // --- Extraction robuste des champs (évite les colonnes "décalées" selon la structure Sheets) ---
  const _normalizeKey = (k) =>
    (k || '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();

  const _isPlainNumber = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)));

  const _extractRowCounts = (row) => {
    // Priorité : lecture par en-têtes (GoogleSheets -> objets {Inscrits, Votants, ...})
    const pick = (keys) => {
      for (const k of keys) {
        const v = row?.[k];
        if (v === undefined || v === null || v === "") continue;
        const n = Number(String(v).replace(",", "."));
        if (!Number.isNaN(n)) return n;
      }
      return null;
    };

    const inscrits = pick(["Inscrits", "inscrits", "INSCRITS"]);
    const votants = pick(["Votants", "votants", "VOTANTS"]);
    const blancs = pick(["Blancs", "blancs", "BLANCS"]);
    const nuls = pick(["Nuls", "nuls", "NULS"]);
    const exprimes = pick([
      "Exprimes",
      "exprimes",
      "EXPRIMES",
      "Exprimés",
      "exprimés",
      "EXPRIMÉS",
    ]);

    // Fallback: si la hook nous renvoie un tableau de cellules, on retombe sur l'heuristique.
    if (
      inscrits === null &&
      votants === null &&
      blancs === null &&
      nuls === null &&
      exprimes === null
    ) {
      const values = Object.values(row || {})
        .filter((v) => typeof v === "number" || (typeof v === "string" && v.trim() !== ""))
        .map((v) => Number(String(v).replace(",", ".")))
        .filter((n) => !Number.isNaN(n));

      // Heuristique conservatrice: on s'appuie sur les 5 premières valeurs numériques.
      const [a, b, c, d, e] = values;
      return {
        inscrits: a || 0,
        votants: b || 0,
        blancs: c || 0,
        nuls: d || 0,
        exprimes: e || 0,
      };
    }

    return {
      inscrits: inscrits ?? 0,
      votants: votants ?? 0,
      blancs: blancs ?? 0,
      nuls: nuls ?? 0,
      exprimes: exprimes ?? 0,
    };
  };

  // Palette stable (harmonisée entre vues) — ne change pas les calculs, uniquement la présentation.
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

  const getCandidateColor = (candidatId, fallbackIndex = 0) => {
    const idx = (hashToIndex(candidatId) + fallbackIndex) % PALETTE.length;
    return PALETTE[idx];
  };

  useEffect(() => {
    // Chargements nécessaires (sinon inscrits = 0, candidats absents, etc.)
    loadBureaux();
    loadCandidats();
    loadResultats();
  }, [loadBureaux, loadCandidats, loadResultats]);

  useEffect(() => {
    if (bureaux.length === 0 && resultats.length === 0) {
      // Rien à calculer
      setTotaux({ inscrits: 0, votants: 0, blancs: 0, nuls: 0, exprimes: 0 });
      setClassementCandidats([]);
      return;
    }

    // Totaux communaux
    const totalInscrits = bureaux.reduce((sum, b) => sum + (Number(b.inscrits) || 0), 0);

    const rowsCounts = resultats.map((r) => {
      const bureauInscrits = bureaux.find((b) => b.id === r.bureauId || b.bureauId === r.bureauId || b.nom === r.bureauNom)?.inscrits;
      const inscritsRef = Number(r.inscrits) || Number(bureauInscrits) || 0;
      return _extractRowCounts(r, inscritsRef);
    });

    const totalVotants = rowsCounts.reduce((sum, c) => sum + (Number(c.votants) || 0), 0);
    const totalBlancs = rowsCounts.reduce((sum, c) => sum + (Number(c.blancs) || 0), 0);
    const totalNuls = rowsCounts.reduce((sum, c) => sum + (Number(c.nuls) || 0), 0);
    const totalExprimes = rowsCounts.reduce((sum, c) => sum + (Number(c.exprimes) || 0), 0);

    setTotaux({
      inscrits: totalInscrits,
      votants: totalVotants,
      blancs: totalBlancs,
      nuls: totalNuls,
      exprimes: totalExprimes
    });

    // Classement candidats
    if (candidats.length > 0) {
      const candidatsAvecTotaux = candidats.map((candidat) => {
        const totalVoix = resultats.reduce((sum, r) => {
          const voix = r.voix?.[candidat.id];
          return sum + (Number(voix) || 0);
        }, 0);

        return {
          ...candidat,
          totalVoix,
          pourcentage: totalExprimes > 0 ? (totalVoix / totalExprimes) * 100 : 0
        };
      });

      candidatsAvecTotaux.sort((a, b) => b.totalVoix - a.totalVoix);
      setClassementCandidats(candidatsAvecTotaux);
    } else {
      setClassementCandidats([]);
    }
  }, [resultats, candidats, bureaux]);

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
    return `${top1.nom} vs ${top2.nom}`;
  }, [top1, top2]);

  return (
    <div className="resultats-consolidation">
      <h2>📊 Consolidation communale - Tour {electionState.tourActuel}</h2>

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

      {/* Statistiques en 4 cartes (comme Participation) */}
      <div className="resultats-stats">
        <h3>📌 Statistiques :</h3>

        <div className="stats-cards">
          <div className="stats-card stats-card--declares">
            <div className="stats-value">
              {nbBureauxDeclares.toLocaleString('fr-FR')} <span className="stats-sep">/</span>{' '}
              {nbBureaux.toLocaleString('fr-FR')}
            </div>
            <div className="stats-label">Bureaux déclarés</div>
          </div>

          <div className="stats-card stats-card--blancs">
            <div className="stats-value">
              {tauxBlancs.toFixed(2)}%
              <span className="stats-sub">
                {totaux.blancs.toLocaleString('fr-FR')} / {totaux.votants.toLocaleString('fr-FR')}
              </span>
            </div>
            <div className="stats-label">Taux de blancs</div>
          </div>

          <div className="stats-card stats-card--nuls">
            <div className="stats-value">
              {tauxNuls.toFixed(2)}%
              <span className="stats-sub">
                {totaux.nuls.toLocaleString('fr-FR')} / {totaux.votants.toLocaleString('fr-FR')}
              </span>
            </div>
            <div className="stats-label">Taux de nuls</div>
          </div>

          <div className="stats-card stats-card--ecart">
            <div className="stats-value">
              {ecartVoix === null ? 'N/A' : `${ecartVoix.toLocaleString('fr-FR')} voix`}
              <span className="stats-sub">{ecartLabel}</span>
            </div>
            <div className="stats-label">Écart 1er / 2ème</div>
          </div>
        </div>

        {/* Petit rappel non bloquant */}
        {electionState.tourActuel === 1 && (
          <p className="qualification-note">Les 2 premiers candidats sont qualifiés pour le 2nd tour</p>
        )}
      </div>

      {/* Résultats par candidat */}
      <div className="resultats-candidats">
        <h3>🧑‍💼 Résultats par candidat :</h3>

        <table className="candidats-table">
          <thead>
            <tr>
              <th>Candidat</th>
              <th>Voix</th>
              <th>%</th>
              <th>Statut</th>
              <th>Barre</th>
            </tr>
          </thead>
          <tbody>
            {classementCandidats.map((candidat, index) => {
              const color = getCandidateColor(candidat.id, index);
              const isQualifie = electionState.tourActuel === 1 && index < 2;
              const statut =
                electionState.tourActuel === 1 ? (isQualifie ? 'Qualifié' : 'Éliminé') : '—';

              return (
                <tr key={candidat.id ?? `candidat-${index}`} className={isQualifie ? 'qualified' : ''}>
                  <td className="candidat-name">
                    <span className="candidat-color-dot" style={{ backgroundColor: color }} />
                    {candidat.nom}
                  </td>
                  <td>{(Number(candidat.totalVoix) || 0).toLocaleString('fr-FR')}</td>
                  <td>{(Number(candidat.pourcentage) || 0).toFixed(2)}%</td>
                  <td>
                    {electionState.tourActuel === 1 ? (
                      <span className={`badge ${isQualifie ? 'badge--ok' : 'badge--ko'}`}>
                        {isQualifie ? '✅ Qualifié' : '⛔ Éliminé'}
                      </span>
                    ) : (
                      <span className="badge badge--neutral">{statut}</span>
                    )}
                  </td>
                  <td>
                    <div className="bar-container">
                      <div
                        className="bar-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, Number(candidat.pourcentage) || 0))}%`,
                          backgroundColor: color
                        }}
                      >
                        <span className="bar-text">{(Number(candidat.pourcentage) || 0).toFixed(1)}%</span>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Indicateur participation globale (affichage) */}
        <div className="participation-global">
          <div className="participation-global__label">Taux de participation (communal)</div>
          <div className="participation-global__value">{tauxParticipation.toFixed(2)}%</div>
        </div>
      </div>
    </div>
  );
};

export default ResultatsConsolidation;

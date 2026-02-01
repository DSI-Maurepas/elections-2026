import React, { useMemo } from 'react';
import useGoogleSheets from '../../hooks/useGoogleSheets';
import useElectionState from '../../hooks/useElectionState';

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#f59e0b'];

const n = (v) => {
  const num = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const getCandidateName = (c, idx) => {
  const name = c?.nom ?? c?.name ?? c?.Nom ?? c?.label;
  return (name && String(name).trim()) ? String(name).trim() : `Candidat ${idx + 1}`;
};

const getCandidateId = (c, idx) => {
  const id = c?.id ?? c?.code ?? c?.key;
  if (id && String(id).trim()) return String(id).trim();
  // fallback : L1..L5
  return `L${idx + 1}`;
};

const ResultatsClassement = () => {
  const { state: electionState } = useElectionState();
  const tour = electionState?.activeTour || 1;

  const { resultats: resultatsRaw, candidats: candidatsRaw } = useGoogleSheets(tour);
  const resultats = Array.isArray(resultatsRaw) ? resultatsRaw : [];
  const candidats = Array.isArray(candidatsRaw) ? candidatsRaw : [];

  const totalExprimes = useMemo(() => {
    return resultats.reduce((acc, r) => acc + n(r.exprimes ?? r.Exprimes), 0);
  }, [resultats]);

  const classement = useMemo(() => {
    if (!candidats.length) return [];

    const totals = candidats.map((c, idx) => {
      const id = getCandidateId(c, idx);
      const totalVoix = resultats.reduce((acc, r) => {
        const voixObj = r.voix || r.Voix || {};
        // accepte {L1: 123} ou {"L1_Voix":123}
        const v = voixObj[id] ?? voixObj[`${id}_Voix`] ?? voixObj[`${id}Voix`];
        return acc + n(v);
      }, 0);
      return { id, name: getCandidateName(c, idx), totalVoix };
    });

    const sorted = totals
      .slice()
      .sort((a, b) => b.totalVoix - a.totalVoix)
      .map((c) => ({
        ...c,
        pct: totalExprimes > 0 ? (c.totalVoix / totalExprimes) * 100 : 0,
      }));

    return sorted;
  }, [candidats, resultats, totalExprimes]);

  const top3 = classement.slice(0, 3);
  const others = classement.slice(3);

  return (
    <section className="resultats-section">

      {/* Top 3 (et uniquement top 3 ici pour éviter tout doublon visuel) */}
      <div className="top3-grid">
        {top3.map((candidat, index) => {
          const rank = index + 1;
          const color = COLORS[(rank - 1) % COLORS.length];
          const isQualifie = rank <= 2;
          return (
            <div
              key={`${candidat.id}-${rank}`}
              className={`top3-card ${isQualifie ? 'qualified' : 'eliminated'}`}
              style={{ borderLeftColor: color }}
            >
              <div className="top3-rank" style={{ color }}>{rank}</div>
              <div className="top3-content">
                <div className="top3-name">{candidat.name}</div>
                <div className="top3-badge">
                  {isQualifie ? (
                    <span className="badge qualified">✅ QUALIFIÉ</span>
                  ) : (
                    <span className="badge eliminated">⛔ ÉLIMINÉ</span>
                  )}
                </div>
              </div>
              <div className="top3-stats">
                <div className="top3-voix">{candidat.totalVoix.toLocaleString('fr-FR')}</div>
                <div className="top3-pct">{candidat.pct.toFixed(2)}%</div>
                <div className="top3-bar">
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${Math.min(100, candidat.pct)}%`, background: color }} />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Autres candidats (optionnel) */}
      {others.length > 0 && (
        <div className="classement-list">
          <div className="classement-subtitle">Autres candidats</div>
          {others.map((candidat, idx) => {
            const rank = idx + 4;
            const color = COLORS[(rank - 1) % COLORS.length];
            return (
              <div key={`${candidat.id}-${rank}`} className="classement-item" style={{ borderLeftColor: color }}>
                <div className="classement-rank" style={{ color }}>{rank}</div>
                <div className="classement-name">{candidat.name}</div>
                <div className="classement-voix">{candidat.totalVoix.toLocaleString('fr-FR')}</div>
                <div className="classement-pct">{candidat.pct.toFixed(2)}%</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ResultatsClassement;

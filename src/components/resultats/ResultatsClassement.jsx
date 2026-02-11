import React, { useMemo } from 'react';
import useGoogleSheets from '../../hooks/useGoogleSheets';

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#f59e0b'];

const n = (v) => {
  const num = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const getCandidateName = (c, idx) => {
  // Priorité : nomListe (court), puis teteListePrenom + teteListeNom, puis fallback
  const nomListe = (c?.nomListe ?? '').toString().trim();
  if (nomListe) return nomListe;
  const prenom = (c?.teteListePrenom ?? '').toString().trim();
  const nom = (c?.teteListeNom ?? '').toString().trim();
  const full = [prenom, nom].filter(Boolean).join(' ');
  if (full) return full;
  // Anciens formats (compatibilité)
  const legacy = c?.nom ?? c?.name ?? c?.Nom ?? c?.label;
  return (legacy && String(legacy).trim()) ? String(legacy).trim() : `Candidat ${idx + 1}`;
};

const getCandidateId = (c, idx) => {
  // Priorité : listeId (champ réel Sheets), puis id/code/key (anciens formats)
  const listeId = c?.listeId ?? c?.id ?? c?.code ?? c?.key;
  if (listeId && String(listeId).trim()) return String(listeId).trim();
  return `L${idx + 1}`;
};

const ResultatsClassement = ({ electionState}) => {
  const tourActuel = electionState?.tourActuel || 1;

  // Deux appels séparés à useGoogleSheets (pattern standard)
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultatsRaw } = useGoogleSheets(tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2');
  
  const resultats = Array.isArray(resultatsRaw) ? resultatsRaw : [];
  const candidatsArray = useMemo(() => {
    const list = Array.isArray(candidats) ? candidats : [];
    return list.filter((c) => (tourActuel === 1 ? !!c.actifT1 : !!c.actifT2));
  }, [candidats, tourActuel]);

  const totalExprimes = useMemo(() => {
    return resultats.reduce((acc, r) => acc + n(r.exprimes ?? r.Exprimes), 0);
  }, [resultats]);

  const classement = useMemo(() => {
    if (!candidatsArray.length) return [];

    const totals = candidatsArray.map((c, idx) => {
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
  }, [candidatsArray, resultats, totalExprimes]);

  const top2 = classement.slice(0, 2); // Seulement les 2 qualifiés
  const others = classement.slice(2);  // Tous les éliminés (à partir du 3ème)

  return (
    <section className="resultats-section">

      {/* Top 2 qualifiés uniquement */}
      <div className="top3-grid">
        {top2.map((candidat, index) => {
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
                {/* Barre de progression proportionnelle au % */}
                <div className="top3-progress-container">
                  <div className="top3-progress-fill" style={{ width: `${candidat.pct}%`, backgroundColor: color }}></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Autres candidats (tous les éliminés) - COMPACT SUR UNE LIGNE */}
      {others.length > 0 && (
        <div className="classement-list">
          <div className="classement-subtitle">Autres candidats</div>
          {others.map((candidat, idx) => {
            const rank = idx + 3; // Commence au rang 3 (3ème, 4ème, 5ème...)
            const color = COLORS[(rank - 1) % COLORS.length];
            return (
              <div key={`${candidat.id}-${rank}`} className="classement-item-compact">
                {/* Numéro dans un cercle grisé */}
                <div className="classement-rank-circle" style={{ color }}>{rank}</div>
                
                {/* Nom du candidat */}
                <div className="classement-name">{candidat.name}</div>
                
                {/* Voix */}
                <div className="classement-voix">{candidat.totalVoix.toLocaleString('fr-FR')}</div>
                
                {/* Pourcentage */}
                <div className="classement-pct">{candidat.pct.toFixed(2)}%</div>
                
                {/* Badge ÉLIMINÉ */}
                <span className="badge eliminated-compact">⛔ ÉLIMINÉ</span>
                
                {/* Barre de progression proportionnelle */}
                <div className="classement-progress-container">
                  <div className="classement-progress-fill" style={{ width: `${candidat.pct}%`, backgroundColor: color }}></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ResultatsClassement;

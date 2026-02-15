import React, { useMemo } from 'react';
import useGoogleSheets from '../../hooks/useGoogleSheets';
import { getAuthState, isBV } from '../../services/authService';

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#f59e0b'];

const n = (v) => {
  const num = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(num) ? num : 0;
};

const getCandidateName = (c, idx) => {
  const nomListe = (c?.nomListe ?? '').toString().trim();
  if (nomListe) return nomListe;
  const prenom = (c?.teteListePrenom ?? '').toString().trim();
  const nom = (c?.teteListeNom ?? '').toString().trim();
  const full = [prenom, nom].filter(Boolean).join(' ');
  if (full) return full;
  const legacy = c?.nom ?? c?.name ?? c?.Nom ?? c?.label;
  return (legacy && String(legacy).trim()) ? String(legacy).trim() : `Candidat ${idx + 1}`;
};

const getCandidateId = (c, idx) => {
  const listeId = c?.listeId ?? c?.id ?? c?.code ?? c?.key;
  if (listeId && String(listeId).trim()) return String(listeId).trim();
  return `L${idx + 1}`;
};

const ResultatsClassement = ({ electionState }) => {
  const auth = useMemo(() => getAuthState(), []);
  const isBureau = isBV(auth);

  const tourActuel = electionState?.tourActuel || 1;
  const isTour1 = tourActuel === 1;

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

  const SEUIL_QUALIFICATION = 10;
  
  // Logique de qualification selon le tour
  let top2OrQualifies, others;
  
  if (isTour1) {
    // Tour 1 : tous ceux >= 10% sont qualifiés
    const qualifies = classement.filter(c => c.pct >= SEUIL_QUALIFICATION);
    top2OrQualifies = qualifies.length >= 2 ? qualifies : classement.slice(0, 2);
    others = classement.filter(c => !top2OrQualifies.includes(c));
  } else {
    // Tour 2 : seul le 1er est qualifié (gagnant)
    top2OrQualifies = classement.slice(0, 1);
    others = classement.slice(1);
  }

  // --- RENDU DES CARTES INDIVIDUELLES ---
  const classementContent = (
    <>
      {/* Candidats qualifiés */}
      <div style={{ marginBottom: 16 }}>
        {top2OrQualifies.map((candidat, index) => {
          const rank = classement.findIndex(c => c.id === candidat.id) + 1;
          const color = COLORS[(rank - 1) % COLORS.length];
          
          // Logique de qualification selon le tour
          const isQualifie = isTour1 
            ? (candidat.pct >= SEUIL_QUALIFICATION || rank <= 2)
            : (rank === 1);
          
          // Texte du badge selon le tour
          const badgeText = isTour1 
            ? "✅ LISTE QUALIFIÉ"
            : "🏆 LISTE ÉLUE";
          
          return (
            <div
              key={`${candidat.id}-${rank}`}
              style={{
                background: '#fff',
                border: `2px solid ${color}`,
                borderLeft: `6px solid ${color}`,
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                transition: 'all 0.2s'
              }}
            >
              {/* Rang */}
              <div style={{
                fontSize: 24,
                fontWeight: 900,
                color: color,
                minWidth: 35,
                textAlign: 'center'
              }}>
                {rank}
              </div>

              {/* Nom + Badge */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: '#1e293b',
                  marginBottom: 6
                }}>
                  {candidat.name}
                </div>
                <div>
                  {isQualifie ? (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#059669',
                      background: '#d1fae5',
                      padding: '3px 10px',
                      borderRadius: 6,
                      display: 'inline-block'
                    }}>
                      {badgeText}
                    </span>
                  ) : (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#dc2626',
                      background: '#fee2e2',
                      padding: '3px 10px',
                      borderRadius: 6,
                      display: 'inline-block'
                    }}>
                      ⛔ LISTE ÉLIMINÉ
                    </span>
                  )}
                </div>
              </div>

              {/* Stats + Barre */}
              <div style={{ 
                minWidth: 180,
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'baseline', 
                  justifyContent: 'flex-end',
                  gap: 8
                }}>
                  <span style={{ 
                    fontSize: 18, 
                    fontWeight: 800, 
                    color: '#1e293b' 
                  }}>
                    {candidat.totalVoix.toLocaleString('fr-FR')}
                  </span>
                  <span style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: color 
                  }}>
                    {candidat.pct.toFixed(2)}%
                  </span>
                </div>
                <div style={{
                  height: 8,
                  background: '#f1f5f9',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${candidat.pct}%`,
                    background: color,
                    borderRadius: 4,
                    transition: 'width 0.5s ease'
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {others.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{
            fontSize: 14,
            fontWeight: 700,
            color: '#64748b',
            marginBottom: 12,
            paddingLeft: 4
          }}>
            {isTour1 ? 'Autres candidats' : 'Autres listes'}
          </div>
          {others.map((candidat) => {
            const rank = classement.findIndex(c => c.id === candidat.id) + 1;
            const color = COLORS[(rank - 1) % COLORS.length];
            return (
              <div 
                key={`${candidat.id}-${rank}`} 
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${color}`,
                  borderRadius: 8,
                  padding: '10px 14px',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}
              >
                {/* Rang */}
                <div style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: color,
                  minWidth: 28,
                  textAlign: 'center'
                }}>
                  {rank}
                </div>

                {/* Nom */}
                <div style={{ 
                  flex: 1, 
                  fontSize: 14, 
                  fontWeight: 700,
                  color: '#475569',
                  minWidth: 0
                }}>
                  {candidat.name}
                </div>

                {/* Badge ÉLIMINÉ (T1 seulement) */}
                {isTour1 && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#dc2626',
                    background: '#fee2e2',
                    padding: '2px 8px',
                    borderRadius: 4
                  }}>
                    ⛔ ÉLIMINÉ
                  </span>
                )}

                {/* Stats */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'baseline', 
                  gap: 6,
                  minWidth: 120
                }}>
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 700, 
                    color: '#1e293b' 
                  }}>
                    {candidat.totalVoix.toLocaleString('fr-FR')}
                  </span>
                  <span style={{ 
                    fontSize: 13, 
                    fontWeight: 600, 
                    color: '#64748b' 
                  }}>
                    {candidat.pct.toFixed(2)}%
                  </span>
                </div>

                {/* Barre de progression */}
                <div style={{
                  width: 80,
                  height: 6,
                  background: '#e2e8f0',
                  borderRadius: 3,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${candidat.pct}%`,
                    background: color,
                    borderRadius: 3
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // Modification ici : on affiche si Admin, quel que soit le tour, pour bénéficier du design T2
  const shouldShowOfficialWrap = !isBureau;

  // Configuration dynamique des couleurs selon le tour
  const headerStyle = isTour1
    ? {
        background: 'linear-gradient(135deg, #addbbd 20%, #6aa05d 100%)', // Vert Émeraude (T1)
        color: '#fff',
        iconColor: '#d1fae5'
      }
    : {
        background: 'linear-gradient(135deg, #297cdb 0%, #84bdff 60%)', // Bleu Royal (T2)
        color: '#fff',
        iconColor: '#dbeafe'
      };

  return (
    <section className="resultats-section">
      {shouldShowOfficialWrap ? (
        <div
          className="resultats-card classement-officiel"
          style={{
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            border: '2px solid #e5e7eb',
            borderTop: `4px solid ${isTour1 ? '#10b981' : '#3b82f6'}`,
            padding: 0,
            marginBottom: 24,
            overflow: 'hidden'
          }}
        >
          {/* Header compact - Une seule ligne avec titre + stats */}
          <div style={{ 
            padding: '16px 20px',
            borderBottom: '2px solid #f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16
          }}>
            {/* Titre */}
            <div style={{ 
              fontSize: 18, 
              fontWeight: 800, 
              color: '#1e293b',
              display: 'flex', 
              alignItems: 'center', 
              gap: 8 
            }}>
              <span style={{ fontSize: 20 }}>📈</span>
              <span>Classement officiel — Tour {tourActuel}</span>
            </div>

            {/* Stats inline compactes */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 24,
              fontSize: 14,
              color: '#64748b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>🗳️</span>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  {totalExprimes.toLocaleString('fr-FR')}
                </span>
                <span>exprimés</span>
              </div>
              <div style={{ 
                width: 1, 
                height: 20, 
                background: '#e5e7eb' 
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>✨</span>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  {top2OrQualifies.length}
                </span>
                <span>{isTour1 ? 'qualifiées' : 'élue'}</span>
              </div>
            </div>
          </div>

          {/* Corps - Classement */}
          <div style={{ padding: 20 }}>
            {classementContent}
          </div>
        </div>
      ) : (
        classementContent
      )}
    </section>
  );
};

export default ResultatsClassement;
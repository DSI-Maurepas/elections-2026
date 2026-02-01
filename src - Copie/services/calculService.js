// src/services/calculService.js
// Calculs métier – Élections municipales 2026
// Correctif clé :
// - Taux de participation communal = (Somme des votants à la DERNIÈRE HEURE disponible, tous bureaux) / (Somme des inscrits, tous bureaux)
// - Protection contre NaN / division par 0
// - Compatible Participation_T1 / Participation_T2

const toInt = (v, def = 0) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseInt(v.replace(/\s/g, ''), 10);
    return Number.isFinite(n) ? n : def;
  }
  return def;
};

// Détecte les clés de type votants09h ... votants20h
const isVotantsKey = (key) => /^votants\d{2}h$/i.test(key);

// Retourne la clé de la dernière heure présente dans une ligne
const getDerniereHeureKey = (row) => {
  if (!row || typeof row !== 'object') return null;

  const keys = Object.keys(row).filter(isVotantsKey);
  if (!keys.length) return null;

  // Trie par heure croissante (09h -> 20h)
  keys.sort((a, b) => {
    const ha = parseInt(a.match(/\d{2}/)?.[0] || '0', 10);
    const hb = parseInt(b.match(/\d{2}/)?.[0] || '0', 10);
    return ha - hb;
  });

  return keys[keys.length - 1];
};

export const calculService = {
  /**
   * Calcul des agrégats communaux de participation
   * @param {Array<Object>} participationRows
   * @returns {Object} { totalInscrits, totalVotants, tauxParticipation }
   */
  calcParticipationCommune(participationRows = []) {
    const rows = Array.isArray(participationRows) ? participationRows : [];

    // 1) Total des inscrits = somme des inscrits par bureau
    const totalInscrits = rows.reduce(
      (sum, r) => sum + toInt(r?.inscrits, 0),
      0
    );

    // 2) Total des votants = somme des votants à la dernière heure par bureau
    let totalVotants = 0;
    for (const r of rows) {
      const lastHourKey = getDerniereHeureKey(r);
      if (lastHourKey) {
        totalVotants += toInt(r?.[lastHourKey], 0);
      }
    }

    // 3) Taux de participation sécurisé
    const tauxParticipation =
      totalInscrits > 0 ? (totalVotants / totalInscrits) * 100 : 0;

    return {
      totalInscrits,
      totalVotants,
      tauxParticipation
    };
  },

  /**
   * Formatage sûr d'un pourcentage
   */
  formatPercent(value, decimals = 2) {
    const n = Number(value);
    if (!Number.isFinite(n)) return `0.${'0'.repeat(decimals)}%`;
    return `${n.toFixed(decimals)}%`;
  }
};

export default calculService;

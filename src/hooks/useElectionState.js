// src/hooks/useElectionState.js
import { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import googleSheetsService from '../services/googleSheetsService';
import auditService from '../services/auditService';
import { SHEET_NAMES } from '../utils/constants';

/**
 * Hook personnalisé pour gérer l'état global de l'élection
 * Gère le tour actuel, le verrouillage, et la synchronisation avec Google Sheets
 */
export const useElectionState = () => {
  const [state, setState] = useState({
    tourActuel: 1, // 1 ou 2
    tour1Verrouille: false,
    tour2Verrouille: false,
    // Flag piloté par l'Administration
    secondTourEnabled: false,
    dateT1: '2026-03-15',
    dateT2: '2026-03-22',
    candidatsQualifies: [], // Pour le T2
    loading: true,
    error: null
  });

  const ensureToken = () => {
    const token = authService.getAccessToken();
    if (!token) {
      const err = new Error('Non authentifié - Token manquant');
      err.code = 'AUTH_REQUIRED';
      throw err;
    }
    return token;
  };

  const coerceBool = (v, def = false) => {
    if (v === true) return true;
    if (v === false) return false;
    if (typeof v === 'number') return v === 1;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (!s) return def;
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
    return def;
  };

  // Charger l'état depuis Google Sheets
  const loadState = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      ensureToken();
      const data = await googleSheetsService.getElectionState();

      // IMPORTANT: on CONSERVE les clés inconnues déjà présentes et on ajoute/actualise les clés connues.
      // Cela évite les régressions lorsque de nouveaux flags sont introduits (ex: secondTourEnabled).
      setState(prev => ({
        ...prev,

        tourActuel: data.tourActuel ?? 1,
        tour1Verrouille: coerceBool(data.tour1Verrouille, false),
        tour2Verrouille: coerceBool(data.tour2Verrouille, false),

        // Flag ajouté (piloté depuis Administration)
        secondTourEnabled: coerceBool(data.secondTourEnabled ?? data.passageSecondTourEnabled ?? data.t2Enabled, prev.secondTourEnabled),

        dateT1: data.dateT1 || '2026-03-15',
        dateT2: data.dateT2 || '2026-03-22',

        candidatsQualifies: Array.isArray(data.candidatsQualifies)
          ? data.candidatsQualifies
          : (data.candidatsQualifies ? [data.candidatsQualifies] : []),

        loading: false,
        error: null
      }));
    } catch (error) {
      console.error('Erreur chargement état élection:', error);
      // Si non authentifié, on stoppe proprement sans boucler
      if (error.code === 'AUTH_REQUIRED') {
        setState(prev => ({ ...prev, loading: false, error: null }));
        return;
      }
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  }, []);

  // Passer au 2nd tour
  const passerSecondTour = useCallback(async (candidats) => {
    try {
      ensureToken();

      if (!Array.isArray(candidats) || candidats.length !== 2) {
        throw new Error('Exactement 2 candidats doivent être qualifiés');
      }

      await googleSheetsService.updateElectionState({
        tourActuel: 2,
        tour1Verrouille: true,
        candidatsQualifies: JSON.stringify(candidats)
      });

      
      // Activation automatique des 2 candidats qualifiés pour le 2nd tour (ActifT2 = TRUE)
      // IMPORTANT :
      // - Les totaux T2 peuvent exister sans "résultats par candidat", mais l'affichage par candidat
      //   dépend du flag ActifT2 dans l'onglet Candidats.
      // - Best effort : ne doit jamais bloquer le passage au 2nd tour le jour J.
      try {
        const sheet = SHEET_NAMES.CANDIDATS;
        const a1 = `${sheet}!A:H`; // A ListeID ... H ActifT2
        const values = await googleSheetsService.getValues(a1);

        if (Array.isArray(values) && values.length >= 2) {
          const header = values[0] || [];
          const rows = values.slice(1);

          // Index de la colonne ActifT2 (fallback H)
          const norm = (v) =>
            String(v ?? '')
              .trim()
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, '')
              .replace(/[^a-z0-9_]/g, '');

          const hmap = {};
          header.forEach((h, i) => {
            const k = norm(h);
            if (k) hmap[k] = i;
          });

          const colListeId = hmap['listeid'] ?? 0;
          const colActifT2 = hmap['actift2'] ?? 7;

          const qualifiedIds = new Set(
            candidats.map((c) => c?.listeId ?? c?.id ?? c).filter(Boolean)
          );

          // Met à jour chaque ligne : ActifT2 TRUE pour les qualifiés, FALSE pour les autres
          for (let i = 0; i < rows.length; i++) {
            const row = Array.isArray(rows[i]) ? rows[i].slice() : [];
            // padding pour garantir la présence de la colonne H
            while (row.length <= colActifT2) row.push('');

            const listeId = row[colListeId];
            const isQualified = qualifiedIds.has(listeId);

            // Valeur attendue par l'app actuelle : 'TRUE'/'FALSE'
            row[colActifT2] = isQualified ? 'TRUE' : 'FALSE';

            // updateRow attend rowIndex 0-based (ligne de données). Il ajoute +2 pour sauter l'en-tête.
            await googleSheetsService.updateRow(sheet, i, row);
          }
        } else {
          console.warn('[PASSAGE T2] Onglet Candidats vide ou illisible : ActifT2 non mis à jour.');
        }
      } catch (e) {
        console.warn('[PASSAGE T2] Mise à jour ActifT2 échouée (best effort):', e);
      }
await auditService.log('PASSAGE_T2', 'ELECTION', 'STATE', {}, {
        candidats: candidats.map(c => c.nom || c.nomListe || c.listeId)
      });

      await loadState();
    } catch (error) {
      console.error('Erreur passage T2:', error);
      throw error;
    }
  }, [loadState]);

  // Verrouiller un tour
  const verrouillerTour = useCallback(async (tour) => {
    try {
      ensureToken();

      const field = tour === 1 ? 'tour1Verrouille' : 'tour2Verrouille';

      await googleSheetsService.updateElectionState({ [field]: true });

      await auditService.log('VERROUILLAGE', 'ELECTION', 'STATE', {}, { tour });

      await loadState();
    } catch (error) {
      console.error('Erreur verrouillage:', error);
      throw error;
    }
  }, [loadState]);

  // Déverrouiller un tour (admin uniquement)
  const deverrouillerTour = useCallback(async (tour) => {
    try {
      ensureToken();

      const field = tour === 1 ? 'tour1Verrouille' : 'tour2Verrouille';

      await googleSheetsService.updateElectionState({ [field]: false });

      await auditService.log('DEVERROUILLAGE', 'ELECTION', 'STATE', {}, { tour });

      await loadState();
    } catch (error) {
      console.error('Erreur déverrouillage:', error);
      throw error;
    }
  }, [loadState]);

  // Charger au montage (si token disponible)
  useEffect(() => {
    if (authService.getAccessToken()) {
      loadState();
    } else {
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [loadState]);

  return {
    state,
    loadState,
    passerSecondTour,
    verrouillerTour,
    deverrouillerTour
  };
};

export default useElectionState;

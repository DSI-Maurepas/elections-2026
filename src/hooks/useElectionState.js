// src/hooks/useElectionState.js
import { useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import googleSheetsService from '../services/googleSheetsService';
import auditService from '../services/auditService';

/**
 * Hook personnalisé pour gérer l'état global de l'élection
 * Gère le tour actuel, le verrouillage, et la synchronisation avec Google Sheets
 */
export const useElectionState = () => {
  const [state, setState] = useState({
    tourActuel: 1, // 1 ou 2
    tour1Verrouille: false,
    tour2Verrouille: false,
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

  // Charger l'état depuis Google Sheets
  const loadState = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      ensureToken();
      const data = await googleSheetsService.getElectionState();

      setState({
        tourActuel: data.tourActuel ?? 1,
        tour1Verrouille: data.tour1Verrouille ?? false,
        tour2Verrouille: data.tour2Verrouille ?? false,
        dateT1: data.dateT1 || '2026-03-15',
        dateT2: data.dateT2 || '2026-03-22',
        candidatsQualifies: Array.isArray(data.candidatsQualifies) ? data.candidatsQualifies : (data.candidatsQualifies ? [data.candidatsQualifies] : []),
        loading: false,
        error: null
      });
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

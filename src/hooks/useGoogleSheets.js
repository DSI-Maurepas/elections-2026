import { useState, useCallback, useEffect, useRef } from 'react';
import googleSheetsService from '../services/googleSheetsService';

/**
 * Hook personnalisé pour simplifier les interactions avec Google Sheets
 * Gère le chargement, les erreurs, et les opérations CRUD
 */
export const useGoogleSheets = (sheetName) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const lastFiltersRef = useRef({});
  const reloadTimerRef = useRef(null);
  const hasLoadedOnceRef = useRef(false);

  // Charger les données
  const load = useCallback(async (filters = {}) => {
    lastFiltersRef.current = filters || {};
    try {
      setLoading(true);
      setError(null);
      
      const result = await googleSheetsService.getData(sheetName, filters);
      setData(result);

      // Marqueur : utile pour auto-load au montage sans provoquer de boucles.
      hasLoadedOnceRef.current = true;
      
      return result;
    } catch (err) {
      console.error(`Erreur chargement ${sheetName}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sheetName]);

  // Auto-chargement au montage (et lors d'un changement de sheetName)
  // IMPORTANT : certaines vues consomment uniquement `data` sans appeler `load()`.
  // La déduplication/caching du service évite les sur-appels en cas de load concurrent.
  useEffect(() => {
    if (!sheetName) return;
    if (hasLoadedOnceRef.current) return;
    load(lastFiltersRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetName, load]);

  // Debounce reload pour éviter de dépasser les quotas Sheets en cas d'enchaînement d'écritures
  const scheduleReload = useCallback(() => {
    if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    reloadTimerRef.current = setTimeout(() => {
      load(lastFiltersRef.current);
    }, 250);
  }, [load]);

  // Écoute un événement global pour rafraîchir les données après une écriture ailleurs
  useEffect(() => {
    const handler = (evt) => {
      const target = evt?.detail?.sheetName;
      if (target && target === sheetName) {
        scheduleReload();
      }
    };
    window.addEventListener('sheets:changed', handler);
    return () => {
      window.removeEventListener('sheets:changed', handler);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, [sheetName, scheduleReload]);


  // Créer une nouvelle ligne
  const create = useCallback(async (rowData) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await googleSheetsService.appendRow(sheetName, rowData);
      
      // Recharger les données
      await load();
      
      return result;
    } catch (err) {
      console.error(`Erreur création ${sheetName}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sheetName, load]);

  // Mettre à jour une ligne
  const update = useCallback(async (rowIndex, rowData) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await googleSheetsService.updateRow(sheetName, rowIndex, rowData);
      
      // Recharger les données
      await load();
      
      return result;
    } catch (err) {
      console.error(`Erreur mise à jour ${sheetName}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sheetName, load]);

  // Supprimer une ligne
  const remove = useCallback(async (rowIndex) => {
    try {
      setLoading(true);
      setError(null);
      
      await googleSheetsService.deleteRow(sheetName, rowIndex);
      
      // Recharger les données
      await load();
    } catch (err) {
      console.error(`Erreur suppression ${sheetName}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sheetName, load]);

  // Créer ou mettre à jour en masse
  const batchUpdate = useCallback(async (rows) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await googleSheetsService.batchUpdate(sheetName, rows);
      
      // Recharger les données
      await load();
      
      return result;
    } catch (err) {
      console.error(`Erreur batch update ${sheetName}:`, err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [sheetName, load]);

  // Rafraîchir les données
  const refresh = useCallback(async () => {
    return load();
  }, [load]);

  // Réinitialiser l'erreur
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    load,
    create,
    update,
    remove,
    batchUpdate,
    refresh,
    clearError
  };
};

export default useGoogleSheets;

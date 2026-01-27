// src/services/googleSheetsService.js
// Service Google Sheets API v4 - Backend unique de l'application
//
// Correctifs (2026-01-27):
// - Utilise values:batchGet (query param) au lieu de /values/{range} (path) pour éviter les erreurs 400
//   "Unable to parse range" liées à l'encodage (accents, quotes, caractères spéciaux).
// - Encodage A1 robuste: 'NomOnglet'!A:Z
// - Retry/backoff sur 429 + déduplication des requêtes en vol + cache TTL court.
// - Méthodes génériques attendues par useGoogleSheets(): getData/appendRow/updateRow/deleteRow.
//
// NB: OAuth Bearer token requis. Pas de clé API nécessaire.

import authService from './authService';
import { SHEET_NAMES } from '../utils/constants';

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID;
    this.apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets';

    this._inflight = new Map(); // key -> Promise
    this._cache = new Map();    // key -> { at, data }
    this._cacheTtlMs = 800;     // cache court (ms)
  }

  // ==================== HELPERS ====================

  colIndexToA1(colIndex) {
    let n = colIndex + 1;
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  parseSheetValue(value) {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'string') return value;

    const v = value.trim();
    if (v === 'TRUE') return true;
    if (v === 'FALSE') return false;

    if (v !== '' && !Number.isNaN(Number(v))) return Number(v);

    if ((v.startsWith('[') && v.endsWith(']')) || (v.startsWith('{') && v.endsWith('}'))) {
      try { return JSON.parse(v); } catch (_) { return value; }
    }
    return value;
  }

  /**
   * Construit une notation A1 robuste:
   * - entoure toujours le nom d'onglet de quotes simples (support espaces/accents)
   * - échappe les quotes simples selon la règle Google Sheets ('' )
   */
  a1(sheetName, range = 'A:Z') {
    const safe = String(this.normalizeSheetName(sheetName) || '').replace(/'/g, "''");
    return `'${safe}'!${range}`;
  }

  
  /**
   * Normalise les noms d'onglets pour éviter les régressions (accents/variantes).
   * Ex: "Résultats_T1" -> "Resultats_T1"
   */
  normalizeSheetName(sheetName) {
    const raw = String(sheetName || '').trim();
    if (!raw) return raw;

    // 1) Normalisation unicode (suppression des accents)
    const noAccents = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // 2) Corrections ciblées (au cas où)
    const mapped = noAccents
      .replace(/^Resultats_/i, 'Resultats_')
      .replace(/^Participation_/i, 'Participation_');

    return mapped;
  }

async sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== CORE ====================

  async makeRequest(endpoint, options = {}, retry = 0) {
    if (!this.spreadsheetId) {
      throw new Error('Configuration manquante: VITE_SPREADSHEET_ID non défini');
    }

    try {
      await authService.refreshTokenIfNeeded?.();
    } catch (e) {
      console.warn('Avertissement: refreshTokenIfNeeded a échoué:', e);
    }

    const token = authService.getAccessToken?.();
    if (!token) {
      throw new Error('Non authentifié - Token manquant');
    }

    const url = `${this.apiUrl}/${this.spreadsheetId}${endpoint}`;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });

    // Retry quota 429
    if (response.status === 429 && retry < 3) {
      const retryAfter = response.headers.get('retry-after');
      const waitMs = retryAfter ? (parseInt(retryAfter, 10) * 1000) : (300 * (2 ** retry));
      await this.sleep(waitMs);
      return this.makeRequest(endpoint, options, retry + 1);
    }

    if (!response.ok) {
      let message = 'Erreur API Google Sheets';
      try {
        const errJson = await response.json();
        message = errJson?.error?.message || message;
      } catch (_) {
        try {
          const text = await response.text();
          if (text) message = text;
        } catch (_) {}
      }
      const error = new Error(`${message} (HTTP ${response.status})`);
      error.status = response.status;
      throw error;
    }

    if (response.status === 204) return null;
    return await response.json();
  }

  // ==================== DÉDUP & CACHE ====================

  _getCached(key) {
    const hit = this._cache.get(key);
    if (!hit) return null;
    if ((Date.now() - hit.at) > this._cacheTtlMs) {
      this._cache.delete(key);
      return null;
    }
    return hit.data;
  }

  _setCached(key, data) {
    this._cache.set(key, { at: Date.now(), data });
  }

  async _dedup(key, fn) {
    const inflight = this._inflight.get(key);
    if (inflight) return inflight;

    const p = (async () => {
      try {
        return await fn();
      } finally {
        this._inflight.delete(key);
      }
    })();

    this._inflight.set(key, p);
    return p;
  }

  // ==================== VALUES HELPERS ====================
  // Utilise batchGet pour éviter les soucis d'encodage du paramètre {range} dans l'URL path.
  async getValues(a1Range) {
    const endpoint = `/values:batchGet?ranges=${encodeURIComponent(a1Range)}`;
    const res = await this.makeRequest(endpoint);
    const vr = res?.valueRanges?.[0];
    return vr?.values || [];
  }

  // ==================== API GÉNÉRIQUE (attendue par useGoogleSheets) ====================

  /**
   * Transforme les lignes brutes en objets selon la structure de la feuille
   */
  _transformRows(sheetName, rows) {
    if (!rows || rows.length === 0) return [];

    switch (sheetName) {
      case 'Bureaux':
        return rows.map(row => ({
          id: row[0] || '',
          nom: row[1] || '',
          adresse: row[2] || '',
          president: row[3] || '',
          secretaire: row[4] || '',
          secretaireSuppleant: row[5] || '',
          inscrits: parseInt(row[6]) || 0,
          actif: row[7] === 'TRUE' || row[7] === true
        }));

      case 'Candidats':
        return rows.map(row => ({
          listeId: row[0] || '',
          nomListe: row[1] || '',
          teteListeNom: row[2] || '',
          teteListePrenom: row[3] || '',
          couleur: row[4] || '#0055A4',
          ordre: parseInt(row[5]) || 0,
          actifT1: row[6] === 'TRUE' || row[6] === true,
          actifT2: row[7] === 'TRUE' || row[7] === true
        }));

      case 'Participation_T1':
      case 'Participation_T2':
        return rows.map(row => ({
          bureauId: row[0] || '',
          tour: parseInt(row[1]) || 1,
          inscrits: parseInt(row[2]) || 0,
          votants08h: parseInt(row[3]) || 0,
          votants09h: parseInt(row[4]) || 0,
          votants10h: parseInt(row[5]) || 0,
          votants11h: parseInt(row[6]) || 0,
          votants12h: parseInt(row[7]) || 0,
          votants13h: parseInt(row[8]) || 0,
          votants14h: parseInt(row[9]) || 0,
          votants15h: parseInt(row[10]) || 0,
          votants16h: parseInt(row[11]) || 0,
          votants17h: parseInt(row[12]) || 0,
          votants18h: parseInt(row[13]) || 0,
          votants19h: parseInt(row[14]) || 0,
          votants20h: parseInt(row[15]) || 0,
          timestamp: row[16] || ''
        }));

      case 'Resultats_T1':
      case 'Resultats_T2':
        return rows.map(row => ({
          bureauId: row[0] || '',
          votants: parseInt(row[1]) || 0,
          blancs: parseInt(row[2]) || 0,
          nuls: parseInt(row[3]) || 0,
          exprimes: parseInt(row[4]) || 0,
          voix: row[5] ? JSON.parse(row[5]) : {},
          timestamp: row[6] || ''
        }));

      default:
        // Par défaut, retourner les lignes brutes
        return rows;
    }
  }

  async getData(sheetName, filters = {}) {
    const normalizedSheet = this.normalizeSheetName(sheetName);
    const range = filters?.range || 'A:Z';
    const a1 = this.a1(normalizedSheet, range);
    const key = `getData:${normalizedSheet}:${a1}`;
    const cached = this._getCached(key);
    if (cached) return cached;

    return await this._dedup(key, async () => {
      const values = await this.getValues(a1);
      const rows = values.slice();
      if (rows.length > 0) rows.shift(); // remove header
      
      // Transformer les lignes en objets selon le sheetName
      const transformed = this._transformRows(normalizedSheet, rows);
      
      // IMPORTANT : Ajouter rowIndex à chaque objet pour permettre update/delete
      const withRowIndex = transformed.map((obj, index) => ({
        ...obj,
        rowIndex: index
      }));
      
      this._setCached(key, withRowIndex);
      return withRowIndex;
    });
  }

  async appendRow(sheetName, rowData) {
    const row = Array.isArray(rowData) ? rowData : Object.values(rowData || {});
    return await this.appendRows(sheetName, [row]);
  }

  async updateRow(sheetName, rowIndex, rowData) {
    const normalizedSheet = this.normalizeSheetName(sheetName);
    const row = Array.isArray(rowData) ? rowData : Object.values(rowData || {});
    const sheetRow = Number(rowIndex) + 2;
    const lastCol = this.colIndexToA1(Math.max(0, row.length - 1));
    const a1 = this.a1(normalizedSheet, `A${sheetRow}:${lastCol}${sheetRow}`);

    // cache invalidation simple
    this._cache.clear();

    return await this.makeRequest(`/values/${encodeURIComponent(a1)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [row] }),
    });
  }

  async deleteRow(sheetName, rowIndex) {
    const normalizedSheet = this.normalizeSheetName(sheetName);
    const sheetRow = Number(rowIndex) + 2;
    const a1 = this.a1(normalizedSheet, `A${sheetRow}:Z${sheetRow}`);

    this._cache.clear();

    return await this.makeRequest(`/values/${encodeURIComponent(a1)}:clear`, { method: 'POST' });
  }

  async batchUpdate(arg1, arg2) {
    if (Array.isArray(arg1) && arg2 === undefined) {
      const updates = arg1;
      const data = updates.map((u) => ({ range: u.range, values: u.values }));
      this._cache.clear();
      return await this.makeRequest('/values:batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
      });
    }

    const sheetName = this.normalizeSheetName(arg1);
    const rows = Array.isArray(arg2) ? arg2 : [];
    const updates = rows.map((r) => {
      const rowIndex = r.rowIndex ?? r.index ?? 0;
      const rowData = r.rowData ?? r.data ?? [];
      const row = Array.isArray(rowData) ? rowData : Object.values(rowData || {});
      const sheetRow = Number(rowIndex) + 2;
      const lastCol = this.colIndexToA1(Math.max(0, row.length - 1));
      const rangeA1 = this.a1(sheetName, `A${sheetRow}:${lastCol}${sheetRow}`);
      return { range: rangeA1, values: [row] };
    });

    return await this.batchUpdate(updates);
  }

  // ==================== CONFIG ====================

  async getConfig() {
    const a1 = this.a1(SHEET_NAMES.CONFIG, 'A:B');
    const key = `getConfig:${a1}`;
    const cached = this._getCached(key);
    if (cached) return cached;

    return await this._dedup(key, async () => {
      const values = await this.getValues(a1);
      const config = {};
      values.forEach(([k, v]) => { if (k) config[k] = this.parseSheetValue(v); });
      this._setCached(key, config);
      return config;
    });
  }

  // ==================== STATE ====================

  async getElectionState() {
    const a1 = this.a1(SHEET_NAMES.ELECTIONS_STATE, 'A:C');
    const key = `getElectionState:${a1}`;
    const cached = this._getCached(key);
    if (cached) return cached;

    return await this._dedup(key, async () => {
      const values = await this.getValues(a1);
      const rows = values.slice();
      if (rows.length > 0 && String(rows[0][0]).toLowerCase().includes('key')) rows.shift();

      const state = {};
      rows.forEach(([k, v]) => { if (k) state[k] = this.parseSheetValue(v); });

      this._setCached(key, state);
      return state;
    });
  }

  async updateElectionState(keyOrObject, value) {
    if (keyOrObject && typeof keyOrObject === 'object' && !Array.isArray(keyOrObject)) {
      for (const [k, v] of Object.entries(keyOrObject)) {
        await this.updateElectionState(k, v);
      }
      return;
    }

    const key = keyOrObject;
    const a1 = this.a1(SHEET_NAMES.ELECTIONS_STATE, 'A:C');
    const values = await this.getValues(a1);

    const startIndex = (values.length > 0 && String(values[0][0]).toLowerCase().includes('key')) ? 1 : 0;
    const rowIndex = values.slice(startIndex).findIndex(([k]) => k === key);
    const timestamp = new Date().toISOString();

    this._cache.clear();

    if (rowIndex === -1) {
      return await this.appendRows(SHEET_NAMES.ELECTIONS_STATE, [[key, value, timestamp]]);
    }

    const absoluteRow = rowIndex + startIndex + 1;
    const updateA1 = this.a1(SHEET_NAMES.ELECTIONS_STATE, `B${absoluteRow}:C${absoluteRow}`);

    return await this.makeRequest(`/values/${encodeURIComponent(updateA1)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [[value, timestamp]] }),
    });
  }

  
  // ==================== AUDIT / ERREURS ====================

  /**
   * Journalise une action métier dans la feuille AUDIT_LOG.
   * Colonnes attendues (ordre):
   * timestamp | action | entity | entityId | beforeJson | afterJson | userEmail (optionnel)
   */
  async logAudit(action, entity, entityId, before = {}, after = {}) {
    const ts = new Date().toISOString();
    const beforeJson = JSON.stringify(before ?? {});
    const afterJson = JSON.stringify(after ?? {});
    const userEmail = (authService.getUserEmail?.() || authService.getUser?.()?.email || '') || '';

    return await this.appendRows(SHEET_NAMES.AUDIT_LOG, [[
      ts,
      action || '',
      entity || '',
      entityId || '',
      beforeJson,
      afterJson,
      userEmail
    ]]);
  }

  /**
   * Journalise une erreur technique/fonctionnelle dans la feuille ERROR_LOG.
   * Colonnes attendues (ordre):
   * timestamp | severity | source | message | stack | contextJson | userEmail (optionnel)
   */
  async logError(severity, source, message, stack = '', context = {}) {
    const ts = new Date().toISOString();
    const contextJson = JSON.stringify(context ?? {});
    const userEmail = (authService.getUserEmail?.() || authService.getUser?.()?.email || '') || '';

    return await this.appendRows(SHEET_NAMES.ERROR_LOG, [[
      ts,
      severity || 'ERROR',
      source || '',
      message || '',
      stack || '',
      contextJson,
      userEmail
    ]]);
  }


// ==================== UTILITAIRES ====================

  async appendRows(sheetName, rows) {
    const normalizedSheet = this.normalizeSheetName(sheetName);
    const a1 = this.a1(normalizedSheet, 'A:Z');
    this._cache.clear();

    // ici on garde /values/{range}:append (fonctionne bien car range simple A:Z, même si onglet accentué)
    return await this.makeRequest(
      `/values/${encodeURIComponent(a1)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: rows }) }
    );
  }

  async clearSheet(sheetName) {
    const normalizedSheet = this.normalizeSheetName(sheetName);
    const a1 = this.a1(normalizedSheet, 'A:Z');
    this._cache.clear();
    return await this.makeRequest(`/values/${encodeURIComponent(a1)}:clear`, { method: 'POST' });
  }
}

export default new GoogleSheetsService();

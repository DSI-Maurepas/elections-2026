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
  _transformRows(sheetName, rows, header = []) {
    if (!rows || rows.length === 0) return [];

    // Header-driven mapping (robuste aux décalages de colonnes)
    const _norm = (s) => String(s ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9_]/g, '');

    const _h = Array.isArray(header) ? header : [];
    const _hmap = {};
    _h.forEach((h, i) => {
      const k = _norm(h);
      if (k) _hmap[k] = i;
    });

    const _idx = (key, fallback) => {
      const k = _norm(key);
      return (k && _hmap[k] !== undefined) ? _hmap[k] : fallback;
    };

    const _str = (row, key, fallback, def = '') => {
      const i = _idx(key, fallback);
      const v = (i !== undefined && i !== null) ? row[i] : undefined;
      return (v === undefined || v === null) ? def : String(v);
    };

    const _int = (row, key, fallback, def = 0) => {
      const i = _idx(key, fallback);
      const v = (i !== undefined && i !== null) ? row[i] : undefined;
      const n = parseInt(v, 10);
      return Number.isFinite(n) ? n : def;
    };

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

      case 'Candidats': {
        // Mapping robuste des candidats :
        // - Priorité au mapping par en-têtes (évite les décalages si une colonne est ajoutée/déplacée)
        // - Fallback sur positions historiques si les en-têtes sont absents
        const norm = (v) => String(v ?? '').trim().toLowerCase();
        const idx = (...names) => {
          for (const n of names) {
            const i = header.findIndex((h) => norm(h) === norm(n));
            if (i !== -1) return i;
          }
          return -1;
        };

        const toBool = (v) => {
          if (v === true) return true;
          if (v === false) return false;
          if (typeof v === 'number') return v === 1;
          const s = norm(v);
          return s === 'true' || s === 'vrai' || s === 'oui' || s === '1' || s === 'x' || s === 'yes';
        };

        const iListeId = idx('listeid', 'id', 'listid', 'liste_id');
        const iNomListe = idx('nomliste', 'liste', 'nom_liste', 'nom');
        const iTeteNom = idx('tetelistenom', 'tete_nom', 'nom_tete', 'tetenom');
        const iTetePrenom = idx('tetelisteprenom', 'tete_prenom', 'prenom_tete', 'tetepprenom');
        const iCouleur = idx('couleur', 'color');
        const iOrdre = idx('ordre', 'order', 'rang');
        const iActifT1 = idx('actift1', 'actif_t1', 't1', 'tour1');
        const iActifT2 = idx('actift2', 'actif_t2', 't2', 'tour2');

        return rows.map((row) => {
          const get = (i, fallbackIndex, fallback = '') =>
            (i >= 0 ? row[i] : row[fallbackIndex]) ?? fallback;

          return {
            listeId: get(iListeId, 0, '') || '',
            nomListe: get(iNomListe, 1, '') || '',
            teteListeNom: get(iTeteNom, 2, '') || '',
            teteListePrenom: get(iTetePrenom, 3, '') || '',
            couleur: get(iCouleur, 4, '#0055A4') || '#0055A4',
            ordre: parseInt(get(iOrdre, 5, 0), 10) || 0,
            actifT1: toBool(get(iActifT1, 6, false)),
            actifT2: toBool(get(iActifT2, 7, false)),
          };
        });
      }case 'Participation_T1':
      case 'Participation_T2':
        // Mapping par en-têtes (évite les décalages quand une colonne est ajoutée/supprimée)
        // Colonnes attendues (Google Sheets) :
        // A BureauID | B Tour | C Inscrits | D Votants09h | ... | O Votants20h | P Timestamp (optionnel)
        return rows.map(row => ({
          bureauId: _str(row, 'BureauID', 0, ''),
          tour: _int(row, 'Tour', 1, 1) || 1,
          inscrits: _int(row, 'Inscrits', 2, 0),

          // ⚠️ 08h supprimé : la première heure officielle est 09h
          votants09h: _int(row, 'Votants09h', 3, 0),
          votants10h: _int(row, 'Votants10h', 4, 0),
          votants11h: _int(row, 'Votants11h', 5, 0),
          votants12h: _int(row, 'Votants12h', 6, 0),
          votants13h: _int(row, 'Votants13h', 7, 0),
          votants14h: _int(row, 'Votants14h', 8, 0),
          votants15h: _int(row, 'Votants15h', 9, 0),
          votants16h: _int(row, 'Votants16h', 10, 0),
          votants17h: _int(row, 'Votants17h', 11, 0),
          votants18h: _int(row, 'Votants18h', 12, 0),
          votants19h: _int(row, 'Votants19h', 13, 0),
          votants20h: _int(row, 'Votants20h', 14, 0),

          // Timestamp éventuel (si présent)
          timestamp: _str(row, 'Timestamp', 15, '')
        }));

      case 'Resultats_T1':
      case 'Resultats_T2':
        // Colonnes attendues (Google Sheets):
        // A BureauID | B Inscrits | C Votants | D Blancs | E Nuls | F Exprimes | G..K L1_Voix..L5_Voix | L SaisiPar | M ValidePar | N Timestamp
        return rows.map(row => {
          const voix = {
            L1: parseInt(row[6]) || 0,
            L2: parseInt(row[7]) || 0,
            L3: parseInt(row[8]) || 0,
            L4: parseInt(row[9]) || 0,
            L5: parseInt(row[10]) || 0,
          };

          return {
            bureauId: row[0] || '',
            inscrits: parseInt(row[1]) || 0,
            votants: parseInt(row[2]) || 0,
            blancs: parseInt(row[3]) || 0,
            nuls: parseInt(row[4]) || 0,
            exprimes: parseInt(row[5]) || 0,
            voix,
            saisiPar: row[11] || '',
            validePar: row[12] || '',
            timestamp: row[13] || ''
          };
        });
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
      const header = rows.length > 0 ? rows[0] : [];
      if (rows.length > 0) rows.shift(); // remove header
      
      // Transformer les lignes en objets selon le sheetName
      const transformed = this._transformRows(normalizedSheet, rows, header);
      
      // IMPORTANT : Ajouter rowIndex à chaque objet pour permettre update/delete
      const withRowIndex = transformed.map((obj, index) => ({
        ...obj,
        rowIndex: index
      }));
      
      this._setCached(key, withRowIndex);
      return withRowIndex;
    });
  }


  /**
   * Convertit un objet métier en ligne (Array) dans l'ordre exact des colonnes Google Sheets.
   * IMPORTANT : évite les régressions liées à Object.values() (ordre non garanti / champs manquants).
   */
  _toRow(sheetName, rowData) {
    if (Array.isArray(rowData)) return rowData;
    const obj = rowData || {};

    switch (sheetName) {
      case 'Resultats_T1':
      case 'Resultats_T2': {
        const voix = obj.voix || {};
        // Supporte soit des clés "L1..L5", soit des ids candidats (ex: 'L1') identiques
        const l1 = parseInt(voix.L1 ?? voix['L1'] ?? obj.L1_Voix ?? obj.L1 ?? 0) || 0;
        const l2 = parseInt(voix.L2 ?? voix['L2'] ?? obj.L2_Voix ?? obj.L2 ?? 0) || 0;
        const l3 = parseInt(voix.L3 ?? voix['L3'] ?? obj.L3_Voix ?? obj.L3 ?? 0) || 0;
        const l4 = parseInt(voix.L4 ?? voix['L4'] ?? obj.L4_Voix ?? obj.L4 ?? 0) || 0;
        const l5 = parseInt(voix.L5 ?? voix['L5'] ?? obj.L5_Voix ?? obj.L5 ?? 0) || 0;

        return [
          obj.bureauId ?? '',                 // A BureauID
          parseInt(obj.inscrits) || 0,         // B Inscrits
          parseInt(obj.votants) || 0,          // C Votants
          parseInt(obj.blancs) || 0,           // D Blancs
          parseInt(obj.nuls) || 0,             // E Nuls
          parseInt(obj.exprimes) || 0,          // F Exprimes
          l1,                                  // G L1_Voix
          l2,                                  // H L2_Voix
          l3,                                  // I L3_Voix
          l4,                                  // J L4_Voix
          l5,                                  // K L5_Voix
          obj.saisiPar ?? '',                  // L SaisiPar
          obj.validePar ?? '',                 // M ValidePar
          obj.timestamp ?? ''                  // N Timestamp
        ];
      }
      case 'Participation_T1':
      case 'Participation_T2':
        // Ordre exact des colonnes Google Sheets (08h supprimé)
        // A BureauID | B Tour | C Inscrits | D Votants09h ... | O Votants20h | P Timestamp (optionnel)
        return [
          obj.bureauId ?? '',                 // A BureauID
          parseInt(obj.tour) || 1,            // B Tour
          parseInt(obj.inscrits) || 0,        // C Inscrits
          parseInt(obj.votants09h) || 0,      // D
          parseInt(obj.votants10h) || 0,      // E
          parseInt(obj.votants11h) || 0,      // F
          parseInt(obj.votants12h) || 0,      // G
          parseInt(obj.votants13h) || 0,      // H
          parseInt(obj.votants14h) || 0,      // I
          parseInt(obj.votants15h) || 0,      // J
          parseInt(obj.votants16h) || 0,      // K
          parseInt(obj.votants17h) || 0,      // L
          parseInt(obj.votants18h) || 0,      // M
          parseInt(obj.votants19h) || 0,      // N
          parseInt(obj.votants20h) || 0,      // O
          obj.timestamp ?? ''                 // P Timestamp (optionnel)
        ];

      default:
        return Object.values(obj);
    }
  }

  async appendRow(sheetName, rowData) {
    const normalizedSheet = this.normalizeSheetName(sheetName);
    const row = this._toRow(sheetName, rowData);
    return await this.appendRows(normalizedSheet, [row]);
  }

  async updateRow(sheetName, rowIndex, rowData) {
    const normalizedSheet = this.normalizeSheetName(sheetName);
    const row = this._toRow(sheetName, rowData);
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
      const row = this._toRow(sheetName, rowData);
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

    const normalizeCell = (v) => {
      if (v === null || v === undefined) return "";
      if (typeof v === "object") {
        try { return JSON.stringify(v); } catch { return String(v); }
      }
      return v;
    };
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


  /**
   * Purge partielle du journal d'audit (feuille AUDIT_LOG) par tour.
   * - Conserve la ligne d'en-tête si détectée
   * - Supprime les lignes identifiées comme liées au tour demandé (T1/T2)
   *
   * Heuristique (robuste aux formats historiques) :
   * - Format "logAudit" : [ts, action, entity, entityId, ...]
   * - Format "AuditService.log" : [ts, user, action, detailsJson] avec detailsJson contenant {entity, entityId, ...}
   */
  async purgeAuditLogByTour(tour = 1) {
    const sheetName = (SHEET_NAMES && SHEET_NAMES.AUDIT_LOG) ? SHEET_NAMES.AUDIT_LOG : 'AuditLog';
    const a1 = this.a1(sheetName, 'A:Z');

    const values = await this.getValues(a1);
    if (!Array.isArray(values) || values.length === 0) {
      return { removed: 0, kept: 0 };
    }

    const norm = (v) => String(v ?? '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();

    const safeStringify = (v) => {
      try {
        if (typeof v === 'string') return v;
        return JSON.stringify(v);
      } catch (_) {
        try { return String(v); } catch { return ''; }
      }
    };

    const headerCandidate = values[0] || [];
    const headerJoined = norm(headerCandidate.join(' '));
    const hasHeader =
      headerJoined.includes('timestamp') ||
      headerJoined.includes('date') ||
      headerJoined.includes('action') ||
      headerJoined.includes('utilisateur') ||
      headerJoined.includes('user');

    const header = hasHeader ? values[0] : null;
    const dataRows = values.slice(hasHeader ? 1 : 0);

    const reT = (tour === 2)
      ? /(^|[^a-z0-9])t2([^a-z0-9]|$)/
      : /(^|[^a-z0-9])t1([^a-z0-9]|$)/;

    const reTourWord = (tour === 2) ? /tour2/ : /tour1/;

    const isMatch = (row) => {
      if (!Array.isArray(row)) return false;

      // Format long (logAudit): entity/entityId en colonnes C/D
      let entity = '';
      let entityId = '';
      let detailsStr = '';

      if (row.length >= 7) {
        entity = row[2] ?? '';
        entityId = row[3] ?? '';
        detailsStr = `${row[4] ?? ''} ${row[5] ?? ''}`.trim();
      } else if (row.length >= 4) {
        // Format court (AuditService.log): details JSON en colonne D
        detailsStr = row[3] ?? '';
      }

      // Si details est un JSON (cas format court), tenter d'extraire entity/entityId
      const det = String(detailsStr ?? '').trim();
      if (det && (det.startsWith('{') || det.startsWith('['))) {
        try {
          const obj = JSON.parse(det);
          entity = entity || (obj?.entity ?? obj?.sheet ?? '');
          entityId = entityId || (obj?.entityId ?? obj?.id ?? '');
          detailsStr = safeStringify(obj);
        } catch (_) {
          // ignore
        }
      }

      const hay = `${norm(entity)} ${norm(entityId)} ${norm(detailsStr)}`;

      return reT.test(hay) || reTourWord.test(hay);
    };

    const kept = [];
    let removed = 0;

    for (const row of dataRows) {
      if (isMatch(row)) removed += 1;
      else kept.push(row);
    }

    // Réécriture (clear + append) pour éviter la suppression ligne par ligne
    await this.clearSheet(sheetName);

    const out = [];
    if (header) out.push(header);
    out.push(...kept);

    if (out.length > 0) {
      await this.appendRows(sheetName, out);
    }

    // Invalidation caches + broadcast
    this._cache.clear();
    try {
      window.dispatchEvent(new CustomEvent('sheets:changed', { detail: { sheetName } }));
    } catch (_) {}

    return { removed, kept: kept.length };
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

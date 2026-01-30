// src/services/auditService.js
// Service d'audit applicatif (Google Sheets)
//
// Contraintes non-régressives :
// - NE JAMAIS envoyer d'objets JS directement dans values[][] (Sheets API n'accepte que primitives)
// - sérialiser systématiquement les payloads complexes en JSON string
// - fournir les fonctions attendues par l'app (ex: setupGlobalErrorHandler)
//
// Dépendances:
// - googleSheetsService.appendRow(...) pour AuditLog
// - googleSheetsService.logError(...) (si disponible) pour ErrorLog

import authService from './authService';
import googleSheetsService from './googleSheetsService';

const AUDIT_SHEET = 'AuditLog';

function safeJsonStringify(value) {
  if (value === null || value === undefined) return '';
  try {
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  } catch (e) {
    try {
      return String(value);
    } catch (_) {
      return '[détails non sérialisables]';
    }
  }
}

function getUserLabel() {
  const email = authService.getUserEmail?.() || authService.getUser?.()?.email || '';
  if (email) return email;
  const name = authService.getUser?.()?.name || authService.getUser?.()?.displayName || '';
  return name || 'admin';
}

function normalizeError(errLike) {
  if (!errLike) return { message: 'Erreur inconnue', stack: '' };

  if (errLike instanceof Error) {
    return { message: errLike.message || 'Erreur', stack: errLike.stack || '' };
  }

  if (typeof errLike === 'string') return { message: errLike, stack: '' };

  // cas unhandledrejection: evt.reason
  try {
    const msg = errLike.message || safeJsonStringify(errLike) || 'Erreur';
    const stack = errLike.stack || '';
    return { message: msg, stack };
  } catch (_) {
    return { message: 'Erreur', stack: '' };
  }
}

class AuditService {
  constructor() {
    this._globalHandlerInstalled = false;
  }

  /**
   * Ajoute une ligne dans la feuille AuditLog.
   * Colonnes attendues (recommandé):
   * A timestamp | B user | C action | D details
   */
  async log(action, details = {}) {
    const ts = new Date().toISOString();
    const user = getUserLabel();
    const detailsJson = safeJsonStringify(details);

    // IMPORTANT : on passe un ARRAY pour garantir l'ordre des colonnes
    return await googleSheetsService.appendRow(AUDIT_SHEET, [ts, user, action || '', detailsJson]);
  }

  /**
   * Journalise une erreur dans la feuille ERROR_LOG via googleSheetsService.logError (si dispo).
   * Ne doit jamais faire planter l'app.
   */
  async logError(severity, source, errLike, context = {}) {
    try {
      const { message, stack } = normalizeError(errLike);
      const ctxJson = safeJsonStringify(context);

      if (typeof googleSheetsService.logError === 'function') {
        // logError gère déjà la sérialisation du context
        return await googleSheetsService.logError(severity || 'ERROR', source || 'APP', message, stack, context);
      }

      // Fallback : écrire dans AuditLog si ErrorLog indisponible
      return await this.log('ERROR', {
        severity: severity || 'ERROR',
        source: source || 'APP',
        message,
        stack,
        context: ctxJson,
      });
    } catch (e) {
      // Silence: l'audit ne doit jamais bloquer l'appli
      console.warn('AuditService.logError failed:', e);
      return null;
    }
  }

  /**
   * Installe les handlers globaux (window.onerror + unhandledrejection).
   * Cette méthode est attendue par main.jsx.
   */
  setupGlobalErrorHandler() {
    if (this._globalHandlerInstalled) return;
    this._globalHandlerInstalled = true;

    // Errors JS non catchées
    window.addEventListener('error', (evt) => {
      try {
        const err = evt?.error || evt?.message || 'Erreur JS';
        this.logError('ERROR', 'window.error', err, {
          filename: evt?.filename || '',
          lineno: evt?.lineno || null,
          colno: evt?.colno || null,
        });
      } catch (e) {
        console.warn('Global error handler failed:', e);
      }
    });

    // Promesses rejetées non catchées
    window.addEventListener('unhandledrejection', (evt) => {
      try {
        const reason = evt?.reason || 'Unhandled rejection';
        this.logError('ERROR', 'unhandledrejection', reason, {});
      } catch (e) {
        console.warn('Unhandled rejection handler failed:', e);
      }
    });
  }
}

export default new AuditService();

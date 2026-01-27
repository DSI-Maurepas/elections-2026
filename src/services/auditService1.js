// src/services/auditService.js
// Service de traçabilité et d'audit

import googleSheetsService from './googleSheetsService';
import { ACTIONS_AUDIT, SEVERITY_LEVELS } from '../utils/constants';

class AuditService {
  /**
   * Enregistre une action dans le journal d'audit
   */
  async log(action, entity, entityId, before = {}, after = {}) {
    try {
      await googleSheetsService.logAudit(action, entity, entityId, before, after);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement dans l\'audit:', error);
      // Ne pas propager l'erreur pour ne pas bloquer l'action principale
    }
  }

  /**
   * Enregistre une erreur dans le journal d'erreurs
   */
  async logError(severity, source, message, stack = '', context = {}) {
    try {
      await googleSheetsService.logError(severity, source, message, stack, context);
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de l\'erreur:', error);
    }
  }

  /**
   * Wrappers pour les différents types d'actions
   */
  async logCreate(entity, entityId, data) {
    return this.log(ACTIONS_AUDIT.CREATE, entity, entityId, {}, data);
  }

  async logUpdate(entity, entityId, before, after) {
    return this.log(ACTIONS_AUDIT.UPDATE, entity, entityId, before, after);
  }

  async logDelete(entity, entityId, data) {
    return this.log(ACTIONS_AUDIT.DELETE, entity, entityId, data, {});
  }

  async logValidate(entity, entityId, data) {
    return this.log(ACTIONS_AUDIT.VALIDATE, entity, entityId, {}, data);
  }

  async logCalculate(entity, entityId, result) {
    return this.log(ACTIONS_AUDIT.CALCULATE, entity, entityId, {}, result);
  }

  async logConfig(entity, entityId, before, after) {
    return this.log(ACTIONS_AUDIT.CONFIG, entity, entityId, before, after);
  }

  async logExport(entity, format, metadata) {
    return this.log(ACTIONS_AUDIT.EXPORT, entity, format, {}, metadata);
  }

  /**
   * Wrappers pour les différents niveaux de sévérité
   */
  async logInfo(source, message, context = {}) {
    return this.logError(SEVERITY_LEVELS.INFO, source, message, '', context);
  }

  async logWarning(source, message, context = {}) {
    return this.logError(SEVERITY_LEVELS.WARNING, source, message, '', context);
  }

  async logCritical(source, message, stack, context = {}) {
    return this.logError(SEVERITY_LEVELS.CRITICAL, source, message, stack, context);
  }

  /**
   * Intercepteur d'erreurs global
   */
  setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
      this.logError(
        SEVERITY_LEVELS.ERROR,
        'GlobalErrorHandler',
        event.message,
        event.error?.stack || '',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      );
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.logError(
        SEVERITY_LEVELS.ERROR,
        'UnhandledPromiseRejection',
        event.reason?.message || String(event.reason),
        event.reason?.stack || '',
        { promise: String(event.promise) }
      );
    });
  }
}

export default new AuditService();

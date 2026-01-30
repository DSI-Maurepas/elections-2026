import React, { useEffect, useMemo } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Parsing robuste des timestamps issus de Google Sheets.
 * Objectif: ne JAMAIS afficher "Invalid Date" et ne JAMAIS casser le rendu.
 *
 * Formats supportés :
 * - number (ms ou s)
 * - string numérique
 * - ISO (2026-01-30T12:34:56.000Z)
 * - FR: dd/mm/yyyy[ hh:mm[:ss]]
 */
function parseTimestampToDate(value) {
  if (value === null || value === undefined || value === '') return null;

  // Déjà un Date valide ?
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  // Nombre / string numérique: timestamp en ms ou en s
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value.trim()))) {
    const n = typeof value === 'number' ? value : Number(value.trim());
    if (!Number.isFinite(n)) return null;
    const ms = n < 1e12 ? n * 1000 : n; // heuristique: <1e12 => secondes
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;

    // ISO / RFC -> Date sait généralement parser
    const isoTry = new Date(s);
    if (!Number.isNaN(isoTry.getTime())) return isoTry;

    // FR dd/mm/yyyy[ hh:mm[:ss]]
    const m = s.match(/^([0-3]?\d)\/([01]?\d)\/(\d{4})(?:\s+([0-2]?\d):([0-5]\d)(?::([0-5]\d))?)?$/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = Number(m[3]);
      const hh = m[4] !== undefined ? Number(m[4]) : 0;
      const mm = m[5] !== undefined ? Number(m[5]) : 0;
      const ss = m[6] !== undefined ? Number(m[6]) : 0;

      // Date locale (pas UTC) : cohérent avec toLocaleString('fr-FR')
      const d = new Date(year, month - 1, day, hh, mm, ss);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

function safeJson(value) {
  if (value === null || value === undefined) return '';
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch (e) {
    return '[détails non sérialisables]';
  }
}

const AuditLog = () => {
  const { data: logs, load, loading } = useGoogleSheets('AuditLog');

  useEffect(() => {
    load?.();
  }, [load]);

  const sortedLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    // copie + reverse (du plus récent au plus ancien)
    return logs.slice().reverse();
  }, [logs]);

  return (
    <div className="audit-log">
      <h3>📝 Journal d'audit</h3>

      {loading ? (
        <p>Chargement...</p>
      ) : sortedLogs.length === 0 ? (
        <p style={{ opacity: 0.8 }}>
          Aucun événement d&apos;audit n&apos;est disponible (feuille vide ou non alimentée).
        </p>
      ) : (
        <div className="audit-table-container">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Date/Heure</th>
                <th>Utilisateur</th>
                <th>Action</th>
                <th>Détails</th>
              </tr>
            </thead>
            <tbody>
              {sortedLogs.map((log, index) => {
                const d = parseTimestampToDate(log?.timestamp);
                const dateLabel = d ? d.toLocaleString('fr-FR') : '—';

                return (
                  <tr key={index}>
                    <td>{dateLabel}</td>
                    <td>{log?.user || '—'}</td>
                    <td>
                      <strong>{log?.action || '—'}</strong>
                    </td>
                    <td className="details">{safeJson(log?.details)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AuditLog;

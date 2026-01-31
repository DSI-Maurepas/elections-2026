import React, { useEffect, useMemo, useRef } from "react";
import { useGoogleSheets } from "../../hooks/useGoogleSheets";

/**
 * Admin - Audit
 * Version "anti-sticky": 1ère colonne figée via 2 tableaux synchronisés.
 */
const AuditLog = () => {
  const { data: logs, load, loading } = useGoogleSheets("AuditLog");

  const leftRef = useRef(null);
  const rightRef = useRef(null);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const arr = Array.isArray(logs) ? logs.slice().reverse() : [];
    return arr.map((l) => {
      const ts = l?.timestamp ? new Date(l.timestamp) : null;
      const dateStr = ts && !Number.isNaN(ts.getTime()) ? ts.toLocaleString("fr-FR") : "";
      return { ...l, __dateStr: dateStr };
    });
  }, [logs]);

  const syncScroll = (source) => {
    const l = leftRef.current;
    const r = rightRef.current;
    if (!l || !r) return;
    if (source === "right") l.scrollTop = r.scrollTop;
    if (source === "left") r.scrollTop = l.scrollTop;
  };

  return (
    <div className="audit-log">
      <h3>📝 Journal d'audit</h3>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div className="split-table">
          <div className="split-table-left" ref={leftRef} onScroll={() => syncScroll("left")}>
            <table className="audit-table split">
              <thead>
                <tr>
                  <th>Date/Heure</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l, idx) => (
                  <tr key={idx}>
                    <td className="split-sticky-cell">{l.__dateStr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="split-table-right" ref={rightRef} onScroll={() => syncScroll("right")}>
            <table className="audit-table split">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l, idx) => (
                  <tr key={idx}>
                    <td>{l.user}</td>
                    <td>
                      <strong>{l.action}</strong>
                    </td>
                    <td className="details">{JSON.stringify(l.details)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;

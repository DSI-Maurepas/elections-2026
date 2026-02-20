import React from 'react';
import exportService from '../../services/exportService';
import uiService from '../../services/uiService';
import auditService from '../../services/auditService';

/**
 * ✅ NOUVEAUX EXPORTS (sans impact sur les exports existants)
 * - Excel + PDF strictement basés sur le template "Résultats maurepas"
 */
export default function ExportResultatsMaurepas({ electionState }) {
  const tourActuel = electionState?.tourActuel || 1;

  const handleExport = async (format) => {
    try {
      if (format === 'pdf') {
        await exportService.exportPDF('resultats_maurepas_template', tourActuel);
      } else {
        await exportService.exportExcel('resultats_maurepas_template', tourActuel);
      }

      // Audit non bloquant
      try {
        await auditService?.logExport?.('EXPORT', format.toUpperCase(), {
          type: 'resultats_maurepas_template',
          tour: tourActuel
        });
      } catch (_) {}

    } catch (error) {
      uiService.toast('error', {
        title: 'Export Résultats Maurepas',
        message: `Erreur : ${error.message}`
      });
    }
  };

  return (
    <div className="export-excel" style={{ marginTop: 18 }}>
      <h3>🏛️ Résultats Maurepas (template)</h3>

      <div className="export-buttons">
        <button className="export-btn pdf" onClick={() => handleExport('pdf')}>
          🧾 Résultats Maurepas (PDF)
        </button>

        <button className="export-btn excel" onClick={() => handleExport('excel')}>
          📊 Résultats Maurepas (Excel)
        </button>
      </div>

      <p style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
        Génère un document carré, sans fond noir, avec fond #DBE5F1, blason recadré et mise en forme identique au modèle.
      </p>
    </div>
  );
}

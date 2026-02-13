import React from 'react';
import exportService from '../../services/exportService';
import uiService from '../../services/uiService';
import auditService from '../../services/auditService';

const ExportExcel = ({ electionState}) => {
  const handleExport = async (type) => {
    try {
      await exportService.exportExcel(type, electionState?.tourActuel || 1);
      // Audit non bloquant
      try { await auditService?.logExport?.('EXPORT', 'EXCEL', { type, tour: electionState?.tourActuel || 1 }); } catch (_) {}
} catch (error) {
      uiService.toast('error', { title: 'Export', message: `Erreur : ${error.message}` });
}
  };

  return (
    <div className="export-excel">
      <h3>📊 Exports Excel</h3>
      
      <div className="export-buttons">
        <button onClick={() => handleExport('participation')}>
          📋 Participation
        </button>
        <button onClick={() => handleExport('resultats')}>
          🗳️ Résultats
        </button>
        <button onClick={() => handleExport('sieges')}>
          🪑 Sièges
        </button>
        <button onClick={() => handleExport('audit')}>
          📝 Audit
        </button>
        <button onClick={() => handleExport('complet')}>
          📦 Export complet
        </button>
      </div>
    </div>
  );
};

export default ExportExcel;

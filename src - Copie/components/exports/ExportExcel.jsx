import React from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import exportService from '../../services/exportService';

const ExportExcel = () => {
  const { state } = useElectionState();

  const handleExport = async (type) => {
    try {
      await exportService.exportExcel(type, state.tourActuel);
    } catch (error) {
      alert(`Erreur: ${error.message}`);
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

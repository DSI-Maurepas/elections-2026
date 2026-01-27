import React from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import exportService from '../../services/exportService';

const ExportPDF = () => {
  const { state } = useElectionState();

  const handleExport = async (type) => {
    try {
      await exportService.exportPDF(type, state.tourActuel);
      alert(`PDF ${type} généré avec succès`);
    } catch (error) {
      alert(`Erreur: ${error.message}`);
    }
  };

  return (
    <div className="export-pdf">
      <h3>📄 Exports PDF</h3>
      
      <div className="export-buttons">
        <button onClick={() => handleExport('participation')}>
          📋 PV Participation
        </button>
        <button onClick={() => handleExport('resultats')}>
          🗳️ PV Résultats
        </button>
        <button onClick={() => handleExport('statistiques')}>
          📊 Statistiques
        </button>
        <button onClick={() => handleExport('sieges')}>
          🪑 Répartition sièges
        </button>
      </div>
    </div>
  );
};

export default ExportPDF;

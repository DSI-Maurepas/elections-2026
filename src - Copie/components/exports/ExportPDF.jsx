import React from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import exportService from '../../services/exportService';
import auditService from '../../services/auditService';

const ExportPDF = () => {
  const { state } = useElectionState();

  const handleExport = async (type) => {
    try {
      await exportService.exportPDF(type, state.tourActuel);

      // ✅ AUCUN message de succès volontairement
      // Le téléchargement / ouverture du PDF fait foi

      // Audit NON bloquant (si disponible)
      if (typeof auditService?.logExport === 'function') {
        try {
          await auditService.logExport(type, 'PDF');
        } catch (e) {
          console.warn('Audit export PDF non bloquant :', e);
        }
      }
    } catch (error) {
      // ❌ Message UNIQUEMENT en cas d'erreur
      alert(`Erreur : ${error.message}`);
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

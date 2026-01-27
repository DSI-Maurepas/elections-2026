// src/services/exportService.js
// Service d'export PDF et Excel
// Note: Nécessite jsPDF et xlsx (à ajouter au package.json si export côté client souhaité)

import { generateFilename, formatDateTime, formatNumber, formatPercent } from '../utils/formatters';
import { ELECTION_CONFIG, SHEET_NAMES } from '../utils/constants';
import auditService from './auditService';
import googleSheetsService from './googleSheetsService';

class ExportService {
  /**
   * NOUVELLE MÉTHODE - Export Excel selon le type
   */
  async exportExcel(type, tour = 1) {
    try {
      switch (type) {
        case 'participation':
          const sheetNameParticipation = tour === 1 ? SHEET_NAMES.PARTICIPATION_T1 : SHEET_NAMES.PARTICIPATION_T2;
          const participation = await googleSheetsService.getData(sheetNameParticipation);
          await this.exportParticipationCSV(participation, tour);
          break;
        
        case 'resultats':
          const sheetNameResultats = tour === 1 ? SHEET_NAMES.RESULTATS_T1 : SHEET_NAMES.RESULTATS_T2;
          const resultats = await googleSheetsService.getData(sheetNameResultats);
          const candidats = await googleSheetsService.getData(SHEET_NAMES.CANDIDATS);
          await this.exportResultatsCSV(resultats, candidats, tour);
          break;
        
        case 'sieges':
        case 'sieges_municipal':
          alert('Export sièges : Veuillez calculer les sièges avant d\'exporter.');
          console.warn('Export sièges municipal: calcul requis avant export');
          break;
        
        case 'sieges_communautaire':
          alert('Export sièges communautaires : Veuillez calculer les sièges avant d\'exporter.');
          console.warn('Export sièges communautaire: calcul requis avant export');
          break;
        
        case 'audit':
          const auditData = await googleSheetsService.getData(SHEET_NAMES.AUDIT_LOG);
          await this.exportAuditCSV(auditData);
          break;
        
        case 'complet':
          await this.exportCompletCSV(tour);
          break;
        
        default:
          throw new Error(`Type d'export inconnu: ${type}`);
      }
    } catch (error) {
      console.error('Erreur export Excel:', error);
      throw error;
    }
  }

  /**
   * NOUVELLE MÉTHODE - Export PDF selon le type
   */
  async exportPDF(type, tour = 1) {
    try {
      // Accepter 'resultats' OU 'pv_resultats'
      if (type === 'resultats' || type === 'pv_resultats') {
        const sheetNameResultats = tour === 1 ? SHEET_NAMES.RESULTATS_T1 : SHEET_NAMES.RESULTATS_T2;
        const resultats = await googleSheetsService.getData(sheetNameResultats);
        const candidats = await googleSheetsService.getData(SHEET_NAMES.CANDIDATS);
        await this.openPVForPrint(resultats, candidats, tour);
      } else {
        throw new Error(`Type d'export PDF inconnu: ${type}`);
      }
    } catch (error) {
      console.error('Erreur export PDF:', error);
      throw error;
    }
  }

  /**
   * Exporte les données en CSV (compatible Excel)
   */
  exportToCSV(data, filename) {
    try {
      const csvContent = this.arrayToCSV(data);
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, filename);
      
      auditService.logExport('CSV', filename, { rows: data.length });
    } catch (error) {
      console.error('Erreur export CSV:', error);
      throw error;
    }
  }

  /**
   * Convertit un tableau en CSV
   */
  arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Échapper les guillemets et entourer de guillemets si nécessaire
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Exporte la participation en CSV
   */
  async exportParticipationCSV(participation, tour = 1) {
    const data = participation.map(p => {
      // Calculer le taux si absent
      const tauxPct = p.tauxPct !== undefined 
        ? p.tauxPct 
        : (p.inscrits > 0 ? (p.votants / p.inscrits) * 100 : 0);
      
      return {
        'Bureau': p.bureauId || '',
        'Heure': p.heure || '',
        'Inscrits': p.inscrits || 0,
        'Votants': p.votants || 0,
        'Taux (%)': tauxPct.toFixed(2),
        'Saisi par': p.saisiPar || '',
        'Timestamp': formatDateTime(p.timestamp || new Date().toISOString())
      };
    });

    const filename = generateFilename(`participation_tour${tour}`, 'csv');
    this.exportToCSV(data, filename);
  }

  /**
   * Exporte les résultats en CSV
   */
  async exportResultatsCSV(resultats, candidats, tour = 1) {
    const data = resultats.map(r => {
      const row = {
        'Bureau': r.bureauId,
        'Inscrits': r.inscrits,
        'Votants': r.votants,
        'Blancs': r.blancs,
        'Nuls': r.nuls,
        'Exprimés': r.exprimes
      };

      // Ajouter les voix par candidat
      candidats.forEach(c => {
        row[c.nomListe] = r.voix[c.listeId] || 0;
      });

      row['Saisi par'] = r.saisiPar;
      row['Validé par'] = r.validePar;
      row['Timestamp'] = formatDateTime(r.timestamp);

      return row;
    });

    const filename = generateFilename(`resultats_tour${tour}`, 'csv');
    this.exportToCSV(data, filename);
  }

  /**
   * Exporte les sièges municipaux en CSV
   */
  async exportSiegesMunicipalCSV(sieges) {
    const data = sieges.map(s => ({
      'Liste': s.nomListe,
      'Voix': s.voix,
      '% Voix': formatPercent(s.pctVoix),
      'Sièges Majorité': s.siegesMajoritaire || 0,
      'Sièges Proportionnels': s.siegesProportionnels || 0,
      'Total Sièges': s.siegesTotal,
      'Éligible': s.eligible ? 'Oui' : 'Non'
    }));

    const filename = generateFilename('sieges_municipal', 'csv');
    this.exportToCSV(data, filename);
  }

  /**
   * Exporte les sièges communautaires en CSV
   */
  async exportSiegesCommunautaireCSV(sieges) {
    const data = sieges.map(s => ({
      'Liste': s.nomListe,
      'Voix Municipal': s.voixMunicipal,
      '% Municipal': formatPercent(s.pctMunicipal),
      'Sièges Communautaires': s.siegesCommunautaires,
      'Éligible': s.eligible ? 'Oui' : 'Non'
    }));

    const filename = generateFilename('sieges_communautaire', 'csv');
    this.exportToCSV(data, filename);
  }

  /**
   * Exporte le journal d'audit en CSV
   */
  async exportAuditCSV(auditData) {
    const data = auditData.map(a => ({
      'Date': formatDateTime(a.timestamp || a.date),
      'Action': a.action || '',
      'Utilisateur': a.user || a.saisiPar || '',
      'Cible': a.target || a.bureauId || '',
      'Détails': a.details || '',
      'Sévérité': a.severity || 'INFO'
    }));

    const filename = generateFilename('audit_log', 'csv');
    this.exportToCSV(data, filename);
  }

  /**
   * Exporte toutes les données en un seul fichier
   */
  async exportCompletCSV(tour = 1) {
    try {
      // Créer un ZIP avec tous les exports
      const bureaux = await googleSheetsService.getData(SHEET_NAMES.BUREAUX);
      const candidats = await googleSheetsService.getData(SHEET_NAMES.CANDIDATS);
      
      const sheetNameParticipation = tour === 1 ? SHEET_NAMES.PARTICIPATION_T1 : SHEET_NAMES.PARTICIPATION_T2;
      const participation = await googleSheetsService.getData(sheetNameParticipation);
      
      const sheetNameResultats = tour === 1 ? SHEET_NAMES.RESULTATS_T1 : SHEET_NAMES.RESULTATS_T2;
      const resultats = await googleSheetsService.getData(sheetNameResultats);
      
      // Export de chaque type
      await this.exportParticipationCSV(participation, tour);
      await this.exportResultatsCSV(resultats, candidats, tour);
      
      // Exporter les bureaux
      const bureauxData = bureaux.map(b => ({
        'ID': b.id,
        'Nom': b.nom,
        'Adresse': b.adresse,
        'Inscrits': b.inscrits,
        'Actif': b.actif ? 'Oui' : 'Non'
      }));
      const filenameBureaux = generateFilename(`bureaux_tour${tour}`, 'csv');
      this.exportToCSV(bureauxData, filenameBureaux);
      
      // Exporter les candidats
      const candidatsData = candidats.map(c => ({
        'ID': c.listeId,
        'Liste': c.nomListe,
        'Tête de liste': `${c.teteListePrenom} ${c.teteListeNom}`,
        'Couleur': c.couleur,
        'Actif T1': c.actifT1 ? 'Oui' : 'Non',
        'Actif T2': c.actifT2 ? 'Oui' : 'Non'
      }));
      const filenameCandidats = generateFilename(`candidats_tour${tour}`, 'csv');
      this.exportToCSV(candidatsData, filenameCandidats);
      
      alert('Export complet : 4 fichiers CSV téléchargés (Bureaux, Candidats, Participation, Résultats)');
      
    } catch (error) {
      console.error('Erreur export complet:', error);
      throw error;
    }
  }

  /**
   * Génère un PV de résultats en HTML (pour impression/PDF)
   */
  generatePVHTML(resultats, candidats, tour = 1) {
    const date = new Date();
    const consolidation = this.consolidateResults(resultats, candidats);

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Procès-Verbal - Élections Municipales ${ELECTION_CONFIG.COMMUNE_NAME} - Tour ${tour}</title>
  <style>
    body {
      font-family: 'Times New Roman', serif;
      margin: 40px;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      border-bottom: 2px solid #0055A4;
      padding-bottom: 20px;
    }
    h1 {
      color: #0055A4;
      margin: 0;
    }
    .info {
      margin: 20px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #333;
      padding: 8px;
      text-align: left;
    }
    th {
      background-color: #0055A4;
      color: white;
    }
    .total {
      font-weight: bold;
      background-color: #f0f0f0;
    }
    .signature {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
    }
    .signature-block {
      width: 40%;
    }
    @media print {
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>RÉPUBLIQUE FRANÇAISE</h1>
    <h2>Procès-Verbal - Élections Municipales</h2>
    <h3>${ELECTION_CONFIG.COMMUNE_NAME} (${ELECTION_CONFIG.COMMUNE_CODE})</h3>
    <h3>${tour === 1 ? '1er Tour' : '2nd Tour'} - ${ELECTION_CONFIG[tour === 1 ? 'ELECTION_DATE_T1' : 'ELECTION_DATE_T2']}</h3>
  </div>

  <div class="info">
    <p><strong>Date d'édition:</strong> ${formatDateTime(date.toISOString())}</p>
    <p><strong>Nombre de bureaux:</strong> ${resultats.length}</p>
  </div>

  <h3>Résultats de la Participation</h3>
  <table>
    <tr>
      <th>Inscrits</th>
      <th>Votants</th>
      <th>Taux de participation</th>
      <th>Blancs</th>
      <th>Nuls</th>
      <th>Exprimés</th>
    </tr>
    <tr class="total">
      <td>${formatNumber(consolidation.totalInscrits)}</td>
      <td>${formatNumber(consolidation.totalVotants)}</td>
      <td>${formatPercent(consolidation.tauxParticipation)}</td>
      <td>${formatNumber(consolidation.totalBlancs)}</td>
      <td>${formatNumber(consolidation.totalNuls)}</td>
      <td>${formatNumber(consolidation.totalExprimes)}</td>
    </tr>
  </table>

  <h3>Résultats par Liste</h3>
  <table>
    <tr>
      <th>Rang</th>
      <th>Liste</th>
      <th>Voix</th>
      <th>% Exprimés</th>
      <th>% Inscrits</th>
    </tr>
    ${consolidation.resultatsParListe.map((r, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${r.nomListe}</td>
      <td>${formatNumber(r.voix)}</td>
      <td>${formatPercent(r.pctExprimes)}</td>
      <td>${formatPercent(r.pctInscrits)}</td>
    </tr>
    `).join('')}
  </table>

  <div class="signature">
    <div class="signature-block">
      <p>Le Président,</p>
      <br><br><br>
      <p>Signature:</p>
    </div>
    <div class="signature-block">
      <p>Le Secrétaire,</p>
      <br><br><br>
      <p>Signature:</p>
    </div>
  </div>

  <button class="no-print" onclick="window.print()">Imprimer</button>
</body>
</html>
    `;
  }

  /**
   * Consolide les résultats pour génération de PV
   */
  consolidateResults(resultats, candidats) {
    let totalInscrits = 0;
    let totalVotants = 0;
    let totalBlancs = 0;
    let totalNuls = 0;
    let totalExprimes = 0;

    const voixParListe = {};
    candidats.forEach(c => {
      voixParListe[c.listeId] = { ...c, voix: 0 };
    });

    resultats.forEach(r => {
      if (r.bureauId === 'TOTAL') return;
      
      totalInscrits += r.inscrits;
      totalVotants += r.votants;
      totalBlancs += r.blancs;
      totalNuls += r.nuls;
      totalExprimes += r.exprimes;

      for (const listeId in voixParListe) {
        voixParListe[listeId].voix += r.voix[listeId] || 0;
      }
    });

    const resultatsParListe = Object.values(voixParListe).map(l => ({
      listeId: l.listeId,
      nomListe: l.nomListe,
      voix: l.voix,
      pctExprimes: totalExprimes > 0 ? (l.voix / totalExprimes) * 100 : 0,
      pctInscrits: totalInscrits > 0 ? (l.voix / totalInscrits) * 100 : 0
    })).sort((a, b) => b.voix - a.voix);

    return {
      totalInscrits,
      totalVotants,
      totalBlancs,
      totalNuls,
      totalExprimes,
      tauxParticipation: totalInscrits > 0 ? (totalVotants / totalInscrits) * 100 : 0,
      resultatsParListe
    };
  }

  /**
   * Ouvre le PV dans une nouvelle fenêtre pour impression
   */
  async openPVForPrint(resultats, candidats, tour = 1) {
    const html = this.generatePVHTML(resultats, candidats, tour);
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    
    auditService.logExport('PV_HTML', `tour${tour}`, { bureaux: resultats.length });
  }

  /**
   * Télécharge un blob
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export default new ExportService();

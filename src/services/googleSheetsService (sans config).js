// src/services/googleSheetsService.js
// Service Google Sheets API v4 - Backend unique de l'application
// FICHIER COMPLET - Remplace les parties 1 et 2

import authService from './authService';
import { SHEET_NAMES } from '../utils/constants';

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = import.meta.env.VITE_SPREADSHEET_ID;
    this.apiUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
  }

  /**
   * Effectue une requête à l'API Google Sheets
   */
  async makeRequest(endpoint, options = {}) {
    const token = authService.getAccessToken();
    if (!token) {
      // Mode démo : retourner des données vides au lieu d'erreur
      console.warn('Mode démo : Google Sheets non configuré');
      return { values: [] };
    }

    await authService.refreshTokenIfNeeded();

    const url = `${this.apiUrl}/${this.spreadsheetId}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Erreur API Google Sheets');
      }

      return await response.json();
    } catch (error) {
      console.error('Erreur requête Google Sheets:', error);
      throw error;
    }
  }

  // ==================== CONFIG ====================

  async getConfig() {
    const range = `${SHEET_NAMES.CONFIG}!A:B`;
    const response = await this.makeRequest(`/values/${range}`);
    
    const config = {};
    if (response.values) {
      response.values.forEach(([key, value]) => {
        if (key) {
          config[key] = !isNaN(value) && value !== '' ? parseFloat(value) : value;
        }
      });
    }
    return config;
  }

  async updateConfig(key, value) {
    const range = `${SHEET_NAMES.CONFIG}!A:B`;
    const response = await this.makeRequest(`/values/${range}`);
    const values = response.values || [];
    const rowIndex = values.findIndex(([k]) => k === key);
    
    if (rowIndex === -1) {
      return await this.appendRows(SHEET_NAMES.CONFIG, [[key, value]]);
    } else {
      const updateRange = `${SHEET_NAMES.CONFIG}!B${rowIndex + 1}`;
      return await this.updateCell(updateRange, value);
    }
  }

  // ==================== BUREAUX ====================

  async getBureaux() {
    const range = `${SHEET_NAMES.BUREAUX}!A:H`;
    const response = await this.makeRequest(`/values/${range}`);
    
    if (!response.values || response.values.length < 2) {
      // Mode démo : retourner des données fictives
      return this.getDemoBureaux();
    }

    const [headers, ...rows] = response.values;
    return rows.map(row => ({
      id: row[0] || '',
      nom: row[1] || '',
      adresse: row[2] || '',
      president: row[3] || '',
      secretaire: row[4] || '',
      secretaireSuppleant: row[5] || '',
      inscrits: parseInt(row[6]) || 0,
      actif: row[7] === 'TRUE' || row[7] === true
    }));
  }

  getDemoBureaux() {
    return [
      { id: 'BV1', nom: 'Bureau 1', adresse: 'Mairie', president: 'Demo', secretaire: 'Demo', secretaireSuppleant: '', inscrits: 500, actif: true },
      { id: 'BV2', nom: 'Bureau 2', adresse: 'École', president: 'Demo', secretaire: 'Demo', secretaireSuppleant: '', inscrits: 450, actif: true },
      { id: 'BV3', nom: 'Bureau 3', adresse: 'Gymnase', president: 'Demo', secretaire: 'Demo', secretaireSuppleant: '', inscrits: 520, actif: true }
    ];
  }

  async updateBureau(bureauId, data) {
    const bureaux = await this.getBureaux();
    const index = bureaux.findIndex(b => b.id === bureauId);
    if (index === -1) throw new Error(`Bureau ${bureauId} non trouvé`);

    const rowIndex = index + 2;
    const range = `${SHEET_NAMES.BUREAUX}!A${rowIndex}:H${rowIndex}`;
    const values = [[
      data.id, data.nom, data.adresse,
      data.president || '', data.secretaire || '', data.secretaireSuppleant || '',
      data.inscrits, data.actif ? 'TRUE' : 'FALSE'
    ]];

    return await this.makeRequest(`/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values })
    });
  }

  // ==================== CANDIDATS ====================

  async getCandidats() {
    const range = `${SHEET_NAMES.CANDIDATS}!A:H`;
    const response = await this.makeRequest(`/values/${range}`);
    
    if (!response.values || response.values.length < 2) {
      // Mode démo : retourner des données fictives
      return this.getDemoCandidats();
    }

    const [headers, ...rows] = response.values;
    return rows.map(row => ({
      listeId: row[0] || '',
      nomListe: row[1] || '',
      teteListeNom: row[2] || '',
      teteListePrenom: row[3] || '',
      couleur: row[4] || '#0055A4',
      ordre: parseInt(row[5]) || 0,
      actifT1: row[6] === 'TRUE' || row[6] === true,
      actifT2: row[7] === 'TRUE' || row[7] === true
    }));
  }

  getDemoCandidats() {
    return [
      { listeId: 'L1', nomListe: 'Liste Démo 1', teteListeNom: 'DUPONT', teteListePrenom: 'Jean', couleur: '#0055A4', ordre: 1, actifT1: true, actifT2: false },
      { listeId: 'L2', nomListe: 'Liste Démo 2', teteListeNom: 'MARTIN', teteListePrenom: 'Marie', couleur: '#E1000F', ordre: 2, actifT1: true, actifT2: false },
      { listeId: 'L3', nomListe: 'Liste Démo 3', teteListeNom: 'BERNARD', teteListePrenom: 'Pierre', couleur: '#28A745', ordre: 3, actifT1: true, actifT2: false }
    ];
  }

  async addCandidat(candidat) {
    const values = [[
      candidat.listeId, candidat.nomListe, candidat.teteListeNom, candidat.teteListePrenom,
      candidat.couleur, candidat.ordre,
      candidat.actifT1 ? 'TRUE' : 'FALSE',
      candidat.actifT2 ? 'TRUE' : 'FALSE'
    ]];
    return await this.appendRows(SHEET_NAMES.CANDIDATS, values);
  }

  async updateCandidat(listeId, data) {
    const candidats = await this.getCandidats();
    const index = candidats.findIndex(c => c.listeId === listeId);
    if (index === -1) throw new Error(`Liste ${listeId} non trouvée`);

    const rowIndex = index + 2;
    const range = `${SHEET_NAMES.CANDIDATS}!A${rowIndex}:H${rowIndex}`;
    const values = [[
      data.listeId, data.nomListe, data.teteListeNom, data.teteListePrenom,
      data.couleur, data.ordre,
      data.actifT1 ? 'TRUE' : 'FALSE',
      data.actifT2 ? 'TRUE' : 'FALSE'
    ]];

    return await this.makeRequest(`/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values })
    });
  }

  async activerListesT2(listeId1, listeId2) {
    const candidats = await this.getCandidats();
    const updates = candidats.map((c, index) => {
      const actif = c.listeId === listeId1 || c.listeId === listeId2;
      return {
        range: `${SHEET_NAMES.CANDIDATS}!H${index + 2}`,
        values: [[actif ? 'TRUE' : 'FALSE']]
      };
    });
    return await this.batchUpdate(updates);
  }

  // ==================== PARTICIPATION ====================

  async getParticipation(tour = 1) {
    const sheetName = tour === 1 ? SHEET_NAMES.PARTICIPATION_T1 : SHEET_NAMES.PARTICIPATION_T2;
    const range = `${sheetName}!A:G`;
    const response = await this.makeRequest(`/values/${range}`);
    
    if (!response.values || response.values.length < 2) return [];

    const [headers, ...rows] = response.values;
    return rows.map(row => ({
      bureauId: row[0] || '',
      timestamp: row[1] || '',
      heure: row[2] || '',
      inscrits: parseInt(row[3]) || 0,
      votants: parseInt(row[4]) || 0,
      tauxPct: parseFloat(row[5]) || 0,
      saisiPar: row[6] || ''
    }));
  }

  async saveParticipation(tour, data) {
    const sheetName = tour === 1 ? SHEET_NAMES.PARTICIPATION_T1 : SHEET_NAMES.PARTICIPATION_T2;
    const timestamp = new Date().toISOString();
    const tauxPct = data.inscrits > 0 ? (data.votants / data.inscrits) * 100 : 0;
    
    const values = [[
      data.bureauId, timestamp, data.heure,
      data.inscrits, data.votants, tauxPct.toFixed(2),
      authService.getUserEmail()
    ]];

    return await this.appendRows(sheetName, values);
  }

  // ==================== RÉSULTATS ====================

  async getResultats(tour = 1) {
    const sheetName = tour === 1 ? SHEET_NAMES.RESULTATS_T1 : SHEET_NAMES.RESULTATS_T2;
    const range = `${sheetName}!A:Z`;
    const response = await this.makeRequest(`/values/${range}`);
    
    if (!response.values || response.values.length < 2) return [];

    const [headers, ...rows] = response.values;
    const voixColumns = headers.reduce((acc, header, index) => {
      if (header.endsWith('_Voix')) {
        acc[header.replace('_Voix', '')] = index;
      }
      return acc;
    }, {});

    return rows.map(row => {
      const result = {
        bureauId: row[0] || '',
        inscrits: parseInt(row[1]) || 0,
        votants: parseInt(row[2]) || 0,
        blancs: parseInt(row[3]) || 0,
        nuls: parseInt(row[4]) || 0,
        exprimes: parseInt(row[5]) || 0,
        voix: {},
        saisiPar: row[headers.length - 3] || '',
        validePar: row[headers.length - 2] || '',
        timestamp: row[headers.length - 1] || ''
      };

      for (const [listeId, colIndex] of Object.entries(voixColumns)) {
        result.voix[listeId] = parseInt(row[colIndex]) || 0;
      }
      return result;
    });
  }

  async saveResultatsBureau(tour, bureauId, data) {
    const sheetName = tour === 1 ? SHEET_NAMES.RESULTATS_T1 : SHEET_NAMES.RESULTATS_T2;
    const candidats = await this.getCandidats();
    const candidatsActifs = candidats.filter(c => 
      tour === 1 ? c.actifT1 : c.actifT2
    ).sort((a, b) => a.ordre - b.ordre);

    const resultats = await this.getResultats(tour);
    const existingIndex = resultats.findIndex(r => r.bureauId === bureauId);

    const timestamp = new Date().toISOString();
    const row = [
      bureauId, data.inscrits, data.votants, data.blancs, data.nuls, data.exprimes,
      ...candidatsActifs.map(c => data.voix[c.listeId] || 0),
      authService.getUserEmail(), '', timestamp
    ];

    if (existingIndex === -1) {
      return await this.appendRows(sheetName, [row]);
    } else {
      const rowIndex = existingIndex + 2;
      const lastCol = String.fromCharCode(65 + row.length - 1);
      const range = `${sheetName}!A${rowIndex}:${lastCol}${rowIndex}`;
      return await this.makeRequest(`/values/${range}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({ values: [row] })
      });
    }
  }

  async validerResultatsBureau(tour, bureauId) {
    const sheetName = tour === 1 ? SHEET_NAMES.RESULTATS_T1 : SHEET_NAMES.RESULTATS_T2;
    const resultats = await this.getResultats(tour);
    const index = resultats.findIndex(r => r.bureauId === bureauId);
    if (index === -1) throw new Error(`Bureau ${bureauId} non trouvé`);

    const rowIndex = index + 2;
    const colIndex = 'L'; // Colonne ValidePar (à ajuster selon le nombre de listes)
    const range = `${sheetName}!${colIndex}${rowIndex}`;
    
    return await this.updateCell(range, authService.getUserEmail());
  }

  // ==================== SIÈGES ====================

  async saveSiegesMunicipal(sieges, tour) {
    await this.clearSheet(SHEET_NAMES.SEATS_MUNICIPAL);
    
    const headers = ['Tour', 'ListeID', 'NomListe', 'Voix', 'PctVoix', 
                     'SiegesMajorite', 'SiegesProportionnels', 'SiegesTotal', 'Eligible'];
    
    const rows = sieges.map(s => [
      tour,
      s.listeId,
      s.nomListe,
      s.voix,
      s.pctVoix.toFixed(2),
      s.siegesMajoritaire || 0,
      s.siegesProportionnels || 0,
      s.siegesTotal,
      s.eligible ? 'TRUE' : 'FALSE'
    ]);

    return await this.appendRows(SHEET_NAMES.SEATS_MUNICIPAL, [headers, ...rows]);
  }

  async saveSiegesCommunautaire(sieges) {
    await this.clearSheet(SHEET_NAMES.SEATS_COMMUNITY);
    
    const headers = ['ListeID', 'NomListe', 'VoixMunicipal', 'PctMunicipal', 
                     'SiegesCommunautaires', 'Eligible'];
    
    const rows = sieges.map(s => [
      s.listeId,
      s.nomListe,
      s.voixMunicipal,
      s.pctMunicipal.toFixed(2),
      s.siegesCommunautaires,
      s.eligible ? 'TRUE' : 'FALSE'
    ]);

    return await this.appendRows(SHEET_NAMES.SEATS_COMMUNITY, [headers, ...rows]);
  }

  // ==================== STATE ====================

  async getElectionState() {
    const range = `${SHEET_NAMES.ELECTIONS_STATE}!A:C`;
    const response = await this.makeRequest(`/values/${range}`);
    
    if (!response.values || response.values.length === 0) {
      // Mode démo : retourner un état par défaut
      return this.getDemoElectionState();
    }

    const state = {};
    if (response.values) {
      response.values.forEach(([key, value, timestamp]) => {
        state[key] = { value, timestamp };
      });
    }
    return state;
  }

  getDemoElectionState() {
    const now = new Date().toISOString();
    return {
      tourActuel: { value: '1', timestamp: now },
      statutT1: { value: 'NON_OUVERT', timestamp: now },
      statutT2: { value: 'NON_OUVERT', timestamp: now },
      verrouillageT1: { value: 'false', timestamp: now },
      verrouillageT2: { value: 'false', timestamp: now }
    };
  }

  async updateElectionState(key, value) {
    const range = `${SHEET_NAMES.ELECTIONS_STATE}!A:C`;
    const response = await this.makeRequest(`/values/${range}`);
    const values = response.values || [];
    const rowIndex = values.findIndex(([k]) => k === key);
    const timestamp = new Date().toISOString();
    
    if (rowIndex === -1) {
      return await this.appendRows(SHEET_NAMES.ELECTIONS_STATE, [[key, value, timestamp]]);
    } else {
      const updateRange = `${SHEET_NAMES.ELECTIONS_STATE}!B${rowIndex + 1}:C${rowIndex + 1}`;
      return await this.makeRequest(`/values/${updateRange}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        body: JSON.stringify({ values: [[value, timestamp]] })
      });
    }
  }

  // ==================== AUDIT ====================

  async logAudit(action, entity, entityId, before, after) {
    const timestamp = new Date().toISOString();
    const values = [[
      timestamp,
      authService.getUserEmail(),
      action,
      entity,
      entityId,
      JSON.stringify(before),
      JSON.stringify(after),
      '', // IP (non disponible côté client)
      navigator.userAgent
    ]];

    return await this.appendRows(SHEET_NAMES.AUDIT_LOG, values);
  }

  async logError(severity, source, message, stack, context) {
    const timestamp = new Date().toISOString();
    const values = [[
      timestamp,
      severity,
      source,
      message,
      stack || '',
      authService.getUserEmail(),
      JSON.stringify(context)
    ]];

    return await this.appendRows(SHEET_NAMES.ERROR_LOG, values);
  }

  // ==================== UTILITAIRES ====================

  async appendRows(sheetName, rows) {
    const range = `${sheetName}!A:Z`;
    return await this.makeRequest(`/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: rows })
    });
  }

  async updateCell(range, value) {
    return await this.makeRequest(`/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [[value]] })
    });
  }

  async batchUpdate(updates) {
    const data = updates.map(u => ({
      range: u.range,
      values: u.values
    }));

    return await this.makeRequest('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data
      })
    });
  }

  async clearSheet(sheetName) {
    const range = `${sheetName}!A:Z`;
    return await this.makeRequest(`/values/${range}:clear`, {
      method: 'POST'
    });
  }

  async getSheetMetadata() {
    return await this.makeRequest('');
  }

  /**
   * Méthode générique pour récupérer les données d'une feuille
   * Route vers la bonne méthode selon le nom de la feuille
   */
  async getData(sheetName, filters = {}) {
    switch (sheetName) {
      case 'Bureaux':
        return await this.getBureaux();
      case 'Candidats':
        return await this.getCandidats();
      case 'Participation_T1':
        return await this.getParticipationT1();
      case 'Participation_T2':
        return await this.getParticipationT2();
      case 'Resultats_T1':
        return await this.getResultatsT1();
      case 'Resultats_T2':
        return await this.getResultatsT2();
      case 'Audit':
        return await this.getAudit();
      case 'Config':
        return await this.getConfig();
      default:
        throw new Error(`Feuille inconnue: ${sheetName}`);
    }
  }

  /**
   * Méthode générique pour ajouter une ligne
   */
  async appendRow(sheetName, data) {
    const values = this.convertObjectToRow(sheetName, data);
    return await this.appendRows(sheetName, [values]);
  }

  /**
   * Méthode générique pour mettre à jour une ligne
   */
  async updateRow(sheetName, rowIndex, data) {
    const values = this.convertObjectToRow(sheetName, data);
    const range = `${sheetName}!A${rowIndex}:Z${rowIndex}`;
    return await this.updateRange(range, [values]);
  }

  /**
   * Méthode générique pour supprimer une ligne
   */
  async deleteRow(sheetName, rowIndex) {
    return await this.deleteRows(sheetName, rowIndex, 1);
  }

  /**
   * Convertit un objet en tableau de valeurs selon la structure de la feuille
   */
  convertObjectToRow(sheetName, data) {
    // Cette méthode doit être adaptée selon la structure de chaque feuille
    // Pour l'instant, on retourne les valeurs dans l'ordre des clés
    return Object.values(data);
  }
}

export default new GoogleSheetsService();

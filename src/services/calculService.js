// src/services/calculService.js
// Service de calculs électoraux

import {
  calculerSiegesMunicipal,
  calculerSiegesCommunautaire,
  determinerQualifiesSecondTour,
  secondTourNecessaire,
  genererRapportCalcul
} from '../utils/electionRules';
import googleSheetsService from './googleSheetsService';
import auditService from './auditService';

class CalculService {
  /**
   * Consolide les résultats par liste (total communal)
   */
  async consoliderResultats(tour = 1) {
    try {
      const resultats = await googleSheetsService.getResultats(tour);
      const candidats = await googleSheetsService.getCandidats();
      
      // Filtrer les candidats actifs pour ce tour
      const candidatsActifs = candidats.filter(c => 
        tour === 1 ? c.actifT1 : c.actifT2
      );

      // Calculer les totaux
      let totalInscrits = 0;
      let totalVotants = 0;
      let totalBlancs = 0;
      let totalNuls = 0;
      let totalExprimes = 0;

      const voixParListe = {};
      candidatsActifs.forEach(c => {
        voixParListe[c.listeId] = 0;
      });

      // Exclure la ligne TOTAL si elle existe
      const resultatsData = resultats.filter(r => r.bureauId !== 'TOTAL');

      resultatsData.forEach(r => {
        totalInscrits += r.inscrits;
        totalVotants += r.votants;
        totalBlancs += r.blancs;
        totalNuls += r.nuls;
        totalExprimes += r.exprimes;

        for (const listeId in voixParListe) {
          voixParListe[listeId] += r.voix[listeId] || 0;
        }
      });

      // Calculer les pourcentages
      const resultatsConsolides = candidatsActifs.map(c => ({
        listeId: c.listeId,
        nomListe: c.nomListe,
        teteListeNom: c.teteListeNom,
        teteListePrenom: c.teteListePrenom,
        couleur: c.couleur,
        voix: voixParListe[c.listeId],
        pctExprimes: totalExprimes > 0 ? (voixParListe[c.listeId] / totalExprimes) * 100 : 0,
        pctInscrits: totalInscrits > 0 ? (voixParListe[c.listeId] / totalInscrits) * 100 : 0
      })).sort((a, b) => b.voix - a.voix);

      return {
        tour,
        totalInscrits,
        totalVotants,
        totalBlancs,
        totalNuls,
        totalExprimes,
        tauxParticipation: totalInscrits > 0 ? (totalVotants / totalInscrits) * 100 : 0,
        resultatsParListe: resultatsConsolides,
        nombreBureaux: resultatsData.length
      };
    } catch (error) {
      console.error('Erreur consolidation résultats:', error);
      throw error;
    }
  }

  /**
   * Détermine les listes qualifiées pour le second tour
   */
  async determinerSecondTour() {
    try {
      const consolidation = await this.consoliderResultats(1);
      const config = await googleSheetsService.getConfig();
      
      // Vérifier si un second tour est nécessaire
      const needsT2 = secondTourNecessaire(
        consolidation.resultatsParListe,
        consolidation.totalInscrits
      );

      if (!needsT2) {
        return {
          necessaire: false,
          raison: 'Majorité absolue obtenue au 1er tour',
          listeMajoritaire: consolidation.resultatsParListe[0]
        };
      }

      // Déterminer les 2 qualifiés
      const { qualified, egalite, classement } = determinerQualifiesSecondTour(
        consolidation.resultatsParListe
      );

      return {
        necessaire: true,
        qualified,
        egalite,
        classement,
        liste1: consolidation.resultatsParListe.find(l => l.listeId === qualified[0]),
        liste2: consolidation.resultatsParListe.find(l => l.listeId === qualified[1])
      };
    } catch (error) {
      console.error('Erreur détermination second tour:', error);
      throw error;
    }
  }

  /**
   * Active les listes qualifiées pour le second tour
   */
  async activerSecondTour() {
    try {
      const secondTour = await this.determinerSecondTour();
      
      if (!secondTour.necessaire) {
        throw new Error('Second tour non nécessaire');
      }

      if (secondTour.egalite) {
        throw new Error('Égalité détectée - Décision manuelle requise');
      }

      // Activer les 2 listes qualifiées
      await googleSheetsService.activerListesT2(
        secondTour.qualified[0],
        secondTour.qualified[1]
      );

      // Mettre à jour l'état de l'élection
      await googleSheetsService.updateElectionState('T1_CLOSED', 'TRUE');
      await googleSheetsService.updateElectionState('T2_QUALIFIED_LISTE1', secondTour.qualified[0]);
      await googleSheetsService.updateElectionState('T2_QUALIFIED_LISTE2', secondTour.qualified[1]);
      await googleSheetsService.updateElectionState('CURRENT_TOUR', '2');
      await googleSheetsService.updateConfig('CURRENT_TOUR', 2);

      // Audit
      await auditService.log('CALCULATE', 'SecondTour', 'ALL', {}, {
        qualified: secondTour.qualified,
        liste1: secondTour.liste1,
        liste2: secondTour.liste2
      });

      return secondTour;
    } catch (error) {
      console.error('Erreur activation second tour:', error);
      throw error;
    }
  }

  /**
   * Calcule la répartition des sièges municipaux
   */
  async calculerSiegesMunicipal(tour = null) {
    try {
      // Déterminer le tour à utiliser
      if (tour === null) {
        const config = await googleSheetsService.getConfig();
        tour = config.CURRENT_TOUR || 1;
      }

      const consolidation = await this.consoliderResultats(tour);
      const config = await googleSheetsService.getConfig();

      // Calculer les sièges
      const sieges = calculerSiegesMunicipal(
        consolidation.resultatsParListe,
        config.SEATS_MUNICIPAL_TOTAL || 35,
        config.SEATS_THRESHOLD_PCT || 5.0
      );

      // Sauvegarder dans Sheets
      await googleSheetsService.saveSiegesMunicipal(sieges, tour);

      // Mettre à jour l'état
      await googleSheetsService.updateElectionState('SEATS_CALCULATED', 'TRUE');

      // Générer rapport
      const rapport = genererRapportCalcul(
        consolidation.resultatsParListe,
        sieges,
        config.SEATS_MUNICIPAL_TOTAL || 35,
        config.SEATS_THRESHOLD_PCT || 5.0
      );

      // Audit
      await auditService.log('CALCULATE', 'Seats_Municipal', 'ALL', {}, rapport);

      return {
        sieges,
        rapport,
        consolidation
      };
    } catch (error) {
      console.error('Erreur calcul sièges municipaux:', error);
      throw error;
    }
  }

  /**
   * Calcule la répartition des sièges communautaires
   */
  async calculerSiegesCommunautaire(tour = null) {
    try {
      if (tour === null) {
        const config = await googleSheetsService.getConfig();
        tour = config.CURRENT_TOUR || 1;
      }

      const consolidation = await this.consoliderResultats(tour);
      const config = await googleSheetsService.getConfig();

      // Calculer les sièges communautaires
      const sieges = calculerSiegesCommunautaire(
        consolidation.resultatsParListe,
        config.SEATS_COMMUNITY_TOTAL || 6,
        config.SEATS_THRESHOLD_PCT || 5.0
      );

      // Sauvegarder dans Sheets
      await googleSheetsService.saveSiegesCommunautaire(sieges);

      // Audit
      await auditService.log('CALCULATE', 'Seats_Community', 'ALL', {}, { sieges });

      return {
        sieges,
        consolidation
      };
    } catch (error) {
      console.error('Erreur calcul sièges communautaires:', error);
      throw error;
    }
  }

  /**
   * Calcule les statistiques de participation
   */
  async calculerStatistiquesParticipation(tour = 1) {
    try {
      const participation = await googleSheetsService.getParticipation(tour);
      const bureaux = await googleSheetsService.getBureaux();

      // Grouper par bureau
      const parBureau = {};
      participation.forEach(p => {
        if (!parBureau[p.bureauId]) {
          parBureau[p.bureauId] = [];
        }
        parBureau[p.bureauId].push(p);
      });

      // Calculer les stats par bureau
      const statsBureaux = bureaux.map(b => {
        const mesures = parBureau[b.id] || [];
        const derniereMesure = mesures[mesures.length - 1];
        
        return {
          bureauId: b.id,
          nom: b.nom,
          inscrits: b.inscrits,
          votants: derniereMesure?.votants || 0,
          tauxPct: derniereMesure?.tauxPct || 0,
          evolution: mesures.map(m => ({
            heure: m.heure,
            votants: m.votants,
            tauxPct: m.tauxPct
          }))
        };
      });

      // Stats globales
      const totalInscrits = statsBureaux.reduce((sum, b) => sum + b.inscrits, 0);
      const totalVotants = statsBureaux.reduce((sum, b) => sum + b.votants, 0);
      const tauxGlobal = totalInscrits > 0 ? (totalVotants / totalInscrits) * 100 : 0;

      return {
        tour,
        totalInscrits,
        totalVotants,
        tauxGlobal,
        statsBureaux,
        derniereMiseAJour: new Date().toISOString()
      };
    } catch (error) {
      console.error('Erreur calcul statistiques participation:', error);
      throw error;
    }
  }

  /**
   * Vérifie la cohérence des résultats
   */
  async verifierCoherence(tour = 1) {
    try {
      const resultats = await googleSheetsService.getResultats(tour);
      const erreurs = [];

      resultats.forEach(r => {
        if (r.bureauId === 'TOTAL') return;

        // Contrôle 1: Votants = Blancs + Nuls + Exprimés
        const somme = r.blancs + r.nuls + r.exprimes;
        if (r.votants !== somme) {
          erreurs.push({
            bureauId: r.bureauId,
            type: 'INCOHERENCE_VOTANTS',
            message: `Votants (${r.votants}) ≠ Blancs + Nuls + Exprimés (${somme})`
          });
        }

        // Contrôle 2: Somme des voix = Exprimés
        const totalVoix = Object.values(r.voix).reduce((sum, v) => sum + v, 0);
        if (totalVoix !== r.exprimes) {
          erreurs.push({
            bureauId: r.bureauId,
            type: 'INCOHERENCE_VOIX',
            message: `Somme des voix (${totalVoix}) ≠ Exprimés (${r.exprimes})`
          });
        }

        // Contrôle 3: Votants <= Inscrits
        if (r.votants > r.inscrits) {
          erreurs.push({
            bureauId: r.bureauId,
            type: 'VOTANTS_SUPERIEURS_INSCRITS',
            message: `Votants (${r.votants}) > Inscrits (${r.inscrits})`
          });
        }
      });

      return {
        coherent: erreurs.length === 0,
        erreurs
      };
    } catch (error) {
      console.error('Erreur vérification cohérence:', error);
      throw error;
    }
  }
}

export default new CalculService();

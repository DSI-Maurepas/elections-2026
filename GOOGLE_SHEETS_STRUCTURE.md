# Structure Google Sheets - Élections Municipales 2026

## Vue d'ensemble

Document Google Sheets unique contenant toutes les données de l'application.

**ID Spreadsheet**: À créer et configurer dans l'app

---

## Feuille 1: Config

**Objectif**: Paramètres globaux de l'application

| Colonne A (Clé) | Colonne B (Valeur) | Description |
|-----------------|-------------------|-------------|
| COMMUNE_NAME | Maurepas | Nom de la commune |
| COMMUNE_CODE | 78403 | Code INSEE |
| COMMUNE_POP | 20000 | Population |
| ELECTION_DATE_T1 | 2026-03-15 | Date 1er tour |
| ELECTION_DATE_T2 | 2026-03-22 | Date 2nd tour |
| VOTING_HOURS_START | 08:00 | Ouverture bureaux |
| VOTING_HOURS_END | 20:00 | Fermeture bureaux |
| SEATS_MUNICIPAL_TOTAL | 35 | Sièges CM (>20k hab) |
| SEATS_COMMUNITY_TOTAL | 6 | Sièges CC SQY (à configurer) |
| SEATS_THRESHOLD_PCT | 5.0 | Seuil 5% |
| CURRENT_TOUR | 1 | Tour actif (1 ou 2) |
| TOUR1_STATUS | EN_COURS | EN_COURS / CLOTURE |
| TOUR2_STATUS | NON_OUVERT | NON_OUVERT / EN_COURS / CLOTURE |
| APP_VERSION | 1.0.0 | Version app |
| LAST_BACKUP | 2026-03-15T08:00:00Z | Dernier backup |

---

## Feuille 2: Bureaux

**Objectif**: Liste des 13 bureaux de vote

| ID | Nom | Adresse | President | Secretaire | SecretaireSuppleant | Inscrits | Actif |
|----|-----|---------|-----------|------------|---------------------|----------|-------|
| BV1 | Mairie | Place Charles de Gaulle | | | | 1250 | TRUE |
| BV2 | Groupe scolaire de l'Agiot | Square de Beaufortin | | | | 1180 | TRUE |
| BV3 | École élémentaire Malmedonne | Avenue du Rouergue | | | | 1320 | TRUE |
| BV4 | École Maternelle Haute-Futaie | Avenue de Touraine | | | | 1095 | TRUE |
| BV5 | Espace Albert Camus | Rue de la Beauce | | | | 1240 | TRUE |
| BV6 | Groupe scolaire Les Coudrays | Avenue de Picardie | | | | 1165 | TRUE |
| BV7 | École élémentaire Les Bessières | Rue de Noirmoutier | | | | 1210 | TRUE |
| BV8 | Centre de Loisirs du Bout des Clos | Chemin des petits fossés | | | | 1075 | TRUE |
| BV9 | École élémentaire La Marnière | 29 Avenue du Trégor | | | | 1290 | TRUE |
| BV10 | Centre Éducatif et Sportif de l'Agiot (CESA) | Square du Dauphiné | | | | 1155 | TRUE |
| BV11 | École maternelle La Marnière | 29 avenue du Trégor | | | | 1100 | TRUE |
| BV12 | Groupe scolaire Les Friches | Place du Doubs | | | | 1225 | TRUE |
| BV13 | École maternelle Chapiteau | Allée des Tilleuls | | | | 1195 | TRUE |

**Colonnes**:
- ID: Identifiant unique (BV1-BV13)
- Nom: Nom du lieu
- Adresse: Adresse complète
- President, Secretaire, SecretaireSuppleant: Membres du bureau
- Inscrits: Nombre d'inscrits (exemple, à ajuster)
- Actif: TRUE/FALSE

---

## Feuille 3: Candidats

**Objectif**: Listes et candidats du 1er tour

| ListeID | NomListe | TeteListeNom | TeteListePrenom | Couleur | Ordre | ActifT1 | ActifT2 |
|---------|----------|--------------|-----------------|---------|-------|---------|---------|
| L1 | Liste 1 | NOM1 | Prénom1 | #0055A4 | 1 | TRUE | FALSE |
| L2 | Liste 2 | NOM2 | Prénom2 | #EF4135 | 2 | TRUE | FALSE |
| L3 | Liste 3 | NOM3 | Prénom3 | #00A651 | 3 | TRUE | FALSE |
| L4 | Liste 4 | NOM4 | Prénom4 | #FFD700 | 4 | TRUE | FALSE |
| L5 | Liste 5 | NOM5 | Prénom5 | #FF6B35 | 5 | TRUE | FALSE |

**Colonnes**:
- ListeID: Identifiant unique (L1, L2, etc.)
- NomListe: Nom de la liste
- TeteListeNom, TeteListePrenom: Tête de liste
- Couleur: Code couleur hexadécimal (affichage)
- Ordre: Ordre d'affichage
- ActifT1: Actif au 1er tour (TRUE/FALSE)
- ActifT2: Qualifié pour 2nd tour (TRUE/FALSE, calculé automatiquement)

---

## Feuille 4: Participation_T1

**Objectif**: Suivi participation horaire 1er tour

| BureauID | Timestamp | Heure | Inscrits | Votants | TauxPct | SaisiPar |
|----------|-----------|-------|----------|---------|---------|----------|
| BV1 | 2026-03-15T10:00:00Z | 10:00 | 1250 | 125 | 10.00 | user@example.com |
| BV1 | 2026-03-15T12:00:00Z | 12:00 | 1250 | 380 | 30.40 | user@example.com |
| BV1 | 2026-03-15T17:00:00Z | 17:00 | 1250 | 710 | 56.80 | user@example.com |
| BV2 | 2026-03-15T10:00:00Z | 10:00 | 1180 | 118 | 10.00 | user@example.com |
| ... | ... | ... | ... | ... | ... | ... |

**Colonnes**:
- BureauID: ID du bureau (BV1-BV13)
- Timestamp: ISO 8601 (UTC)
- Heure: Format HH:MM (affichage)
- Inscrits: Nombre d'inscrits (référence)
- Votants: Nombre cumulé de votants
- TauxPct: Taux de participation (calculé)
- SaisiPar: Email utilisateur

**Points horaires recommandés**: 10h, 12h, 17h, 20h (fermeture)

---

## Feuille 5: Participation_T2

**Structure identique à Participation_T1**, pour le 2nd tour.

---

## Feuille 6: Résultats_T1

**Objectif**: Résultats détaillés par bureau, 1er tour

| BureauID | Inscrits | Votants | Blancs | Nuls | Exprimes | L1_Voix | L2_Voix | L3_Voix | L4_Voix | L5_Voix | SaisiPar | ValidePar | Timestamp |
|----------|----------|---------|--------|------|----------|---------|---------|---------|---------|---------|----------|-----------|-----------|
| BV1 | 1250 | 950 | 12 | 8 | 930 | 320 | 280 | 180 | 95 | 55 | user@mail | admin@mail | 2026-03-15T21:30:00Z |
| BV2 | 1180 | 890 | 10 | 5 | 875 | 295 | 265 | 175 | 85 | 55 | user@mail | admin@mail | 2026-03-15T21:35:00Z |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
| **TOTAL** | **15500** | **12000** | **150** | **80** | **11770** | **4000** | **3500** | **2500** | **1100** | **670** | - | - | - |

**Colonnes**:
- BureauID: ID du bureau (BV1-BV13, + ligne TOTAL)
- Inscrits, Votants, Blancs, Nuls, Exprimes: Nombres
- L1_Voix, L2_Voix, etc.: Voix par liste (colonnes dynamiques selon candidats actifs)
- SaisiPar: Email utilisateur saisie
- ValidePar: Email utilisateur validation
- Timestamp: Date/heure validation

**Contrôles automatiques**:
- Votants = Blancs + Nuls + Exprimes
- Somme voix = Exprimes

---

## Feuille 7: Résultats_T2

**Structure identique à Résultats_T1**, mais uniquement pour les 2 listes qualifiées.

**Colonnes dynamiques**: L{X}_Voix et L{Y}_Voix (où X et Y sont les ListeID qualifiés)

---

## Feuille 8: Seats_Municipal

**Objectif**: Calcul des sièges Conseil Municipal

| Tour | ListeID | NomListe | Voix | PctVoix | SiegesMajorite | SiegesProportionnels | SiegesTotal | Eligible |
|------|---------|----------|------|---------|----------------|----------------------|-------------|----------|
| 2 | L1 | Liste 1 | 6200 | 52.67 | 17 | 3 | 20 | TRUE |
| 2 | L2 | Liste 2 | 5570 | 47.33 | 0 | 15 | 15 | TRUE |
| 1 | L3 | Liste 3 | 0 | 0.00 | 0 | 0 | 0 | FALSE |
| 1 | L4 | Liste 4 | 0 | 0.00 | 0 | 0 | 0 | FALSE |
| 1 | L5 | Liste 5 | 0 | 0.00 | 0 | 0 | 0 | FALSE |

**Colonnes**:
- Tour: Tour de calcul (1 ou 2)
- ListeID: Identifiant liste
- NomListe: Nom de la liste
- Voix: Nombre de voix obtenues
- PctVoix: Pourcentage voix
- SiegesMajorite: 50% des sièges (17) pour la liste arrivée en tête
- SiegesProportionnels: Sièges répartis à la proportionnelle (18 restants)
- SiegesTotal: Total sièges obtenus
- Eligible: TRUE si >5% suffrages exprimés

**Règle de calcul**:
1. Seuil: 5% des suffrages exprimés
2. Liste majoritaire: 17 sièges (50% de 35, arrondi inférieur)
3. Reste: 18 sièges à la proportionnelle (plus forte moyenne)

---

## Feuille 9: Seats_Community

**Objectif**: Calcul des sièges Conseil Communautaire (SQY)

| ListeID | NomListe | VoixMunicipal | PctMunicipal | SiegesCommunautaires | Eligible |
|---------|----------|---------------|--------------|----------------------|----------|
| L1 | Liste 1 | 6200 | 52.67 | 3 | TRUE |
| L2 | Liste 2 | 5570 | 47.33 | 3 | TRUE |
| L3 | Liste 3 | 0 | 0.00 | 0 | FALSE |

**Colonnes**:
- ListeID: Identifiant liste
- NomListe: Nom de la liste
- VoixMunicipal: Voix obtenues élection municipale
- PctMunicipal: Pourcentage municipal
- SiegesCommunautaires: Sièges CC obtenus (total = Config.SEATS_COMMUNITY_TOTAL)
- Eligible: TRUE si >5%

**Règle de calcul**: Proportionnelle à la plus forte moyenne sur 6 sièges (paramétrable)

---

## Feuille 10: ElectionsState

**Objectif**: État global de l'élection (utilisé pour synchronisation)

| Clé | Valeur | Timestamp |
|-----|--------|-----------|
| CURRENT_TOUR | 1 | 2026-03-15T08:00:00Z |
| T1_PARTICIPATION_LAST_UPDATE | 2026-03-15T17:30:00Z | 2026-03-15T17:30:00Z |
| T1_RESULTS_VALIDATED | FALSE | 2026-03-15T20:00:00Z |
| T1_CLOSED | FALSE | 2026-03-15T20:00:00Z |
| T2_QUALIFIED_LISTE1 | NULL | NULL |
| T2_QUALIFIED_LISTE2 | NULL | NULL |
| T2_PARTICIPATION_LAST_UPDATE | NULL | NULL |
| T2_RESULTS_VALIDATED | FALSE | NULL |
| T2_CLOSED | FALSE | NULL |
| SEATS_CALCULATED | FALSE | NULL |

---

## Feuille 11: AuditLog

**Objectif**: Traçabilité complète de toutes les actions

| ID | Timestamp | User | Action | Entity | EntityID | Before | After | IP | UserAgent |
|----|-----------|------|--------|--------|----------|--------|-------|----|--------------|
| 1 | 2026-03-15T10:05:00Z | user@mail.com | UPDATE | Participation_T1 | BV1 | {"votants":0} | {"votants":125} | 192.168.1.10 | Mozilla/5.0... |
| 2 | 2026-03-15T21:30:00Z | admin@mail.com | VALIDATE | Résultats_T1 | BV1 | {} | {"validated":true} | 192.168.1.5 | Mozilla/5.0... |
| 3 | 2026-03-15T22:00:00Z | admin@mail.com | CALCULATE | Seats_Municipal | ALL | {} | {"L1":20,"L2":15} | 192.168.1.5 | Mozilla/5.0... |

**Colonnes**:
- ID: Auto-increment
- Timestamp: ISO 8601 (UTC)
- User: Email utilisateur
- Action: UPDATE / VALIDATE / CALCULATE / DELETE / CONFIG
- Entity: Nom de la feuille/entité modifiée
- EntityID: ID de l'entité (BV1, L1, etc.)
- Before: JSON état avant (si applicable)
- After: JSON état après
- IP: Adresse IP (si disponible)
- UserAgent: Navigateur (si disponible)

---

## Feuille 12: ErrorLog

**Objectif**: Log des erreurs applicatives

| ID | Timestamp | Severity | Source | Message | Stack | User | Context |
|----|-----------|----------|--------|---------|-------|------|---------|
| 1 | 2026-03-15T10:05:30Z | ERROR | googleSheetsService | API quota exceeded | Error: ... | user@mail.com | {"action":"read"} |
| 2 | 2026-03-15T21:15:00Z | WARNING | validateurs | Incohérence votants | Votants != Blancs+Nuls+Exprimés | user@mail.com | {"bureau":"BV3"} |

**Colonnes**:
- ID: Auto-increment
- Timestamp: ISO 8601 (UTC)
- Severity: INFO / WARNING / ERROR / CRITICAL
- Source: Nom du service/composant
- Message: Description erreur
- Stack: Stack trace (si applicable)
- User: Email utilisateur
- Context: JSON contexte additionnel

---

## Accès et Permissions

### Configuration Google Sheets API

1. **Créer un projet Google Cloud**:
   - Console: https://console.cloud.google.com
   - Activer Google Sheets API

2. **Configurer OAuth 2.0**:
   - Type: Application Web
   - URI de redirection: `https://{votre-domaine}.github.io/elections-2026/`
   - Scopes: `https://www.googleapis.com/auth/spreadsheets`

/////////////////////////

702016125879-8t5lau13b7mvifl4ttp2drh2v6871ad4.apps.googleusercontent.com


////////////////////////

google-site-verification=cbe3yPRWqb-EP-ceDxI-bp8z704h1NzPEFKtgrw9KZQ

////////////////////////


3. **Partager le Spreadsheet**:
   - Propriétaire: compte service ou compte admin
   - Éditeurs: utilisateurs autorisés (via email)

https://docs.google.com/spreadsheets/d/1k0ZHelPxIUdgSXbUekhWGIt49Sjrq_Y4IgEB9K1FZP0/edit?usp=sharing


### Sécurité

- **Validation des données**: Côté client avant écriture
- **Formules protégées**: Lignes TOTAL en lecture seule
- **Historique**: Google Sheets conserve l'historique des versions
- **Backup**: Export automatique toutes les heures

---

## Script d'Initialisation

```javascript
// Script Apps Script pour initialisation
function initializeElectionSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Créer toutes les feuilles
  const sheets = [
    'Config', 'Bureaux', 'Candidats',
    'Participation_T1', 'Participation_T2',
    'Résultats_T1', 'Résultats_T2',
    'Seats_Municipal', 'Seats_Community',
    'ElectionsState', 'AuditLog', 'ErrorLog'
  ];
  
  sheets.forEach(name => {
    const sheet = ss.insertSheet(name);
    // Ajouter en-têtes selon structure
  });
  
  // Protéger certaines cellules
  // Initialiser Config avec valeurs par défaut
  // etc.
}
```

---

## Formules Utiles

### Ligne TOTAL dans Résultats_T1
```
=SUM(B2:B14)  // Total Inscrits
=SUM(C2:C14)  // Total Votants
```

### Taux participation
```
=IF(C2>0, (C2/B2)*100, 0)  // TauxPct
```

### Contrôle cohérence
```
=IF(C2=(D2+E2+F2), "OK", "ERREUR")  // Votants = Blancs+Nuls+Exprimés
```

---

## Maintenance

### Backup Quotidien
- Export automatique en XLSX
- Stockage Google Drive + local
- Conservation 30 jours

### Nettoyage Post-Élection
- Archivage données
- Anonymisation si nécessaire (RGPD)
- Conservation légale: 1 an minimum

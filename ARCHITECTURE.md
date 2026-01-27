# Architecture Application Élections Municipales 2026

## Vue d'ensemble

Application React SPA (Single Page Application) pour la gestion complète des élections municipales et communautaires, avec Google Sheets comme unique backend.

## Stack Technique

- **Frontend**: React 18 + Hooks
- **Build Tool**: Vite
- **Hébergement**: GitHub Pages
- **Backend**: Google Sheets API v4
- **Authentification**: OAuth 2.0 (PKCE)
- **Stockage local**: localStorage (sessions uniquement)

## Architecture des Composants

```
src/
├── main.jsx                    # Point d'entrée React
├── App.jsx                     # Composant racine + routing
├── styles/
│   ├── App.css                 # Styles globaux
│   ├── variables.css           # Variables CSS (couleurs, etc.)
│   └── components/             # Styles par composant
├── services/
│   ├── googleSheetsService.js  # Service API Google Sheets
│   ├── authService.js          # Service OAuth 2.0
│   ├── calculService.js        # Calculs sièges & statistiques
│   ├── exportService.js        # Exports PDF & Excel
│   └── auditService.js         # Traçabilité
├── components/
│   ├── auth/
│   │   └── LoginPage.jsx       # Page de connexion OAuth
│   ├── layout/
│   │   ├── Header.jsx          # En-tête app
│   │   ├── Navigation.jsx      # Menu principal
│   │   └── Footer.jsx          # Pied de page
│   ├── dashboard/
│   │   └── Dashboard.jsx       # Tableau de bord principal
│   ├── participation/
│   │   ├── ParticipationSaisie.jsx     # Saisie par bureau
│   │   ├── ParticipationTableau.jsx    # Vue consolidée
│   │   └── ParticipationStats.jsx      # Statistiques temps réel
│   ├── resultats/
│   │   ├── ResultatsSaisieBureau.jsx   # Saisie résultats par BV
│   │   ├── ResultatsConsolidation.jsx  # Consolidation communale
│   │   ├── ResultatsValidation.jsx     # Validation & contrôles
│   │   └── ResultatsClassement.jsx     # Classement final
│   ├── secondTour/
│   │   ├── PassageSecondTour.jsx       # Gestion passage T2
│   │   └── ConfigurationT2.jsx         # Configuration T2
│   ├── sieges/
│   │   ├── SiegesMunicipal.jsx         # Calcul CM
│   │   └── SiegesCommunautaire.jsx     # Calcul CC
│   ├── admin/
│   │   ├── ConfigBureaux.jsx           # Gestion bureaux
│   │   ├── ConfigCandidats.jsx         # Gestion candidats
│   │   └── AuditLog.jsx                # Journal d'audit
│   └── exports/
│       ├── ExportPDF.jsx               # Export PDF
│       └── ExportExcel.jsx             # Export Excel
├── hooks/
│   ├── useGoogleSheets.js      # Hook API Sheets
│   ├── useAuth.js              # Hook authentification
│   └── useElectionState.js     # Hook état élection
└── utils/
    ├── validators.js           # Validation données
    ├── formatters.js           # Formatage affichage
    ├── constants.js            # Constantes (bureaux, dates)
    └── electionRules.js        # Règles électorales

```

## Flux de Données

### 1. Authentification
```
User → OAuth 2.0 PKCE → Google → Access Token → localStorage
```

### 2. Lecture Données
```
Component → useGoogleSheets → googleSheetsService → API Sheets → State
```

### 3. Écriture Données
```
Component → Action → googleSheetsService → API Sheets → Audit → Refresh State
```

### 4. Calculs
```
Données Sheets → calculService → Résultats → Display + Save
```

## Sécurité

### Authentification
- OAuth 2.0 avec PKCE (Proof Key for Code Exchange)
- Scopes minimaux nécessaires: `spreadsheets`
- Token stocké en localStorage (session uniquement)
- Rafraîchissement automatique des tokens

### Validation
- Validation côté client de toutes les saisies
- Contrôles de cohérence (votants = blancs + nuls + exprimés)
- Vérification des doublons
- Blocages automatiques en cas d'incohérence

### Audit
- Traçabilité complète de toutes les actions
- Log dans feuille AuditLog
- Format: {user, action, before, after, timestamp, bureau}

## Gestion d'État

### État Application
- Tour actif (T1/T2)
- Statut élection (En cours / Clôturé)
- Configuration bureaux et candidats
- Données participation et résultats

### État Local (localStorage)
- Token OAuth
- Préférences utilisateur
- Cache temporaire (invalidé après refresh)

## Règles Électorales Implémentées

### Passage Second Tour
1. Classement automatique après clôture T1
2. Sélection automatique des 2 premiers
3. Génération configuration T2
4. Verrouillage liste (override admin si égalité)

### Calcul Sièges Conseil Municipal
- Total sièges: 35 (commune >20k habitants)
- 50% à la liste majoritaire (17 sièges)
- Reste à la proportionnelle à la plus forte moyenne
- Seuil: 5% des suffrages exprimés

### Calcul Sièges Conseil Communautaire
- Répartition proportionnelle selon résultats municipaux
- Nombre de sièges: paramétrable (selon SQY)
- Application règle préfectorale

## Performance

### Optimisations
- Lazy loading des composants
- Debounce sur saisies
- Cache API Sheets (invalidation intelligente)
- Calculs asynchrones (Web Workers si nécessaire)

### Contraintes Temps Réel
- Rafraîchissement toutes les 30s pour participation
- Mise à jour manuelle pour résultats (validation requise)
- Notifications push (si activées)

## Déploiement GitHub Pages

### Configuration
```javascript
// vite.config.js
export default {
  base: '/elections-2026/',
  build: {
    outDir: 'dist'
  }
}
```

### Routing
- Utilisation de Hash Router (#/)
- Compatible GitHub Pages (pas de config serveur)

### Process CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy
on: push
jobs:
  build-deploy:
    - npm run build
    - deploy to gh-pages branch
```

## Structure Google Sheets

Voir fichier `GOOGLE_SHEETS_STRUCTURE.md` pour détails complets.

Feuilles principales:
1. Config (paramètres app)
2. Bureaux (13 BV)
3. Candidats (listes et candidats)
4. Participation_T1, Participation_T2
5. Résultats_T1, Résultats_T2
6. Seats_Municipal, Seats_Community
7. ElectionsState (état global)
8. AuditLog (traçabilité)
9. ErrorLog (erreurs)

## Points d'Attention Jour J

### Avant 08h00
- Vérifier connexion Google Sheets
- Tester authentification tous les utilisateurs
- Valider configuration bureaux et candidats
- Backup Google Sheets

### Pendant le scrutin (08h-20h)
- Saisie participation horaire
- Monitoring automatique
- Alertes incohérences

### Après 20h00
- Saisie résultats par bureau
- Validation automatique
- Consolidation communale
- Calcul sièges
- Exports officiels

### Sécurité Jour J
- Backup horaire automatique
- Log toutes actions
- Mode lecture seule après validation finale
- Export PDF horodaté

## Maintenance

### Logs
- ErrorLog dans Google Sheets
- Console navigateur (mode dev)
- Alertes email (via Apps Script)

### Backup
- Export automatique toutes les heures
- Stockage Drive + local
- Versionning Google Sheets (historique)

### Support
- Documentation utilisateur intégrée
- Tooltips contextuels
- FAQ intégrée
- Contact support (admin)

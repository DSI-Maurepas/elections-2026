# Application Élections Municipales 2026

Application web complète pour la gestion des élections municipales et communautaires 2026 - Maurepas.

## 📋 Vue d'ensemble

Cette application permet de gérer l'ensemble du processus électoral :
- Saisie de la participation horaire (08h-20h)
- Saisie et validation des résultats par bureau
- Consolidation communale automatique
- Passage automatique au 2nd tour
- Calcul réglementaire des sièges (Conseil Municipal et Communautaire)
- Exports PDF et Excel
- Traçabilité complète

## 🏗️ Architecture

- **Frontend**: React 18 + Hooks
- **Build**: Vite
- **Routing**: React Router v6 (Hash Router pour GitHub Pages)
- **Backend**: Google Sheets API v4 (unique)
- **Authentification**: OAuth 2.0 (Google)
- **Hébergement**: GitHub Pages

## 📦 Installation

### Prérequis

- Node.js 18+ et npm
- Compte Google (pour l'API Sheets)
- Git

### Étape 1: Cloner le projet

```bash
git clone <url-du-repo>
cd elections-2026
npm install
```

### Étape 2: Configuration Google Cloud

#### 2.1 Créer un projet Google Cloud

1. Aller sur https://console.cloud.google.com
2. Créer un nouveau projet "Elections-Maurepas-2026"
3. Activer l'API Google Sheets :
   - Menu → APIs & Services → Library
   - Rechercher "Google Sheets API"
   - Cliquer sur "Enable"

#### 2.2 Configurer OAuth 2.0

1. Menu → APIs & Services → Credentials
2. Cliquer sur "Create Credentials" → "OAuth client ID"
3. Type d'application : **Application Web**
4. Nom : "Elections Municipales 2026"
5. URI de redirection autorisés :
   - Pour dev : `http://localhost:3000`
   - Pour prod : `https://votre-username.github.io/elections-2026/`
6. Copier le **Client ID** généré

#### 2.3 Créer le Google Spreadsheet

1. Aller sur Google Sheets
2. Créer un nouveau Spreadsheet "Elections Maurepas 2026"
3. Créer les feuilles suivantes (voir `GOOGLE_SHEETS_STRUCTURE.md` pour détails) :
   - Config
   - Bureaux
   - Candidats
   - Participation_T1
   - Participation_T2
   - Résultats_T1
   - Résultats_T2
   - Seats_Municipal
   - Seats_Community
   - ElectionsState
   - AuditLog
   - ErrorLog

4. Partager le Spreadsheet avec les utilisateurs autorisés
5. Copier l'**ID du Spreadsheet** (dans l'URL : `https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit`)

### Étape 3: Configuration environnement

Créer un fichier `.env` à la racine :

```env
VITE_GOOGLE_CLIENT_ID=votre-client-id-google.apps.googleusercontent.com
VITE_SPREADSHEET_ID=votre-spreadsheet-id
```

### Étape 4: Initialiser Google Sheets

Utiliser le script d'initialisation fourni ou remplir manuellement :

1. **Config** : Ajouter les paramètres (voir structure)
2. **Bureaux** : Ajouter les 13 bureaux de vote
3. **Candidats** : Ajouter les listes/candidats

## 🚀 Développement

```bash
# Lancer le serveur de dev
npm run dev

# Build de production
npm run build

# Preview du build
npm run preview
```

L'application sera accessible sur `http://localhost:3000`

## 📤 Déploiement GitHub Pages

### Configuration initiale

1. Sur GitHub, créer un repo "elections-2026"
2. Mettre à jour `vite.config.js` avec le bon `base` :

```javascript
export default defineConfig({
  base: '/elections-2026/', // Nom de votre repo
  // ...
});
```

### Déploiement

```bash
# Build et déploiement
npm run deploy
```

Ou manuellement :

```bash
npm run build
git add dist -f
git commit -m "Deploy"
git subtree push --prefix dist origin gh-pages
```

L'application sera accessible sur : `https://votre-username.github.io/elections-2026/`

⚠️ **Important** : Ajouter cette URL dans les URI de redirection OAuth (Google Cloud Console)

## 📖 Guide d'utilisation - Jour J

### Avant 08h00 (Préparation)

1. **Vérifications techniques** :
   - [ ] Connexion internet opérationnelle
   - [ ] Tous les utilisateurs peuvent se connecter
   - [ ] Google Sheets accessible
   - [ ] Configuration validée (bureaux, candidats, sièges)

2. **Backup** :
   - [ ] Export complet du Spreadsheet
   - [ ] Copie de sauvegarde locale

### De 08h00 à 20h00 (Participation)

1. Accéder à "Participation Tour 1"
2. Sélectionner un bureau
3. Saisir les votants aux horaires recommandés : **10h, 12h, 17h, 20h**
4. Valider la saisie

**Consolidation automatique** : Les totaux sont calculés en temps réel.

### Après 20h00 (Résultats)

#### 1. Saisie des résultats par bureau

1. Accéder à "Résultats Tour 1"
2. Pour chaque bureau :
   - Saisir : Inscrits, Votants, Blancs, Nuls, Exprimés
   - Saisir les voix par candidat
   - **Contrôles automatiques** :
     - Votants = Blancs + Nuls + Exprimés ✓
     - Somme voix = Exprimés ✓
   - Valider

#### 2. Consolidation et classement

- Accéder à "Résultats Tour 1" → Onglet "Consolidation"
- Vérifier les totaux communaux
- Consulter le classement

#### 3. Passage au 2nd tour (si nécessaire)

1. Accéder à "Second Tour"
2. L'application affiche :
   - Les 2 listes qualifiées automatiquement
   - Ou un message "Majorité absolue - Pas de 2nd tour"
3. Si égalité : intervention manuelle requise
4. Valider le passage au 2nd tour → **Active automatiquement les 2 listes pour T2**

#### 4. Calcul des sièges

1. Accéder à "Sièges Conseil Municipal"
2. Cliquer sur "Calculer les sièges"
3. L'application affiche :
   - Répartition détaillée par liste
   - Prime majoritaire (17 sièges pour >20k hab)
   - Sièges proportionnels (18 sièges)
4. Valider et enregistrer

5. Répéter pour "Sièges Conseil Communautaire"

#### 5. Exports

1. Accéder à "Exports"
2. Générer :
   - PV de résultats (PDF/HTML imprimable)
   - Export Excel participation
   - Export Excel résultats
   - Export Excel sièges
3. Sauvegarder localement

### Sécurité Jour J

- **Traçabilité** : Toutes les actions sont enregistrées dans AuditLog
- **Validation** : Impossible de modifier un résultat validé sans trace
- **Backup horaire** : Recommandé (manuel ou automatique)
- **Mode lecture seule** : Après validation finale, activer si nécessaire

## 🔧 Configuration

### Nombre de sièges

Par défaut (commune >20k habitants) :
- Conseil Municipal : 35 sièges
- Conseil Communautaire : 6 sièges (SQY, à vérifier)

Pour modifier :
1. Accéder au Spreadsheet → Feuille "Config"
2. Modifier `SEATS_MUNICIPAL_TOTAL` ou `SEATS_COMMUNITY_TOTAL`

### Bureaux de vote

Modifier dans le Spreadsheet → Feuille "Bureaux" :
- Ajouter/Retirer des bureaux
- Mettre à jour les membres (Président, Secrétaire)
- Désactiver un bureau : mettre `Actif` à `FALSE`

### Candidats

Modifier dans le Spreadsheet → Feuille "Candidats" :
- Ajouter une liste : nouvelle ligne
- Format ListeID : L1, L2, L3, etc.
- Définir la couleur (hexadécimal)
- Ordre d'affichage

## 📊 Règles électorales implémentées

### Seuil d'éligibilité
- 5% des suffrages exprimés

### Conseil Municipal (35 sièges pour >20k habitants)
1. **Prime majoritaire** : 50% des sièges (17) à la liste arrivée en tête
2. **Proportionnelle** : Reste (18 sièges) réparti selon la méthode de la plus forte moyenne
3. Seules les listes >5% sont éligibles

### Conseil Communautaire
- Répartition proportionnelle basée sur les résultats municipaux
- Nombre de sièges paramétrable (défaut : 6 pour SQY)

### Passage au 2nd tour
Un 2nd tour est évité si :
- Une liste obtient >50% des suffrages exprimés ET
- Cette liste obtient >25% des inscrits

Sinon, les 2 premières listes sont qualifiées.

## 🐛 Dépannage

### Problème d'authentification
- Vérifier que le Client ID est correct dans `.env`
- Vérifier les URI de redirection dans Google Cloud Console
- Effacer le cache du navigateur et réessayer

### Erreur "Permission denied" sur Google Sheets
- Vérifier que l'utilisateur a bien accès au Spreadsheet
- Vérifier que l'API Google Sheets est activée
- Vérifier les scopes OAuth (doit inclure `spreadsheets`)

### Les données ne se chargent pas
- Vérifier la connexion internet
- Vérifier le Spreadsheet ID dans `.env`
- Consulter le journal d'erreurs (Spreadsheet → ErrorLog)

### Quota API dépassé
- Limites Google : 100 requêtes/100 secondes/utilisateur
- Réduire la fréquence de rafraîchissement
- Utiliser le cache local (déjà implémenté)

## 📝 Fichiers importants

- `ARCHITECTURE.md` : Architecture détaillée du projet
- `GOOGLE_SHEETS_STRUCTURE.md` : Structure complète des feuilles Google Sheets
- `src/utils/electionRules.js` : Règles électorales françaises
- `src/services/googleSheetsService.js` : Service API Google Sheets
- `src/utils/validators.js` : Validations des données

## 🤝 Support

Pour toute question ou problème :
1. Consulter la documentation
2. Vérifier les logs (ErrorLog dans Google Sheets)
3. Contacter le DSI

## ⚖️ Licence

Propriété de la Mairie de Maurepas - Usage interne uniquement.

---

**Date de mise à jour** : Janvier 2026  
**Version** : 1.0.0  
**Contact** : DSI Mairie de Maurepas

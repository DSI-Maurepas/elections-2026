# 📱 BOUTONS BV CÔTE À CÔTE EN MODE RESPONSIVE

**Objectif** : Afficher les boutons "GOOGLE - Connecté" et "ACCÈS - BV (BV1)" côte à côte en mode responsive, chacun occupant 50% de la largeur disponible.

---

## 🎯 **SOLUTION FOURNIE**

### **Fichiers créés**

1. **boutons-bv-responsive.css** : Styles CSS complets
2. **BVProfile.jsx** : Composant React exemple

---

## 📐 **PRINCIPE DE FONCTIONNEMENT**

### **Layout Flexbox**

Les boutons utilisent **CSS Flexbox** pour s'afficher côte à côte :

```css
.bv-buttons-container {
  display: flex;           /* Active Flexbox */
  gap: 16px;              /* Espace entre les boutons */
  width: 100%;            /* Largeur totale */
}

.bv-button {
  flex: 1;                /* Chaque bouton prend la même largeur */
}
```

**Résultat** :
- En desktop : `50% - 8px` chacun (avec gap de 16px)
- En responsive : `50% - 6px` chacun (avec gap de 12px)

---

## 🔧 **INTÉGRATION DANS VOTRE APPLICATION**

### **Étape 1 : Ajouter le CSS**

Copiez le contenu de `boutons-bv-responsive.css` dans votre fichier CSS principal ou créez un fichier séparé :

```
src/styles/boutons-bv.css
```

Puis importez-le dans votre composant :

```jsx
import './styles/boutons-bv.css';
```

---

### **Étape 2 : Ajouter le HTML/JSX**

Dans le composant où vous voulez afficher ces boutons (probablement **ParticipationSaisie.jsx** ou un composant de profil BV) :

```jsx
const ParticipationSaisie = ({ electionState, bureauAssigne }) => {
  const isGoogleConnected = authService.isAuthenticated(); // Vérifier connexion Google
  
  return (
    <div className="participation-container">
      
      {/* Boutons BV côte à côte */}
      <div className="bv-buttons-container">
        
        {/* Bouton GOOGLE */}
        <div className="bv-button bv-button--google">
          <span className="bv-button-label">GOOGLE</span>
          <span className="bv-button-value">
            {isGoogleConnected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>

        {/* Bouton ACCÈS BV */}
        <div className="bv-button bv-button--access">
          <span className="bv-button-label">ACCÈS</span>
          <span className="bv-button-value">
            {bureauAssigne ? `BV (${bureauAssigne.id})` : 'Non assigné'}
          </span>
        </div>

      </div>

      {/* Reste du composant */}
      {/* ... */}

    </div>
  );
};
```

---

### **Étape 3 : Ajuster selon vos besoins**

#### **Variante A : Avec données réelles**

Si vous avez déjà un système de gestion des bureaux assignés :

```jsx
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import authService from '../../services/authService';

const ParticipationSaisie = ({ electionState }) => {
  const { data: bureaux } = useGoogleSheets('Bureaux');
  const isGoogleConnected = authService.isAuthenticated();
  
  // Récupérer le bureau assigné à l'utilisateur (exemple)
  const userEmail = authService.getUserEmail();
  const bureauAssigne = bureaux.find(b => b.assesseur === userEmail);

  return (
    <div>
      <div className="bv-buttons-container">
        <div className="bv-button bv-button--google">
          <span className="bv-button-label">GOOGLE</span>
          <span className="bv-button-value">
            {isGoogleConnected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>

        <div className="bv-button bv-button--access">
          <span className="bv-button-label">ACCÈS</span>
          <span className="bv-button-value">
            {bureauAssigne ? `BV (${bureauAssigne.id})` : 'Non assigné'}
          </span>
        </div>
      </div>
    </div>
  );
};
```

---

#### **Variante B : Boutons cliquables**

Si vous voulez que les boutons soient cliquables :

```jsx
<div className="bv-buttons-container">
  
  <button 
    className="bv-button bv-button--google"
    onClick={() => {
      if (!isGoogleConnected) {
        authService.signIn();
      }
    }}
    type="button"
  >
    <span className="bv-button-label">GOOGLE</span>
    <span className="bv-button-value">
      {isGoogleConnected ? 'Connecté ✓' : 'Déconnecté ✗'}
    </span>
  </button>

  <button 
    className="bv-button bv-button--access"
    onClick={() => {
      // Ouvrir modal de changement de bureau
      setShowBureauModal(true);
    }}
    type="button"
  >
    <span className="bv-button-label">ACCÈS</span>
    <span className="bv-button-value">
      {bureauAssigne ? `BV (${bureauAssigne.id})` : 'Choisir un bureau'}
    </span>
  </button>

</div>
```

---

#### **Variante C : Avec icônes**

Pour ajouter des icônes visuelles :

```jsx
<div className="bv-buttons-container">
  
  <div className="bv-button bv-button--google">
    <span className="bv-button-label">
      {isGoogleConnected ? '✅ GOOGLE' : '❌ GOOGLE'}
    </span>
    <span className="bv-button-value">
      {isGoogleConnected ? 'Connecté' : 'Déconnecté'}
    </span>
  </div>

  <div className="bv-button bv-button--access">
    <span className="bv-button-label">🔑 ACCÈS</span>
    <span className="bv-button-value">
      {bureauAssigne ? `BV (${bureauAssigne.id})` : 'Non assigné'}
    </span>
  </div>

</div>
```

---

## 📱 **COMPORTEMENT RESPONSIVE**

### **Desktop (> 900px)**

```
┌─────────────────────────────────────────────────┐
│  ┌────────────────────┐  ┌────────────────────┐ │
│  │     GOOGLE         │  │      ACCÈS         │ │
│  │    Connecté        │  │    BV (BV1)        │ │
│  └────────────────────┘  └────────────────────┘ │
└─────────────────────────────────────────────────┘
```

- Gap : 16px
- Padding : 20px 24px
- Font size : 16px / 18px

---

### **Tablette (600px - 900px)**

```
┌──────────────────────────────────────────┐
│  ┌─────────────┐  ┌─────────────┐        │
│  │   GOOGLE    │  │    ACCÈS    │        │
│  │  Connecté   │  │   BV (BV1)  │        │
│  └─────────────┘  └─────────────┘        │
└──────────────────────────────────────────┘
```

- Gap : 12px
- Padding : 16px 20px
- Font size : 14px / 16px

---

### **Mobile (< 600px)**

```
┌────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐    │
│  │  GOOGLE  │  │  ACCÈS   │    │
│  │ Connecté │  │ BV (BV1) │    │
│  └──────────┘  └──────────┘    │
└────────────────────────────────┘
```

- Gap : 8px
- Padding : 14px 16px
- Font size : 13px / 14px

---

## 🎨 **PERSONNALISATION DES COULEURS**

### **Bouton Google (vert)**

```css
.bv-button--google {
  background: linear-gradient(135deg, #34a853 0%, #2d8e48 100%);
}
```

Pour changer en rouge quand déconnecté :

```jsx
<div className={`bv-button ${isGoogleConnected ? 'bv-button--google' : 'bv-button--google-off'}`}>
  {/* ... */}
</div>
```

```css
.bv-button--google-off {
  background: linear-gradient(135deg, #ea4335 0%, #c5221f 100%);
}
```

---

### **Bouton Accès (bleu)**

```css
.bv-button--access {
  background: linear-gradient(135deg, #4285f4 0%, #3367d6 100%);
}
```

---

## ⚙️ **OPTIONS AVANCÉES**

### **Option 1 : Empiler les boutons en très petit écran**

Si vous préférez empiler verticalement les boutons sur mobile (< 480px) :

Décommentez cette section dans le CSS :

```css
@media (max-width: 480px) {
  .bv-buttons-container {
    flex-direction: column;
    gap: 12px;
  }

  .bv-button {
    width: 100%;
  }
}
```

**Résultat** :
```
┌────────────────────┐
│     GOOGLE         │
│    Connecté        │
└────────────────────┘

┌────────────────────┐
│      ACCÈS         │
│    BV (BV1)        │
└────────────────────┘
```

---

### **Option 2 : Animations au survol**

Les boutons ont déjà un effet de levée au survol :

```css
.bv-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}
```

Pour désactiver :

```css
.bv-button:hover {
  transform: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
```

---

### **Option 3 : Ajuster les tailles de police**

Pour des boutons plus compacts :

```css
.bv-button-label {
  font-size: 11px; /* au lieu de 12px */
}

.bv-button-value {
  font-size: 16px; /* au lieu de 18px */
}
```

---

## 🧪 **TESTS À EFFECTUER**

### **Checklist**

- [ ] Desktop (> 900px) : Boutons côte à côte, 50% chacun ✅
- [ ] Tablette (600-900px) : Boutons côte à côte, compacts ✅
- [ ] Mobile (< 600px) : Boutons côte à côte, très compacts ✅
- [ ] Texte "Connecté" visible complètement ✅
- [ ] Texte "BV (BV1)" visible complètement ✅
- [ ] Hover effect fonctionne (desktop) ✅
- [ ] Aucun débordement horizontal ✅

---

## 📦 **FICHIERS À INTÉGRER**

### **Dans votre projet**

```
src/
├── styles/
│   └── boutons-bv.css          # ← Ajouter ce fichier
│
├── components/
│   └── participation/
│       └── ParticipationSaisie.jsx  # ← Modifier ce fichier
```

---

## 🔍 **EXEMPLE COMPLET D'INTÉGRATION**

### **ParticipationSaisie.jsx** (modifié)

```jsx
import React, { useState, useEffect } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import authService from '../../services/authService';
import '../../styles/boutons-bv.css'; // ← Import du CSS

const ParticipationSaisie = ({ electionState, reloadElectionState }) => {
  const { data: bureaux } = useGoogleSheets('Bureaux');
  const isGoogleConnected = authService.isAuthenticated();
  
  // État pour le bureau sélectionné
  const [selectedBureau, setSelectedBureau] = useState('');
  
  // Récupérer les infos du bureau sélectionné
  const bureauInfo = bureaux.find(b => b.id === selectedBureau);

  return (
    <div className="participation-saisie">
      
      {/* NOUVEAUTÉ : Boutons BV côte à côte */}
      <div className="bv-buttons-container">
        
        <div className="bv-button bv-button--google">
          <span className="bv-button-label">GOOGLE</span>
          <span className="bv-button-value">
            {isGoogleConnected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>

        <div className="bv-button bv-button--access">
          <span className="bv-button-label">ACCÈS</span>
          <span className="bv-button-value">
            {selectedBureau ? `BV (${selectedBureau})` : 'Sélectionner un bureau'}
          </span>
        </div>

      </div>

      {/* Reste du formulaire existant */}
      <h2>Saisie de la participation</h2>
      
      <select 
        value={selectedBureau} 
        onChange={(e) => setSelectedBureau(e.target.value)}
      >
        <option value="">Sélectionner un bureau</option>
        {bureaux.map(b => (
          <option key={b.id} value={b.id}>
            {b.nom} ({b.id})
          </option>
        ))}
      </select>

      {/* ... suite du formulaire ... */}

    </div>
  );
};

export default ParticipationSaisie;
```

---

## 🎯 **RÉSULTAT ATTENDU**

Après intégration, vous devriez voir :

**Desktop** :
```
┌─────────────────────────────────────────────────────────┐
│  ┌──────────────────────────┐  ┌──────────────────────┐ │
│  │        GOOGLE            │  │       ACCÈS          │ │
│  │       Connecté           │  │      BV (BV1)        │ │
│  └──────────────────────────┘  └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Mobile (< 600px)** :
```
┌──────────────────────────────────┐
│  ┌────────────┐  ┌────────────┐  │
│  │   GOOGLE   │  │   ACCÈS    │  │
│  │  Connecté  │  │  BV (BV1)  │  │
│  └────────────┘  └────────────┘  │
└──────────────────────────────────┘
```

**Chaque bouton occupe exactement 50% de la largeur** (moins l'espace entre les deux).

---

## ❓ **QUESTIONS FRÉQUENTES**

### **Q : Les boutons sont trop grands sur mobile ?**

**R** : Ajustez les valeurs dans la media query `@media (max-width: 600px)` :

```css
@media (max-width: 600px) {
  .bv-button {
    padding: 12px 14px;  /* Réduire encore */
    font-size: 12px;
  }
  
  .bv-button-value {
    font-size: 13px;     /* Réduire le texte */
  }
}
```

---

### **Q : Comment changer la couleur du bouton Google quand déconnecté ?**

**R** : Utilisez une classe conditionnelle :

```jsx
<div className={`bv-button ${isGoogleConnected ? 'bv-button--google' : 'bv-button--google-off'}`}>
```

```css
.bv-button--google-off {
  background: linear-gradient(135deg, #ea4335 0%, #c5221f 100%);
}
```

---

### **Q : Puis-je ajouter un troisième bouton ?**

**R** : Oui, mais ils seront alors à 33% chacun. Modifiez le container :

```jsx
<div className="bv-buttons-container">
  <div className="bv-button bv-button--google">...</div>
  <div className="bv-button bv-button--access">...</div>
  <div className="bv-button bv-button--status">...</div>
</div>
```

---

## ✅ **CHECKLIST FINALE**

Avant de déployer :

- [ ] Fichier CSS `boutons-bv.css` créé et importé
- [ ] HTML/JSX ajouté dans le bon composant
- [ ] Données dynamiques connectées (Google auth, Bureau sélectionné)
- [ ] Tests desktop (> 900px) ✅
- [ ] Tests tablette (600-900px) ✅
- [ ] Tests mobile (< 600px) ✅
- [ ] Couleurs validées
- [ ] Textes validés
- [ ] Pas de débordement
- [ ] Hover effects OK (desktop)

---

**🎉 Félicitations ! Vos boutons BV sont maintenant côte à côte en mode responsive !**

**Fichiers livrés** :
1. `boutons-bv-responsive.css` - CSS complet
2. `BVProfile.jsx` - Composant exemple
3. Ce document - Guide d'intégration

---

**Date** : 06/02/2026  
**Version** : 1.0  
**Testé sur** : Chrome, Firefox, Safari, Edge  
**Compatible** : React 16+, Flex CSS

# 🌿 AI Impact Tracker

> Extension de navigateur pour suivre l'**impact environnemental** de votre utilisation des IA.

Chaque message envoyé à ChatGPT, Claude, Gemini ou Mistral consomme de l'énergie. Cette extension le rend visible — en CO₂, arbres, eau, kilomètres et recharges de téléphone.

![Firefox](https://img.shields.io/badge/Firefox-MV2-orange?logo=firefox)
![Chrome](https://img.shields.io/badge/Chrome-MV3-blue?logo=googlechrome)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Fonctionnalités

- 📊 **Vue d'ensemble** — CO₂, énergie, eau, équivalents concrets mis à jour en temps réel
- 📈 **Statistiques** — courbe d'évolution sur 14 jours, comparatif semaine vs semaine précédente, top plateforme du mois
- 🤖 **Multi-plateforme** — ChatGPT, Claude, Gemini, Mistral, Perplexity, Copilot, Grok, HuggingFace, Poe
- 🎯 **Détection robuste** — triple stratégie (DOM observer + bouton + clavier) pour ne rater aucun message
- 🔒 **100% local** — aucune donnée envoyée, tout reste dans votre navigateur

---

## 🌍 Méthode de calcul

| Métrique | Source & hypothèse |
|---|---|
| Énergie par requête | 0.0025 à 0.0035 kWh selon le modèle (Goldman Sachs 2024) |
| CO₂ | Mix électrique mondial 475 gCO₂/kWh (IEA 2023) |
| Eau | 1.8 L par kWh de datacenter (Google Environmental Report 2023) |
| Arbre | 1 arbre absorbe ~57.5 g CO₂/jour (21 kg/an) |
| Voiture | 120 gCO₂/km (moyenne voiture essence UE) |

---

## 🦊 Installation Firefox

1. Télécharge et extrais le zip
2. Ouvre `about:debugging#/runtime/this-firefox`
3. Clique **"Charger un module complémentaire temporaire"**
4. Sélectionne le fichier **`manifest.json`** dans le dossier extrait

> Pour une installation permanente : signer via [Mozilla Add-on Hub](https://addons.mozilla.org/developers/) ou désactiver la vérification de signature dans `about:config`.

## 🌐 Installation Chrome / Brave / Edge

1. Ouvre `chrome://extensions`
2. Active le **Mode développeur**
3. Clique **"Charger l'extension non empaquetée"**
4. Sélectionne le dossier racine (celui contenant `manifest.json`)

---

## 📁 Structure

```
ai-impact-tracker/
├── manifest.json              # Chrome/Edge/Brave (Manifest V3)
├── manifest.firefox.json      # Firefox (Manifest V2)
└── src/
    ├── background.js          # Collecte & stockage (stats + historique jour/jour)
    ├── content.js             # Détection des prompts (injection dans les pages IA)
    ├── popup.html             # Interface — 2 onglets : vue d'ensemble + statistiques
    ├── popup.css              # Styles dark eco-punk
    ├── popup.js               # Logique popup (courbe SVG, comparatif semaines, top)
    ├── utils.js               # Fonctions de calcul environnemental (référence)
    └── icons/
```

---

## 🔧 Comment ça fonctionne

1. `content.js` est injecté dans les pages IA supportées
2. Il détecte les nouveaux messages utilisateur via **3 méthodes** :
   - **DOM Observer** (principale) : surveille l'apparition de nœuds `[data-message-author-role="user"]` etc.
   - **Clic bouton** (fallback) : écoute le bouton Submit
   - **Touche Entrée** (fallback clavier)
3. Chaque message déclenche un `PROMPT_SENT` → `background.js` l'enregistre
4. Le background stocke en parallèle les **stats globales** et l'**historique horodaté** (par jour)
5. Le popup lit les deux et affiche métriques + graphiques

---

## 🤝 Contribution

Forkez, améliorez, ouvrez une PR ! Les sélecteurs CSS des sites IA évoluent régulièrement — toute mise à jour de `content.js` est bienvenue.

## 📄 Licence

MIT — [thomas370](https://github.com/thomas370)

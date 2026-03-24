# 🎓 Générateur de plan de classe

Application web permettant de générer automatiquement un plan de classe
optimisé à partir d'une liste d'élèves.

## ✨ Fonctionnalités

### 👩‍🎓 Gestion des élèves

-   Ajout manuel (nom + genre)
-   Import CSV depuis Pronote
-   Marquage des élèves à placer devant

### 🏫 Configuration de la salle

-   Nombre de lignes et colonnes personnalisable
-   Édition visuelle de la salle :
    -   Activer / désactiver des places
    -   Tables de 1
    -   Tables de 2
    -   Doubles tables (2+2)
-   Réinitialisation rapide de la disposition

### ⚙️ Règles de placement

-   Placement prioritaire devant
-   Alternance fille / garçon
-   Paires à éloigner
-   Paires interdites côte à côte

### 🤖 Génération automatique

-   Algorithme d'optimisation
-   Score du plan généré
-   Détection des problèmes

### 💾 Sauvegarde / Export

-   Sauvegarde du projet en JSON
-   Chargement d'un projet
-   Export en SVG (image du plan de classe)

### 📖 Page d'aide intégrée

-   Explication complète des fonctionnalités directement dans
    l'application

## 🚀 Installation

``` bash
npm install
npm run dev
```

Puis ouvrir : http://localhost:5173

## 🧠 Fonctionnement de l'algorithme

L'application utilise une approche heuristique : - génération aléatoire
de placements - optimisation par échanges successifs - scoring basé sur
: - contraintes respectées - distance entre élèves - mixité - position
devant

## 📂 Structure du projet

src/ ├── App.tsx ├── main.tsx └── index.css

## 🛠️ Stack technique

-   React + Vite
-   TypeScript
-   Tailwind CSS

## 📌 Roadmap

-   Export PNG / PDF
-   Rotation des tables
-   Dispositions prédéfinies
-   Drag & drop
-   Multi-classes

## 📜 Licence

MIT

# TerraTrace

TerraTrace est un prototype Vue 3 qui affiche toutes les traces sportives Strava d'un utilisateur sur une seule carte. L'objectif produit est de donner une vue globale et motivante des endroits deja parcourus, sans refaire les fonctionnalites classiques de Strava.

## Fonctionnalites

- Connexion Strava via OAuth.
- Import automatique apres autorisation Strava.
- Affichage des trajets dans une couche MapLibre unique.
- Statistiques globales : activites, distance, temps, denivele positif.
- Stockage local des traces dans IndexedDB.
- Preferences visuelles dans `localStorage`.
- Themes MapLibre dont Fiord et Dark Matter personnalises.
- Menu responsive avec burger sur mobile.
- Mode chaleur visuel et reglage d'opacite pour personnaliser les traces.
- Mode photo avec cadrage libre, stats configurables, texte perso et export PNG.

## Stack

- Vue 3
- Vite
- MapLibre GL
- IndexedDB avec `idb`
- Middleware Vite local pour l'API Strava

## Installation

```bash
npm install
```

Creer ensuite un fichier `.env.local` a partir de `.env.local.example` :

```bash
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
```

Le fichier `.env.local` est ignore par Git.

## Lancer le projet

```bash
npm run dev
```

URL locale :

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

Vite peut afficher un warning sur la taille du bundle MapLibre. Ce n'est pas bloquant pour le prototype.

## Donnees locales

Les traces importees sont stockees dans IndexedDB, pas dans `localStorage` ni `sessionStorage`.

Les preferences UI stockees dans `localStorage` sont :

- couleur des traces
- theme de carte
- mode empreinte

La session OAuth Strava locale est stockee cote serveur dans `.strava-session.json`, ignore par Git.

## Styles de carte

La configuration des styles est dans `src/config/map.js`.

Les styles locaux modifiables avec Maputnik sont dans :

- `public/styles/fiord-custom.json`
- `public/styles/dark-matter.json`

## Notes produit

A ce stade, TerraTrace n'a pas de comptes utilisateurs. C'est volontaire : l'experience cible est un flux tres court, connecter Strava puis voir la carte se remplir.

Un systeme utilisateur deviendra pertinent si l'application ajoute plus tard :

- synchronisation multi-appareils
- cartes publiques partageables
- plusieurs sources sportives
- sauvegarde serveur
- fonctionnalites sociales ou payantes

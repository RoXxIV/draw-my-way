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
- Galerie publique anonyme des cartes partagees.
- Partage Supabase : une seule image publique par compte Strava, remplacee a chaque nouveau partage.

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
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Le fichier `.env.local` est ignore par Git.

## Supabase

La galerie publique utilise Supabase cote serveur uniquement. La cle `SUPABASE_SERVICE_ROLE_KEY`
ne doit jamais etre exposee dans le navigateur.

Dans Supabase SQL Editor, executer :

```sql
-- voir aussi supabase/schema.sql
create table if not exists public.shared_maps (
  id uuid primary key default gen_random_uuid(),
  strava_athlete_id text not null unique,
  image_path text not null,
  image_url text not null,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_maps enable row level security;

insert into storage.buckets (id, name, public)
values ('shared-maps', 'shared-maps', true)
on conflict (id) do update set public = true;
```

La galerie ne renvoie pas `strava_athlete_id` au front. Cet identifiant sert seulement a remplacer
l'ancienne image du meme sportif.

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
- format photo
- position des stats photo

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

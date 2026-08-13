# Mission Codex — POC local de carte cumulative de trajets GPX

## Objectif

Créer une petite application web locale permettant d’importer des fichiers GPX (notamment exportés depuis Garmin Connect) et d’afficher tous les trajets cumulés sur une carte de France.

Il s’agit volontairement d’un **POC** destiné à valider visuellement l’idée. Ne pas surconcevoir le projet et ne pas ajouter de fonctionnalités non demandées.

## Contraintes techniques impératives

- Vue 3 avec Composition API et composants `.vue`.
- JavaScript uniquement : **aucun TypeScript**, aucun fichier `.ts`, aucune configuration TS.
- Vite.
- Application locale sans backend, sans authentification et sans base de données serveur.
- Persistance dans **IndexedDB** afin que les trajets restent disponibles après fermeture ou rechargement de la page.
- Code lisible, composants raisonnablement séparés, sans fichier monolithique.
- Interface et textes en français.
- L'application doit fonctionner avec :

```bash
npm install
npm run dev
```

## Bibliothèques recommandées

- `maplibre-gl` : affichage WebGL de la carte et des lignes GeoJSON.
- `@tmcw/togeojson` : conversion du XML GPX en GeoJSON.
- `idb` : petite surcouche Promise pour IndexedDB.
- `@turf/simplify` : simplification optionnelle des tracés avant stockage et affichage.
- `@turf/bbox` : calcul de l'emprise d'un trajet pour centrer la carte.

Ne pas utiliser Google Maps. Utiliser MapLibre avec un fond de carte compatible sans clé API pour ce POC, par exemple le style public OpenFreeMap. Isoler l'URL du style dans un fichier de configuration pour pouvoir la remplacer facilement.

## Fonctionnalités obligatoires

### 1. Carte

- Afficher au démarrage une carte centrée sur la France métropolitaine.
- La carte doit occuper l'essentiel de la fenêtre.
- Afficher les trajets importés sous forme de lignes clairement visibles au-dessus du fond de carte.
- Tous les trajets précédemment importés restent visibles : la carte représente le cumul des endroits parcourus.
- Prévoir un bouton permettant de recadrer la carte sur l'ensemble des trajets.

### 2. Import GPX

- Ajouter un bouton ou une zone de glisser-déposer acceptant un ou plusieurs fichiers `.gpx`.
- Refuser proprement les autres formats.
- Lire les fichiers uniquement dans le navigateur : aucun upload réseau.
- Convertir chaque GPX en GeoJSON.
- Accepter les namespaces Garmin présents dans les GPX.
- Un GPX peut contenir un ou plusieurs segments de trace.
- Vérifier qu'au moins une géométrie exploitable de type `LineString` ou `MultiLineString` existe.
- Afficher un message utilisateur clair en cas de fichier vide, invalide ou sans trace GPS.

### 3. Informations extraites

Pour chaque activité, conserver si elles existent :

- nom de l'activité, par exemple `Amplepuis Trail` ;
- type d'activité, par exemple `trail_running` ;
- date/heure de début ;
- nom original du fichier ;
- nombre de points GPS ;
- géométrie GeoJSON du trajet.

La fréquence cardiaque, la cadence et les statistiques sportives détaillées ne sont pas nécessaires dans ce POC.

### 4. Persistance locale

- Stocker les activités importées dans IndexedDB avec `idb`.
- Recharger automatiquement les activités au lancement.
- Donner à chaque activité un identifiant stable.
- Empêcher un doublon évident en calculant une empreinte SHA-256 du fichier avec `crypto.subtle.digest` et en utilisant cette empreinte comme identifiant ou clé unique.
- Si le même fichier est réimporté, ne pas le stocker une seconde fois et informer l'utilisateur.

### 5. Gestion minimale des trajets

Afficher un panneau latéral compact contenant :

- la liste des activités importées ;
- leur nom et leur date ;
- le nombre total d'activités ;
- un bouton pour afficher/masquer chaque activité ;
- un bouton pour supprimer une activité ;
- un bouton « Tout supprimer » avec confirmation explicite.

La suppression doit également mettre à jour IndexedDB.

## Gestion des milliers de points

Un fichier Garmin réel peut contenir environ 2 700 points pour seulement 45 minutes. Ce volume est normal et ne doit pas conduire à comparer chaque coordonnée aux anciennes coordonnées.

Pour ce POC :

- conserver chaque activité comme une trace indépendante ;
- afficher les traces superposées, même si certaines portions se recouvrent ;
- ne pas chercher à détecter les portions de route déjà parcourues ;
- ne pas implémenter H3, PostGIS, map matching, grille géographique ou fusion topologique ;
- simplifier modérément la géométrie avec `@turf/simplify` avant stockage, avec une tolérance faible et `highQuality: true` ;
- conserver un rendu suffisamment fidèle lorsqu'on zoome sur le parcours.

Mettre la tolérance de simplification dans une constante clairement nommée afin de pouvoir l'ajuster facilement. Si la simplification produit un résultat invalide, utiliser la géométrie originale.

L'objectif actuel est seulement de vérifier si l'accumulation visuelle des traces est intéressante. La détection des kilomètres réellement nouveaux viendra éventuellement dans une version ultérieure.

## Organisation suggérée

Une structure proche de celle-ci convient :

```text
src/
  components/
    MapView.vue
    ImportGpx.vue
    ActivitySidebar.vue
  composables/
    useActivities.js
  services/
    gpxParser.js
    activityStorage.js
  config/
    map.js
  App.vue
  main.js
  style.css
```

Cette structure est indicative. Garder la solution simple et éviter les abstractions inutiles.

## Interface attendue

- Mise en page desktop prioritaire, mais utilisable sur mobile.
- Carte plein écran ou presque.
- Panneau latéral sobre et rétractable sur petit écran.
- Bouton d'import clairement visible.
- Retour visuel pendant l'analyse d'un fichier.
- Message de succès après import et message d'erreur compréhensible en cas d'échec.
- Aucun framework UI lourd n'est nécessaire. Du CSS simple suffit.

## Hors périmètre

Ne pas développer pour cette première version :

- backend Node/Express ;
- MongoDB, PostgreSQL ou fichier JSON géré par un serveur ;
- comptes utilisateurs ;
- synchronisation automatique Strava ou Garmin ;
- formats FIT, TCX, KML ou CSV ;
- suivi GPS en temps réel ;
- calcul du pourcentage de France visité ;
- détection ou stockage des routes uniques ;
- heatmap ;
- calcul avancé de distance, vitesse, dénivelé ou fréquence cardiaque ;
- système de partage public.

## Données de test

Utiliser le fichier GPX Garmin fourni avec la mission s'il est présent dans le workspace. Il contient notamment :

- un trajet nommé `Amplepuis Trail` ;
- un type `trail_running` ;
- environ 2 728 points GPS ;
- latitude, longitude, altitude et horodatage ;
- des extensions Garmin pour le cardio et la cadence.

Ne pas intégrer ce fichier dans le bundle final. Il sert uniquement au test manuel.

## Critères de validation

Le POC est terminé lorsque :

1. `npm install` puis `npm run dev` démarrent l'application sans erreur.
2. La carte de France s'affiche correctement.
3. L'import du GPX Garmin fourni dessine le parcours au bon emplacement.
4. La page reste fluide avec ce fichier d'environ 2 728 points.
5. Le trajet est toujours présent après actualisation de la page.
6. Réimporter exactement le même fichier ne crée pas de doublon.
7. Plusieurs GPX peuvent être importés et restent visibles simultanément.
8. Chaque activité peut être masquée, réaffichée et supprimée.
9. La console du navigateur ne contient pas d'erreur lors du parcours nominal.
10. Aucun fichier TypeScript n'existe dans le projet.

## Travail attendu de Codex

1. Inspecter le workspace avant de créer le projet et respecter les éventuels fichiers ou instructions déjà présents.
2. Initialiser ou compléter l'application Vue 3/Vite en JavaScript.
3. Implémenter les fonctionnalités décrites sans élargir le périmètre.
4. Tester le build avec `npm run build`.
5. Si possible, lancer l'application et tester l'import du GPX fourni dans le navigateur.
6. Corriger les erreurs rencontrées.
7. À la fin, résumer les fichiers créés, les choix importants et les commandes de lancement.


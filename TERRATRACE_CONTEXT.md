# TerraTrace - Contexte projet

## Vision

TerraTrace est une application web personnelle autour des traces sportives. L'idée centrale n'est pas de refaire Strava, Garmin ou Komoot, mais de proposer une vue que ces apps ne mettent pas assez en avant : tous les trajets d'un utilisateur affiches ensemble sur une carte.

Le ressenti recherche est simple : donner envie de courir, rouler ou marcher dans de nouveaux endroits pour "remplir" la carte. La carte globale des traces est donc le vrai produit.

## Etat actuel

L'application est un prototype local en Vue 3 + Vite avec MapLibre.

Elle permet aujourd'hui :

- de se connecter a Strava via OAuth
- d'importer les activites Strava automatiquement apres autorisation
- de stocker les traces localement dans IndexedDB
- d'afficher toutes les traces en une seule couche GeoJSON allegee
- d'afficher des statistiques globales :
  - nombre d'activites
  - distance totale
  - temps total
  - denivele positif total
- de changer la couleur des traces
- de changer le fond de carte
- d'activer un mode "empreinte" qui masque les details de carte pour garder surtout les frontieres, l'eau et les traces
- de se deconnecter de Strava pour connecter un autre compte
- d'utiliser l'app en responsive avec un menu burger sur mobile

## Experience utilisateur souhaitee

L'experience visee est tres simple :

1. L'utilisateur ouvre TerraTrace.
2. Il clique sur "Connecter Strava".
3. Il autorise l'application sur Strava.
4. La carte se remplit automatiquement avec ses trajets.
5. Il explore sa carte et ses statistiques.

A ce stade, il n'y a pas de creation de compte TerraTrace. Le stockage est local. C'est volontaire : le concept fonctionne deja avec un seul clic Strava, et ajouter des comptes utilisateurs maintenant ajouterait de la friction.

## Interface actuelle

La carte est plein ecran.

Un bloc glassmorphism affiche :

- le titre TerraTrace
- les statistiques "De tout temps (Strava)"
- l'etat de connexion Strava
- le bouton deconnexion Strava
- un bouton pinceau pour ouvrir les reglages visuels

Sur mobile, ce bloc est masque par defaut et s'ouvre avec un bouton burger.

Le menu pinceau contient :

- couleur des traces
- choix du theme de carte
- mode "masquer les details de carte"

## Themes de carte

L'app utilise MapLibre avec des styles OpenFreeMap.

Themes disponibles actuellement :

- Positron
- Bright
- Fiord personnalise
- Dark Matter personnalise
- 3D

Les fichiers locaux de style sont dans :

- `public/styles/fiord-custom.json`
- `public/styles/dark-matter.json`

Le style Fiord a ete modifie pour avoir un fond plus sombre.
Le style Dark Matter contient des ajustements de routes.

## Contraintes importantes

Performance :

- Un gros sportif peut avoir une activite par jour depuis 10 ans.
- Il faut eviter de dessiner trop de donnees brutes.
- L'import Strava utilise les `summary_polyline`, puis allege les points.
- Les traces sont fusionnees dans un seul `MultiLineString` pour reduire le nombre de couches.

Produit :

- Ne pas copier les fonctionnalites deja bien couvertes par Strava.
- La valeur distinctive doit rester la carte globale des traces.
- L'app doit donner envie de retourner courir/rouler ailleurs.
- L'UX doit rester tres directe.

Technique :

- Frontend Vue 3 + Vite
- MapLibre pour la carte
- IndexedDB pour les traces locales
- `localStorage` seulement pour les preferences UI
- Backend local Vite middleware pour Strava OAuth/API

## Donnees et stockage

Les traces sportives sont stockees dans IndexedDB, pas dans `localStorage` ni `sessionStorage`.

Les preferences suivantes sont en `localStorage` :

- couleur des traces
- theme de carte selectionne
- mode "empreinte"

La session Strava locale est stockee cote serveur dans `.strava-session.json`.

## API Strava

L'API Strava fournit :

- la liste des activites
- distance
- temps de deplacement
- denivele positif
- polyline resume du parcours

Limite connue :

- Le denivele negatif n'est pas directement disponible dans la liste standard des activites. Il faudrait appeler les streams detaillees activite par activite, ce qui peut devenir lourd.

## Fonctionnalites envisagees

Idees pertinentes a explorer :

- compteur de couverture par zones ou regions
- heatmap personnelle
- progression annuelle ou mensuelle, mais attention a la performance
- mode "avant/apres" avec une annee selectionnee
- objectifs geographiques : nouvelles communes, nouveaux departements, nouveaux pays
- carte partageable en image ou lien public
- badges orientes exploration, pas performance brute
- detection des zones jamais visitees autour de l'utilisateur
- suggestions de sorties pour relier deux zones deja tracees
- statistiques d'exploration :
  - nombre de villes traversees
  - departements visites
  - pays visites
  - distance de trace unique estimee
- mode impression/poster de la carte

Idees a eviter ou a traiter avec prudence :

- refaire les segments Strava
- refaire les classements de performance
- trop de statistiques classiques deja presentes dans Strava
- imposer un compte utilisateur trop tot
- animations lourdes qui risquent de ramer avec beaucoup d'activites

## Question produit centrale

La question importante pour les prochaines fonctionnalites :

Comment transformer la carte de tous les trajets en objet vivant, utile et motivant, sans simplement dupliquer Strava ?


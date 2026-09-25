# TCAP · Parcours

Site statique (GitHub Pages) présentant les parcours du club. Disposition classique : barre du haut (logo, bouton Partager),
colonne à gauche qui affiche soit la liste (filtres, cases de sélection) soit la fiche du parcours (retour, stats, profil,
description, avis du Chef, D+, terrain), et la carte OpenStreetMap à droite (fond classique ou relief avec tracé coloré par pente).
Sur mobile, la même colonne devient une feuille inférieure arrondie : repliée elle ne montre que son en-tête, un toucher la déplie.

## Arborescence

- `site/` — le site à publier tel quel. Il ne contient **aucune donnée personnelle** : pas de date, d'heure,
  de fréquence cardiaque, d'allure ni de nom d'activité Strava. Seulement le tracé, le profil, le D+, une durée indicative
  et les textes du catalogue.
  - `index.html`, `style.css`, `script.js`, `assets/` (logo)
  - `data/routes.js` — données générées
  - `gpx/*.gpx` — une trace par variante
- `build/catalog.json` — **le fichier à éditer** : nom, type de séance, tags, lieu de départ, description, variantes (ids d'activités Strava).
- `build/catalog-archive.json` — parcours mis de côté (sorties personnelles, hors club). Pour en réactiver un, recopier l'entrée dans `catalog.json`.
- `build/build.py` — régénère `site/data/routes.js` et `site/gpx/` depuis l'export Strava, les tracés `gpx/` et le catalogue.
- `build/tracks/*.gpx` — tracés dessinés (gpx.studio / Nolio), par exemple ceux de Short Orange, simplifiés à 1 m et sans horodatage. Tous partent et arrivent à Keralaurent.
- `export_*/` — export Strava brut (**ne pas publier**, exclu par `.gitignore`).

Les fichiers `build/catalog*.json` contiennent les identifiants d'activités Strava : ils ne sont pas dans `site/`, mais si le dépôt est public, mieux vaut ne pousser que `site/` ou accepter que ces identifiants soient visibles.

## Commandes

```bash
make deps    # pip install fitdecode
make build   # régénère les données du site
make serve   # http://localhost:8765
make open    # build + serve + ouvre le navigateur
make check   # valide catalog.json et la syntaxe de script.js
```

## Publier sur GitHub Pages

1. Créer un dépôt et y pousser **le contenu de `site/`** (à la racine ou dans `docs/`). Ne pas pousser l'export Strava.
2. Settings → Pages → Source : branche `main`, dossier `/` (ou `/docs`).

## Deux niveaux d'usage

- **Niveau complet** (pour l'organisateur) : l'URL de base. Filtres, panier de vote (bouton « Vote » en haut à droite), message WhatsApp généré avec un emoji par parcours.
- **Niveau public** (pour le groupe) : le lien `?ids=…` généré par le panier. Ni filtres, ni panier : seulement les parcours proposés, chacun avec son emoji, la carte et la fiche. C'est ce lien qu'on colle dans le sondage WhatsApp.

## Liens

Toute vue a une URL, à coller dans WhatsApp ou depuis un autre site :

| Lien | Effet |
|---|---|
| `?id=cotes-deolen` | ouvre la fiche d'un parcours (les `id` sont dans `catalog.json`) |
| `?type=trail` | liste filtrée par type : `trail`, `endurance`, `fractionné`, `côtes`, `seuil`, `course`, `ultra` |
| `?start=tous` / `?start=deporte` | départ : par défaut `keralaurent` (rendez-vous du club) |
| `?tag=GR34` | terrain (tags du catalogue) ; `?tag=Short%20Orange` pour les tracés de Short Orange |
| `?dmin=15&dmax=40` | fourchette de distance en km (le curseur « Distance » des filtres) |
| `?ids=3,12,27` | sélection (numéros courts `num` du catalogue, attribués au build et stables ; les slugs sont aussi acceptés) : filtre de base qui ne laisse que ces parcours, chacun dans sa couleur sur la carte ; les autres filtres s'appliquent par-dessus (départ = tous par défaut), « Réinitialiser » l'enlève ; se combine avec `&id=` pour ouvrir une fiche |
| `?mode=relief` | ouvre en fond relief + tracé coloré par pente |

Les paramètres se combinent, par exemple `?type=trail&start=tous&mode=relief` pour « tous les trails du secteur ».
Le site peut aussi être intégré ailleurs dans une `<iframe>`.

## Vote WhatsApp

Sur chaque fiche, le bouton **Ajouter au vote** met le parcours dans une sélection (conservée dans le navigateur). L'icône d'urne dans la barre du haut ouvre un menu : **Voir la sélection sur la carte**, **Exporter vers WhatsApp** (fenêtre avec le titre modifiable, le message, Copier et Ouvrir dans WhatsApp), **Copier le message** et **Vider la sélection**. Les parcours sont toujours classés du plus dur au plus doux (km-effort décroissant) et reçoivent dans cet ordre un emoji de réaction rapide WhatsApp (👍 ❤️ 😂 😮 😢 🙏, au-delà 🔥 💪 🎉 👀). Le message donne pour chacun distance, D+ et type, puis un seul lien court `?ids=3,12,27` vers la carte, et la consigne de vote par réaction.

## Ajouter / modifier un parcours

1. Soit repérer l'id de l'activité dans `export_.../activities.csv` (1re colonne), soit déposer un fichier `.gpx` (sans données personnelles : pas d'horodatage, départ au rendez-vous du club) dans `build/tracks/`.
2. Ajouter une entrée dans `catalog.json` (ou une variante dans un parcours existant : la première variante sert de référence pour la carte). Champs : `id` (slug d'URL), `name`, `type`, `tags`, `start` (commencer par « Locmaria-Plouzané, Keralaurent » pour le filtre par défaut, ou forcer `"start_group": "keralaurent"`), `description`, `chef` (l'avis du Chef), `author` (traceur maison, ex. `Short Orange` : petite chèvre à côté du titre), `variants` avec `{"activity": "<id Strava>"}` ou `{"gpx": "<fichier dans build/tracks/>"}`.
3. `make build`.

Pour un tracé `gpx` il n'y a pas de chrono : la durée est **estimée** (5,3 min par km-effort, allure club médiane, ralentie au-delà de 25 km) et affichée comme telle. Le D+ vient alors du modèle de terrain, généralement 20 à 30 % en dessous de ce qu'annonce une montre.

La difficulté est un km-effort (`km + D+/100`) : < 12 facile, < 18 modéré, < 26 soutenu, < 36 difficile, < 60 très difficile, au-delà « déraisonnable ».
Le type de séance a été déduit des données (répétitions d'allure, répétitions de montée, blocs soutenus) puis fixé à la main dans le catalogue.

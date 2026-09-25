# TCAP · Parcours

Site statique (GitHub Pages) présentant les parcours du club : carte OpenStreetMap plein écran
(fond classique ou relief avec tracé coloré par pente), panneau gauche avec filtres (listes déroulantes) et liste,
panneau droit avec les infos du parcours (stats, profil, description, D+, terrain), GPX et lien partageable.
Sur mobile, deux onglets en haut (Liste, Carte avec le nombre de parcours affichés), un bouton Filtres qui déplie les listes déroulantes, et les infos du parcours dans une modale qui glisse depuis le bas.

## Arborescence

- `site/` — le site à publier tel quel. Il ne contient **aucune donnée personnelle** : pas de date, d'heure,
  de fréquence cardiaque, d'allure ni de nom d'activité Strava. Seulement le tracé, le profil, le D+, une durée indicative
  et les textes du catalogue.
  - `index.html`, `style.css`, `script.js`, `assets/` (logo)
  - `data/routes.js` — données générées
  - `gpx/*.gpx` — une trace par variante
- `build/catalog.json` — **le fichier à éditer** : nom, type de séance, tags, lieu de départ, description, variantes (ids d'activités Strava).
- `build/catalog-archive.json` — parcours mis de côté (sorties personnelles, hors club). Pour en réactiver un, recopier l'entrée dans `catalog.json`.
- `build/build.py` — régénère `site/data/routes.js` et `site/gpx/` depuis l'export Strava + le catalogue.
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

## Liens

Toute vue a une URL, à coller dans WhatsApp ou depuis un autre site :

| Lien | Effet |
|---|---|
| `?id=cotes-deolen` | ouvre la fiche d'un parcours (les `id` sont dans `catalog.json`) |
| `?type=trail` | liste filtrée par type : `trail`, `endurance`, `fractionné`, `côtes`, `seuil`, `course` |
| `?start=tous` / `?start=deporte` | départ : par défaut `keralaurent` (rendez-vous du club) |
| `?tag=GR34` | terrain (tags du catalogue) |
| `?mode=relief` | ouvre en fond relief + tracé coloré par pente |

Les paramètres se combinent, par exemple `?type=trail&start=tous&mode=relief` pour « tous les trails du secteur ».
Le site peut aussi être intégré ailleurs dans une `<iframe>`.

## Ajouter / modifier un parcours

1. Repérer l'id de l'activité dans `export_.../activities.csv` (1re colonne).
2. Ajouter une entrée dans `catalog.json` (ou une variante dans un parcours existant : la première variante sert de référence pour la carte). Champs : `id` (slug d'URL), `name`, `type`, `tags`, `start` (commencer par « Locmaria-Plouzané, Keralaurent » pour le filtre par défaut), `description`, `variants`.
3. `make build`.

La difficulté est un km-effort (`km + D+/100`) : < 12 facile, < 18 modéré, < 26 soutenu, < 36 difficile, au-delà très difficile.
Le type de séance a été déduit des données (répétitions d'allure, répétitions de montée, blocs soutenus) puis fixé à la main dans le catalogue.

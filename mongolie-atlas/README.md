# Atlas Nomade — Mongolie en relief 3D

Carte **3D interactive et 100 % hors-ligne** de la Mongolie : relief réel, types de
terrain (steppe / collines / montagnes / désert), routes classées (asphalte, piste,
off-road, rail), distances, rivières, lacs, provinces, villes et sommets cliquables.

Stack : **Vite + TypeScript + Three.js** (relief 3D) + projection maison type D3.

---

## 🚀 Voir la carte

### Le plus simple (double-clic, aucun outil)
Ouvre **`dist-single/atlas.html`** dans un navigateur. C'est un fichier unique qui
embarque toutes les données — il fonctionne **sans internet** et sans serveur.

> Une copie prête à l'emploi a aussi été déposée à la racine : `../mongolie-carte-3D.html`.

### En développement (rechargement à chaud)
```bash
npm install
npm run dev          # http://localhost:5173
```

### Build classique (assets séparés, à servir)
```bash
npm run build        # -> dist/
npm run preview      # sert dist/ sur http://localhost:4173
```

### Build « fichier unique » (le double-cliquable)
```bash
npm run build:single # -> dist-single/index.html
```

---

## 🔄 Régénérer les données (nécessite internet, une seule fois)

Les données sont déjà générées dans `src/data/`. Pour les reconstruire :

```bash
npm run data:terrain # télécharge les tuiles d'altitude -> heightmap.bin + terrain.bin
npm run data:vectors # Natural Earth -> border/aimags/rivers/lakes.geojson
npm run data:osm     # OpenStreetMap (Overpass) -> roads-osm.geojson + pois.geojson
npm run data:all     # les trois
```

- **Relief** : tuiles *Terrarium* (AWS `elevation-tiles-prod`, domaine public),
  ré-échantillonnées sur une grille lon/lat puis classées par morphologie (rugosité).
- **Vecteurs** : Natural Earth (domaine public), filtrés sur l'emprise mongole.
- **Routes & POI** : OpenStreetMap via Overpass (ODbL) — routes classées par revêtement
  (asphalte/terre/off-road/rail), POI essence/eau/bivouac/mécano/gué.
- **Villes / sommets** : curatés dans `src/data/curated.ts`.
- **Ethnies** : territoires approximatifs (`src/data/ethnos.ts`), chiffres du recensement 2020,
  **validés par 3 audits indépendants** — voir `docs/FACTS.md` et `docs/QUALITY-REPORT.md`.

---

## 🗂️ Structure

```
scripts/      pipeline de données (build-time, peut utiliser internet)
src/
  main.ts     scène, caméra, contrôles, interactions, boucle de rendu
  geo.ts      projection lon/lat <-> monde 3D, échantillonnage du relief
  terrain.ts  maillage 3D coloré par type de terrain (+ ombrage)
  layers.ts   routes, rivières, frontière, provinces, lacs, POI
  ui.ts       HUD : couches, légende, distances, fiches, étiquettes
  data/       données générées + curated.ts (tracé manuel)
```

## 🎛️ Fonctions

- Caméra orbitale (glisser / molette / clic droit) + bouton **Recentrer**.
- Réseau **OpenStreetMap** classé par revêtement : asphalte, pistes de terre, off-road, rail.
- **POI de terrain** activables : stations-essence, sources & eau, bivouacs, mécaniciens, gués.
- **Territoires ethniques** (choroplèthe drapée sur le relief) : Kazakhs, Doukha/Tsaatan, Darkhad,
  Bouriates, Oïrates de l'Ouest, Khotogoïd, Dariganga, Barga/Üzemchin… cliquables (fiche sourcée).
- Couches hydro/admin : rivières, lacs, provinces ; **exagération du relief** réglable.
- Clic sur **ville / sommet / POI / zone ethnique** → fiche dédiée.
- Liste des **itinéraires avec distances** (km, haversine). Repli 2D si WebGL indisponible.

## ✅ Qualité des données

Les informations factuelles sensibles (géographie, routes, **localisation des ethnies**) ont été
auditées par **3 vérificateurs indépendants** (recherche externe, contextes séparés). Corrections
et arbitrages tracés dans `docs/QUALITY-REPORT.md`. Principe : en cas de divergence, on atténue —
aucune donnée non corroborée n'est présentée comme un fait. Les zones ethniques sont **approximatives**.

## 📜 Attributions

- Relief : **AWS Terrain Tiles** (Terrarium) — domaine public.
- Frontières / hydrographie : **Natural Earth** — domaine public.
- Réseau routier : tracé curaté ; se référer à **© OpenStreetMap** (ODbL) pour le détail réel.

> Carte à vocation pédagogique. Le réseau routier réel évolue chaque année.

# voyage_voyage 🌍

Site de décision pour l'été 2026 — déployé sur Vercel (statique, zéro build).

## Structure

| Fichier | Rôle |
|---|---|
| `index.html` | 🎟️ Le jeu — interface de décision interactive (mobile-first) |
| `docs.html` | 📚 Visualiseur des documents en onglets (rendu Markdown via marked.js) |
| `reunion-voyage-ete-2026.md` | 📋 Le plan — scénarios, budget, ordre du jour de la réunion |
| `decodeur-voyage-ete-2026.md` | 📖 Le récit — version narrative à lire à voix haute |
| `echelle-princesse-aventurier.md` | 👑 L'échelle — essai sur les manières de voyager (Fmath → Décodeur) |
| `notre-ete-2026.html` | Copie autonome du jeu (archive, `index.html` fait foi) |
| `mongolie-atlas.html` | 🏔️ **Atlas 3D interactif de la Mongolie** — relief, routes (OSM), POI terrain, ethnies. Fichier unique autonome, statique (zéro build). Accessible via `/mongolie-atlas.html` et lié depuis le jeu. |
| `mongolie-atlas/` | 📦 Code source du projet atlas (Vite + Three.js + D3). Voir `mongolie-atlas/README.md`. Données déjà générées ; non nécessaire au déploiement statique. |

## Note Vercel

Le 404 initial venait de l'absence d'`index.html` à la racine — corrigé.

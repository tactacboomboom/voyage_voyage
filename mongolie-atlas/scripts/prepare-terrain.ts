/**
 * prepare-terrain.ts
 * ------------------------------------------------------------------
 * Construit le relief de la Mongolie à partir de tuiles d'élévation
 * publiques (Terrarium PNG, domaine public — AWS elevation-tiles-prod).
 *
 * Sortie (embarquée dans le bundle, donc 100% hors-ligne au runtime) :
 *   src/data/heightmap.bin   Int16LE, width*height altitudes en mètres
 *   src/data/terrain.bin     Uint8, classe morphologique par cellule
 *   src/data/terrain-meta.json   bbox, dimensions grille + monde, min/max
 *   src/data/terrain-preview.png hypsométrie (debug visuel)
 *
 * Lancé au BUILD uniquement (a le droit d'utiliser internet).
 */
import sharp from "sharp";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "src", "data");
const CACHE = join(ROOT, ".cache", "tiles");

// --- Emprise Mongolie (un peu élargie) ---
const BBOX = { lonMin: 87.5, lonMax: 120.0, latMin: 41.4, latMax: 52.3 };
const ZOOM = 7; // bon compromis détail/poids
// Grille de sortie (lon/lat régulière)
const OUT_W = 720;
const OUT_H = 300;

const TILE_URL = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

// --- Web Mercator <-> tuiles ---
const lon2tileX = (lon: number, z: number) => ((lon + 180) / 360) * 2 ** z;
const lat2tileY = (lat: number, z: number) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
};

type Tile = { data: Buffer; channels: number };
const tileCache = new Map<string, Tile>();

async function fetchTile(z: number, x: number, y: number): Promise<Tile> {
  const key = `${z}_${x}_${y}`;
  if (tileCache.has(key)) return tileCache.get(key)!;
  const file = join(CACHE, `${key}.png`);
  let png: Buffer;
  if (existsSync(file)) {
    png = await readFile(file);
  } else {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(TILE_URL(z, x, y));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        png = Buffer.from(await res.arrayBuffer());
        await writeFile(file, png);
        break;
      } catch (e) {
        lastErr = e;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    // @ts-expect-error png assigned in loop
    if (!png) throw new Error(`tuile ${key} : ${String(lastErr)}`);
  }
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const tile = { data, channels: info.channels };
  tileCache.set(key, tile);
  return tile;
}

// élévation Terrarium : (R*256 + G + B/256) - 32768
function decodeElev(t: Tile, px: number, py: number): number {
  const i = (py * 256 + px) * t.channels;
  const R = t.data[i], G = t.data[i + 1], B = t.data[i + 2];
  return R * 256 + G + B / 256 - 32768;
}

async function elevAt(lon: number, lat: number): Promise<number> {
  const fx = lon2tileX(lon, ZOOM);
  const fy = lat2tileY(lat, ZOOM);
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const px = Math.min(255, Math.floor((fx - tx) * 256));
  const py = Math.min(255, Math.floor((fy - ty) * 256));
  const t = await fetchTile(ZOOM, tx, ty);
  return decodeElev(t, px, py);
}

async function main() {
  await mkdir(DATA, { recursive: true });
  await mkdir(CACHE, { recursive: true });

  // Pré-téléchargement de toutes les tuiles de l'emprise (avec concurrence)
  const x0 = Math.floor(lon2tileX(BBOX.lonMin, ZOOM));
  const x1 = Math.floor(lon2tileX(BBOX.lonMax, ZOOM));
  const y0 = Math.floor(lat2tileY(BBOX.latMax, ZOOM));
  const y1 = Math.floor(lat2tileY(BBOX.latMin, ZOOM));
  const jobs: Array<[number, number]> = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push([x, y]);
  console.log(`Tuiles à charger : ${jobs.length} (z${ZOOM}, x ${x0}..${x1}, y ${y0}..${y1})`);

  let done = 0;
  const POOL = 8;
  for (let i = 0; i < jobs.length; i += POOL) {
    await Promise.all(
      jobs.slice(i, i + POOL).map(async ([x, y]) => {
        await fetchTile(ZOOM, x, y);
        done++;
        if (done % 16 === 0 || done === jobs.length) process.stdout.write(`\r  ${done}/${jobs.length}`);
      })
    );
  }
  console.log("\nTuiles OK. Échantillonnage de la grille…");

  // --- Échantillonnage sur grille lon/lat régulière ---
  const heights = new Int16Array(OUT_W * OUT_H);
  let minE = Infinity, maxE = -Infinity;
  for (let j = 0; j < OUT_H; j++) {
    const lat = BBOX.latMax - (j / (OUT_H - 1)) * (BBOX.latMax - BBOX.latMin);
    for (let i = 0; i < OUT_W; i++) {
      const lon = BBOX.lonMin + (i / (OUT_W - 1)) * (BBOX.lonMax - BBOX.lonMin);
      const e = await elevAt(lon, lat);
      const v = Math.max(-500, Math.min(9000, Math.round(e)));
      heights[j * OUT_W + i] = v;
      if (v < minE) minE = v;
      if (v > maxE) maxE = v;
    }
    if (j % 30 === 0) process.stdout.write(`\r  ligne ${j}/${OUT_H}`);
  }
  console.log(`\nAltitudes : ${minE} m .. ${maxE} m`);

  // --- Classification morphologique (geomorphométrie) ---
  // 0=eau/plat-bas, 1=steppe(plaine), 2=vallonné, 3=montagneux, 4=désert(Gobi)
  const klass = new Uint8Array(OUT_W * OUT_H);
  const gobi = GOBI_POLY;
  const rad = 2; // voisinage pour la rugosité
  for (let j = 0; j < OUT_H; j++) {
    const lat = BBOX.latMax - (j / (OUT_H - 1)) * (BBOX.latMax - BBOX.latMin);
    for (let i = 0; i < OUT_W; i++) {
      const lon = BBOX.lonMin + (i / (OUT_W - 1)) * (BBOX.lonMax - BBOX.lonMin);
      const h = heights[j * OUT_W + i];
      // rugosité locale = amplitude max-min dans le voisinage
      let lo = Infinity, hi = -Infinity;
      for (let dj = -rad; dj <= rad; dj++)
        for (let di = -rad; di <= rad; di++) {
          const jj = j + dj, ii = i + di;
          if (jj < 0 || jj >= OUT_H || ii < 0 || ii >= OUT_W) continue;
          const v = heights[jj * OUT_W + ii];
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      const rugged = hi - lo;
      let c: number;
      if (rugged > 700 || h > 2600) c = 3;          // montagneux
      else if (rugged > 250) c = 2;                  // vallonné
      else c = 1;                                     // steppe / plaine
      if (pointInPoly(lon, lat, gobi) && c < 3) c = 4; // désert du Gobi
      klass[j * OUT_W + i] = c;
    }
  }

  // --- Écriture des binaires + meta ---
  // dimensions « monde » corrigées de la latitude (anti-étirement E-O)
  const meanLat = (BBOX.latMin + BBOX.latMax) / 2;
  const lonSpan = (BBOX.lonMax - BBOX.lonMin) * Math.cos((meanLat * Math.PI) / 180);
  const latSpan = BBOX.latMax - BBOX.latMin;
  const worldWidth = 200;
  const worldHeight = (worldWidth * latSpan) / lonSpan;

  await writeFile(join(DATA, "heightmap.bin"), Buffer.from(heights.buffer));
  await writeFile(join(DATA, "terrain.bin"), Buffer.from(klass.buffer));
  await writeFile(
    join(DATA, "terrain-meta.json"),
    JSON.stringify(
      { width: OUT_W, height: OUT_H, bbox: BBOX, worldWidth, worldHeight, minEle: minE, maxEle: maxE, zoom: ZOOM },
      null,
      2
    )
  );

  // --- Aperçu hypsométrique (debug) ---
  const rgb = Buffer.alloc(OUT_W * OUT_H * 3);
  for (let k = 0; k < OUT_W * OUT_H; k++) {
    const [r, g, b] = hypso(heights[k], minE, maxE);
    rgb[k * 3] = r; rgb[k * 3 + 1] = g; rgb[k * 3 + 2] = b;
  }
  await sharp(rgb, { raw: { width: OUT_W, height: OUT_H, channels: 3 } })
    .png()
    .toFile(join(DATA, "terrain-preview.png"));

  console.log("OK → src/data/heightmap.bin, terrain.bin, terrain-meta.json, terrain-preview.png");
}

// teinte hypsométrique simple pour l'aperçu
function hypso(h: number, lo: number, hi: number): [number, number, number] {
  if (h < 0) return [110, 150, 180];
  const t = Math.max(0, Math.min(1, (h - lo) / (hi - lo)));
  const stops: [number, [number, number, number]][] = [
    [0.0, [60, 110, 70]],
    [0.25, [120, 150, 80]],
    [0.5, [200, 180, 110]],
    [0.7, [170, 130, 90]],
    [0.88, [140, 120, 110]],
    [1.0, [245, 245, 250]],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const [t0, c0] = stops[i], [t1, c1] = stops[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return [0, 1, 2].map((k) => Math.round(c0[k] + f * (c1[k] - c0[k]))) as [number, number, number];
    }
  }
  return [245, 245, 250];
}

// point-in-polygon (ray casting), poly = [[lon,lat],...]
function pointInPoly(lon: number, lat: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    const hit = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

// emprise approximative du Gobi (sud du pays)
const GOBI_POLY: number[][] = [
  [93.5, 43.2], [97, 42.6], [101, 42.4], [105, 42.2], [109, 42.4], [111.5, 43.3],
  [111, 44.6], [108, 45.3], [104, 45.4], [100, 45.2], [96, 44.8], [93.5, 44.0], [93.5, 43.2],
];

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

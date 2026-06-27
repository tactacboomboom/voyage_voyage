/**
 * prepare-osm.ts
 * ------------------------------------------------------------------
 * Extrait d'OpenStreetMap (via Overpass) le réseau routier mongol enrichi
 * (classé par revêtement) + les POI de terrain (essence, eau, bivouacs, mécanos/gués).
 *
 * Sortie : src/data/roads-osm.geojson  (4 buckets : asphalt/dirt/offroad/rail)
 *          src/data/pois.geojson       (cat : fuel/water/camp/repair/ford)
 *
 * Build-time uniquement (internet requis). Cache brut dans .cache/osm/.
 * © OpenStreetMap contributors (ODbL).
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "src", "data");
const CACHE = join(ROOT, ".cache", "osm");

const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

const MAX_BYTES = 6_000_000; // garde-fou poids roads-osm.geojson

async function overpass(
  name: string, query: string, timeoutMs = 100000,
  opts: { endpoints?: string[]; attempts?: number } = {}
): Promise<any> {
  const file = join(CACHE, name + ".json");
  if (existsSync(file)) {
    console.log(`  (cache) ${name}`);
    return JSON.parse(await readFile(file, "utf8"));
  }
  const eps = opts.endpoints ?? ENDPOINTS;
  const maxAttempts = opts.attempts ?? 2;
  let lastErr: unknown;
  for (const ep of eps) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        console.log(`  Overpass ${name} via ${ep} …`);
        const res = await fetch(ep, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json,*/*",
            "User-Agent": "atlas-nomade/1.0 (offline map build; contact: traveler)",
          },
          body: "data=" + encodeURIComponent(query),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (res.status === 429 || res.status === 504) throw new Error(`HTTP ${res.status} (rate/timeout)`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const json = JSON.parse(text);
        await writeFile(file, text);
        return json;
      } catch (e) {
        clearTimeout(timer);
        lastErr = e;
        console.log(`    échec (${String(e)}), retry…`);
        await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      }
    }
  }
  throw new Error(`Overpass ${name} : ${String(lastErr)}`);
}

// --- classification du revêtement ---
type Bucket = "asphalt" | "dirt" | "offroad" | "rail";
const PAVED = new Set(["asphalt", "paved", "concrete", "concrete:plates", "paving_stones", "chipseal"]);
const UNPAVED = new Set(["unpaved", "gravel", "fine_gravel", "compacted", "ground", "dirt", "earth", "pebblestone"]);
const ROUGH = new Set(["sand", "grass", "mud", "rock", "salt"]);

function classify(tags: Record<string, string>): Bucket {
  const hw = tags.highway;
  const s = tags.surface;
  if (s) {
    if (PAVED.has(s)) return "asphalt";
    if (UNPAVED.has(s)) return "dirt";
    if (ROUGH.has(s)) return "offroad";
  }
  // pas de surface explicite -> heuristique par type
  if (hw === "motorway" || hw === "trunk" || hw === "primary") return "asphalt";
  if (hw === "secondary" || hw === "tertiary") return s ? "dirt" : "dirt";
  if (hw === "track" || hw === "path") return "offroad";
  return "dirt"; // unclassified/road par défaut
}

// --- Douglas-Peucker ---
function perp(p: number[], a: number[], b: number[]): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function dp(pts: number[][], tol: number): number[][] {
  if (pts.length < 3) return pts;
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perp(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max > tol) {
    const left = dp(pts.slice(0, idx + 1), tol);
    const right = dp(pts.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  }
  return [pts[0], pts[pts.length - 1]];
}
const round5 = (n: number) => Math.round(n * 1e4) / 1e4; // ~11 m, suffisant à l'échelle pays

// longueur approx d'une polyligne [lon,lat][] en km
function segKm(pts: number[][]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) {
    const dLat = ((pts[i][1] - pts[i - 1][1]) * Math.PI) / 180;
    const dLon = ((pts[i][0] - pts[i - 1][0]) * Math.PI) / 180;
    const la = (pts[i][1] * Math.PI) / 180;
    s += 6371 * Math.sqrt(dLat * dLat + Math.cos(la) * Math.cos(la) * dLon * dLon);
  }
  return s;
}

async function fetchRoadElements(): Promise<any[]> {
  const base = `[out:json][timeout:240];\narea["ISO3166-1"="MN"][admin_level=2]->.mn;`;
  const qMain = `${base}\n(\n  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|road)$"](area.mn);\n  way["railway"="rail"](area.mn);\n);\nout tags geom;`;
  const qTrack = `${base}\n(\n  way["highway"~"^(track|path)$"](area.mn);\n);\nout tags geom;`;
  const elements: any[] = [];
  const main = await overpass("roads_main", qMain, 100000);
  elements.push(...main.elements);
  console.log(`  réseau principal : ${main.elements.length} ways`);
  try {
    const trk = await overpass("roads_track", qTrack, 150000, {
      endpoints: ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"],
      attempts: 1,
    });
    elements.push(...trk.elements);
    console.log(`  tracks/paths : ${trk.elements.length} ways`);
  } catch (e) {
    console.log(`  ⚠ tracks ignorés (volume/timeout) : ${String(e)}`);
  }
  return elements;
}

let ROAD_ELEMENTS: any[] | null = null;
async function buildRoads(tol: number): Promise<{ fc: any; sizes: Record<string, number> }> {
  if (!ROAD_ELEMENTS) ROAD_ELEMENTS = await fetchRoadElements();
  const feats: any[] = [];
  const sizes: Record<string, number> = { asphalt: 0, dirt: 0, offroad: 0, rail: 0 };
  for (const el of ROAD_ELEMENTS) {
    if (el.type !== "way" || !el.geometry) continue;
    const tags = el.tags || {};
    const cls: Bucket = tags.railway === "rail" ? "rail" : classify(tags);
    let pts: number[][] = el.geometry.map((g: any) => [round5(g.lon), round5(g.lat)]);
    pts = dp(pts, tol);
    if (pts.length < 2) continue;
    // retire les tronçons courts (bruit urbain/local), sauf le rail
    if (cls !== "rail" && segKm(pts) < 1.0) continue;
    sizes[cls]++;
    feats.push({ type: "Feature", properties: { cls }, geometry: { type: "LineString", coordinates: pts } });
  }
  return { fc: { type: "FeatureCollection", features: feats }, sizes };
}

async function buildPois(): Promise<any> {
  const q = `[out:json][timeout:180];
area["ISO3166-1"="MN"][admin_level=2]->.mn;
(
  node["amenity"="fuel"](area.mn);
  node["natural"="spring"](area.mn);
  node["man_made"="water_well"](area.mn);
  node["amenity"="drinking_water"](area.mn);
  node["tourism"="camp_site"](area.mn);
  node["shop"="motorcycle"](area.mn);
  node["shop"="car_repair"](area.mn);
  node["amenity"="car_repair"](area.mn);
  node["ford"="yes"](area.mn);
  way["ford"="yes"](area.mn);
);
out tags center;`;
  const data = await overpass("pois", q);
  const cat = (t: Record<string, string>): string => {
    if (t.amenity === "fuel") return "fuel";
    if (t.natural === "spring" || t.man_made === "water_well" || t.amenity === "drinking_water") return "water";
    if (t.tourism === "camp_site") return "camp";
    if (t.shop === "motorcycle" || t.shop === "car_repair" || t.amenity === "car_repair") return "repair";
    if (t.ford === "yes") return "ford";
    return "other";
  };
  const feats: any[] = [];
  const counts: Record<string, number> = {};
  for (const el of data.elements) {
    const t = el.tags || {};
    const c = cat(t);
    if (c === "other") continue;
    const lon = el.lon ?? el.center?.lon;
    const lat = el.lat ?? el.center?.lat;
    if (lon == null || lat == null) continue;
    counts[c] = (counts[c] || 0) + 1;
    const nm = t.name || t["name:en"];
    const props: Record<string, string> = { cat: c };
    if (nm) props.name = nm;
    feats.push({
      type: "Feature",
      properties: props,
      geometry: { type: "Point", coordinates: [round5(lon), round5(lat)] },
    });
  }
  console.log("  POI par catégorie :", counts);
  return { type: "FeatureCollection", features: feats };
}

async function main() {
  await mkdir(DATA, { recursive: true });
  await mkdir(CACHE, { recursive: true });

  console.log("Réseau routier OSM…");
  let tol = 0.009; // ~900 m (vue pays ; tient le poids du fichier hors-ligne)
  let { fc, sizes } = await buildRoads(tol);
  let json = JSON.stringify(fc);
  // garde-fou poids : on simplifie davantage si trop lourd
  while (json.length > MAX_BYTES && tol < 0.03) {
    tol *= 1.8;
    console.log(`  ${(json.length / 1e6).toFixed(1)} Mo > cible → re-simplification (tol=${tol.toFixed(4)})`);
    ({ fc, sizes } = await buildRoads(tol));
    json = JSON.stringify(fc);
  }
  await writeFile(join(DATA, "roads-osm.geojson"), json);
  console.log(`  routes par bucket :`, sizes, `| ${(json.length / 1e6).toFixed(2)} Mo`);

  console.log("POI de terrain OSM…");
  const pois = await buildPois();
  await writeFile(join(DATA, "pois.geojson"), JSON.stringify(pois));

  console.log("OK → src/data/roads-osm.geojson, pois.geojson");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

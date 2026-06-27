/**
 * prepare-vectors.ts
 * ------------------------------------------------------------------
 * Récupère les couches vectorielles Natural Earth (domaine public),
 * les filtre/clip sur l'emprise Mongolie, et les écrit en GeoJSON léger.
 *
 * Sortie : src/data/{border,neighbors,aimags,rivers,lakes}.geojson
 * (Les routes, villes et sommets sont curatés à la main : src/data/curated.*)
 */
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "src", "data");
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
const BBOX = { lonMin: 86, lonMax: 121, latMin: 40, latMax: 53.5 };

async function getJSON(name: string): Promise<any> {
  const res = await fetch(NE + name);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

const inBox = (lon: number, lat: number) =>
  lon >= BBOX.lonMin && lon <= BBOX.lonMax && lat >= BBOX.latMin && lat <= BBOX.latMax;

// garde une feature si une partie de sa géométrie touche la bbox
function touchesBox(geom: any): boolean {
  let hit = false;
  const walk = (c: any) => {
    if (typeof c[0] === "number") {
      if (inBox(c[0], c[1])) hit = true;
    } else for (const cc of c) walk(cc);
  };
  if (geom?.coordinates) walk(geom.coordinates);
  return hit;
}

function fc(features: any[]) {
  return { type: "FeatureCollection", features };
}
// ne garde que quelques propriétés utiles (les fichiers NE sont très verbeux)
function trim(features: any[], keys: string[]) {
  return features.map((f: any) => {
    const props: Record<string, any> = {};
    for (const k of keys) if (f.properties?.[k] != null) props[k] = f.properties[k];
    return { type: "Feature", properties: props, geometry: f.geometry };
  });
}
async function save(name: string, features: any[]) {
  await writeFile(join(DATA, name), JSON.stringify(fc(features)));
  console.log(`  ${name.padEnd(20)} ${features.length} features`);
}

async function main() {
  await mkdir(DATA, { recursive: true });
  console.log("Téléchargement Natural Earth (50m)…");

  const countries = await getJSON("ne_50m_admin_0_countries.geojson");
  const isMongolia = (p: any) =>
    p.ADMIN === "Mongolia" || p.NAME === "Mongolia" || p.SOVEREIGNT === "Mongolia";
  const border = countries.features.filter((f: any) => isMongolia(f.properties));
  const neighbors = countries.features.filter(
    (f: any) => !isMongolia(f.properties) && touchesBox(f.geometry)
  );
  await save("border.geojson", trim(border, ["ADMIN", "NAME"]));
  await save("neighbors.geojson", trim(neighbors, ["ADMIN", "NAME"]));

  // admin_1 : le 50m ne contient pas les provinces de Mongolie -> 10m
  const admin1 = await getJSON("ne_10m_admin_1_states_provinces.geojson");
  const aimags = admin1.features.filter((f: any) => {
    const p = f.properties || {};
    return p.adm0_a3 === "MNG" || p.iso_a2 === "MN" || p.admin === "Mongolia" || p.gu_a3 === "MNG";
  });
  await save("aimags.geojson", trim(aimags, ["name", "name_en", "type_en"]));

  const rivers = await getJSON("ne_50m_rivers_lake_centerlines.geojson");
  await save(
    "rivers.geojson",
    trim(rivers.features.filter((f: any) => touchesBox(f.geometry)), ["name", "name_en"])
  );

  const lakes = await getJSON("ne_50m_lakes.geojson");
  await save(
    "lakes.geojson",
    trim(lakes.features.filter((f: any) => touchesBox(f.geometry)), ["name", "name_alt"])
  );

  console.log("OK → couches vectorielles écrites dans src/data/");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

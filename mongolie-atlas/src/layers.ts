/** layers.ts — routes, hydrographie, frontières, provinces, POI (villes/sommets). */
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Geo, densify } from "./geo";
import { CITIES, PEAKS } from "./data/curated";

export interface Layers {
  groups: Record<string, THREE.Group>;
  lineMaterials: LineMaterial[];
  pickables: THREE.Object3D[];
}

// découpe une ligne en sous-segments restant dans l'emprise
function clipLine(geo: Geo, coords: number[][]): number[][][] {
  const runs: number[][][] = [];
  let cur: number[][] = [];
  for (const p of coords) {
    if (geo.inBox(p[0], p[1])) cur.push(p);
    else { if (cur.length > 1) runs.push(cur); cur = []; }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

// --- extraction de lignes/anneaux depuis GeoJSON ---
function linesOf(geom: any): number[][][] {
  if (!geom) return [];
  if (geom.type === "LineString") return [geom.coordinates];
  if (geom.type === "MultiLineString") return geom.coordinates;
  if (geom.type === "Polygon") return geom.coordinates;
  if (geom.type === "MultiPolygon") return geom.coordinates.flat();
  return [];
}

function makeFatLine(
  geo: Geo,
  coords: number[][],
  color: string,
  width: number,
  offset: number,
  dashed = false
): { line: Line2; mat: LineMaterial } {
  const dense = densify(coords, 10);
  const pts: number[] = [];
  for (const [lon, lat] of dense) {
    pts.push(geo.worldX(lon), geo.drapeY(lon, lat, offset), geo.worldZ(lat));
  }
  const g = new LineGeometry();
  g.setPositions(pts);
  const mat = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: width,
    worldUnits: false,
    dashed,
    dashSize: 6,
    gapSize: 4,
    transparent: true,
  });
  const line = new Line2(g, mat);
  if (dashed) line.computeLineDistances();
  return { line, mat };
}

export function buildLayers(geo: Geo, gj: Record<string, any>, parent: THREE.Group): Layers {
  const groups: Record<string, THREE.Group> = {};
  const lineMaterials: LineMaterial[] = [];
  const pickables: THREE.Object3D[] = [];
  const mk = (name: string) => {
    const g = new THREE.Group();
    g.name = name;
    groups[name] = g;
    parent.add(g);
    return g;
  };

  // ---- Frontière nationale ----
  const gBorder = mk("border");
  for (const f of gj.border.features) {
    for (const ring of linesOf(f.geometry)) {
      const { line, mat } = makeFatLine(geo, ring as [number, number][], "#1f1a14", 2.4, 0.6);
      lineMaterials.push(mat);
      gBorder.add(line);
    }
  }

  // ---- Provinces (aimags) ----
  const gAimags = mk("aimags");
  for (const f of gj.aimags.features) {
    for (const ring of linesOf(f.geometry)) {
      const { line, mat } = makeFatLine(geo, ring as [number, number][], "#6b5f4d", 1.0, 0.4);
      mat.opacity = 0.5;
      lineMaterials.push(mat);
      gAimags.add(line);
    }
  }

  // ---- Rivières (découpées sur l'emprise) ----
  const gRivers = mk("rivers");
  for (const f of gj.rivers.features) {
    for (const ln of linesOf(f.geometry)) {
      for (const seg of clipLine(geo, ln)) {
        const { line, mat } = makeFatLine(geo, seg, "#4f8fb8", 1.6, 0.5);
        lineMaterials.push(mat);
        gRivers.add(line);
      }
    }
  }

  // ---- Lacs (remplissage plat, double-face, calé au-dessus des berges) ----
  const gLakes = mk("lakes");
  // non éclairé + double-face => visible quelle que soit l'orientation des faces
  const lakeMat = new THREE.MeshBasicMaterial({ color: "#2f86c4", side: THREE.DoubleSide });
  const lakeEdgeMat = new LineMaterial({ color: 0x9fd6f2, linewidth: 1.4, transparent: true });
  for (const f of gj.lakes.features) {
    for (const ring of linesOf(f.geometry)) {
      if (ring.length < 4) continue;
      let cx = 0, cy = 0, maxEle = -1e9;
      for (const p of ring) { cx += p[0]; cy += p[1]; maxEle = Math.max(maxEle, geo.sampleEle(p[0], p[1])); }
      cx /= ring.length; cy /= ring.length;
      if (!geo.inBox(cx, cy)) continue;
      const y = geo.eleToY(maxEle) + 0.8; // au niveau de la berge la plus haute
      const shape = new THREE.Shape();
      ring.forEach((p, i) => {
        const X = geo.worldX(p[0]), Z = geo.worldZ(p[1]);
        i === 0 ? shape.moveTo(X, Z) : shape.lineTo(X, Z);
      });
      const lg = new THREE.ShapeGeometry(shape);
      const pos = lg.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i), y, pos.getY(i));
      pos.needsUpdate = true;
      const mesh = new THREE.Mesh(lg, lakeMat);
      mesh.renderOrder = 2;
      gLakes.add(mesh);
      // liseré de berge
      const edgePts: number[] = [];
      for (const p of ring) edgePts.push(geo.worldX(p[0]), y + 0.05, geo.worldZ(p[1]));
      const eg = new LineGeometry();
      eg.setPositions(edgePts);
      lineMaterials.push(lakeEdgeMat);
      gLakes.add(new Line2(eg, lakeEdgeMat));
    }
  }

  // (Les routes proviennent désormais d'OSM — voir layers-osm.ts.)

  // ---- POI : villes ----
  const gCities = mk("cities");
  for (const c of CITIES) {
    const y = geo.drapeY(c.lon, c.lat, 1.2);
    const isCap = c.kind === "capital";
    const geom = new THREE.SphereGeometry(isCap ? 1.5 : c.kind === "aimag" ? 1.0 : 0.9, 16, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: isCap ? "#c0392b" : c.kind === "aimag" ? "#2c3e50" : "#e0a020",
      emissive: isCap ? "#601a12" : "#000000",
      roughness: 0.4,
    });
    const m = new THREE.Mesh(geom, mat);
    m.position.set(geo.worldX(c.lon), y, geo.worldZ(c.lat));
    m.userData = { type: "city", data: c };
    gCities.add(m);
    pickables.push(m);
  }

  // ---- POI : sommets ----
  const gPeaks = mk("peaks");
  const statusColor: Record<string, string> = { climbable: "#2e8b57", technical: "#8e44ad", sacred: "#c79a2b" };
  for (const p of PEAKS) {
    const y = geo.drapeY(p.lon, p.lat, 1.4);
    const geom = new THREE.ConeGeometry(1.4, 3.0, 4);
    const mat = new THREE.MeshStandardMaterial({ color: statusColor[p.status], roughness: 0.5, flatShading: true });
    const m = new THREE.Mesh(geom, mat);
    m.position.set(geo.worldX(p.lon), y + 1.5, geo.worldZ(p.lat));
    m.rotation.y = Math.PI / 4;
    m.userData = { type: "peak", data: p };
    gPeaks.add(m);
    pickables.push(m);
  }

  return { groups, lineMaterials, pickables };
}

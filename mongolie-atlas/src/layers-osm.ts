/** layers-osm.ts — réseau routier OSM (par revêtement) + POI de terrain, optimisés. */
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Geo, densify } from "./geo";
import { ROAD_STYLE, RoadClass } from "./data/curated";

export interface OsmLayers {
  groups: Record<string, THREE.Group>;
  lineMaterials: LineMaterial[];
  poiPickables: THREE.Object3D[];
}

const ROAD_WIDTH: Record<RoadClass, number> = { asphalt: 2.6, dirt: 1.5, offroad: 1.0, rail: 2.2 };

// fusionne toutes les routes d'un bucket en UN objet (1 draw call)
function buildBucket(geo: Geo, lines: number[][][], cls: RoadClass): { obj: LineSegments2; mat: LineMaterial } {
  const seg: number[] = [];
  for (const coords of lines) {
    const dense = densify(coords, 2); // ~2 km : épouse le relief au lieu de le couper
    for (let i = 1; i < dense.length; i++) {
      const a = dense[i - 1], b = dense[i];
      seg.push(geo.worldX(a[0]), geo.drapeY(a[0], a[1], 0.7), geo.worldZ(a[1]));
      seg.push(geo.worldX(b[0]), geo.drapeY(b[0], b[1], 0.7), geo.worldZ(b[1]));
    }
  }
  const g = new LineSegmentsGeometry();
  g.setPositions(seg);
  const mat = new LineMaterial({
    color: new THREE.Color(ROAD_STYLE[cls].color).getHex(),
    linewidth: ROAD_WIDTH[cls],
    transparent: true,
    opacity: cls === "offroad" ? 0.7 : 0.95,
  });
  return { obj: new LineSegments2(g, mat), mat };
}

export function buildOsmRoads(geo: Geo, roads: any, parent: THREE.Group): OsmLayers {
  const buckets: Record<RoadClass, number[][][]> = { asphalt: [], dirt: [], offroad: [], rail: [] };
  for (const f of roads.features) {
    const cls = (f.properties?.cls || "dirt") as RoadClass;
    if (f.geometry?.type === "LineString") buckets[cls].push(f.geometry.coordinates);
  }
  const groups: Record<string, THREE.Group> = {};
  const lineMaterials: LineMaterial[] = [];
  (["asphalt", "dirt", "offroad", "rail"] as RoadClass[]).forEach((cls) => {
    const grp = new THREE.Group();
    grp.name = "osm-" + cls;
    if (buckets[cls].length) {
      const { obj, mat } = buildBucket(geo, buckets[cls], cls);
      grp.add(obj);
      lineMaterials.push(mat);
    }
    groups["osm-" + cls] = grp;
    parent.add(grp);
  });
  return { groups, lineMaterials, poiPickables: [] };
}

// --- POI ---
export const POI_STYLE: Record<string, { label: string; color: string; icon: string }> = {
  fuel: { label: "Stations-essence", color: "#e8543a", icon: "⛽" },
  water: { label: "Sources & eau", color: "#3f9fd0", icon: "💧" },
  camp: { label: "Bivouacs / campings", color: "#3fae6a", icon: "⛺" },
  repair: { label: "Mécaniciens", color: "#b9b0a0", icon: "🔧" },
  ford: { label: "Gués / passages", color: "#37c0c0", icon: "≈" },
};

export interface PoiRecord { name: string; lon: number; lat: number; cat: string; }

export function buildPois(geo: Geo, pois: any, parent: THREE.Group): {
  groups: Record<string, THREE.Group>;
  pickables: THREE.Object3D[];
} {
  const byCat: Record<string, PoiRecord[]> = {};
  for (const f of pois.features) {
    const cat = f.properties?.cat;
    if (!POI_STYLE[cat]) continue;
    const [lon, lat] = f.geometry.coordinates;
    (byCat[cat] ||= []).push({ name: f.properties.name || "", lon, lat, cat });
  }

  const groups: Record<string, THREE.Group> = {};
  const pickables: THREE.Object3D[] = [];
  const dummy = new THREE.Object3D();

  for (const cat of Object.keys(POI_STYLE)) {
    const recs = byCat[cat] || [];
    const grp = new THREE.Group();
    grp.name = "poi-" + cat;
    grp.visible = cat === "fuel" || cat === "water"; // par défaut on montre essence + eau
    if (recs.length) {
      const geom = new THREE.OctahedronGeometry(0.9, 0);
      const mat = new THREE.MeshStandardMaterial({
        color: POI_STYLE[cat].color, roughness: 0.4, emissive: new THREE.Color(POI_STYLE[cat].color).multiplyScalar(0.15),
      });
      const inst = new THREE.InstancedMesh(geom, mat, recs.length);
      recs.forEach((r, i) => {
        dummy.position.set(geo.worldX(r.lon), geo.drapeY(r.lon, r.lat, 1.0), geo.worldZ(r.lat));
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.userData = { poi: recs, cat };
      grp.add(inst);
      pickables.push(inst);
    }
    groups["poi-" + cat] = grp;
    parent.add(grp);
  }
  return { groups, pickables };
}

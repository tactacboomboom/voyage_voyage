/** ethnos.ts (scène) — territoires ethniques drapés sur le relief (choroplèthe). */
import * as THREE from "three";
import { Geo } from "./geo";
import { ETHNOS, Ethnos } from "./data/ethnos";

function pointInPolys(lon: number, lat: number, polys: number[][][]): boolean {
  for (const ring of polys) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

export interface EthnosLabel { el: HTMLElement; x: number; yBase: number; z: number; }
export interface EthnosLayer {
  group: THREE.Group;
  pickables: THREE.Object3D[];
  labels: EthnosLabel[];
  setVisible: (v: boolean) => void;
}

export function buildEthnos(geo: Geo, root: HTMLElement): EthnosLayer {
  const { width: W, height: H } = geo.meta;
  const { lonMin, lonMax, latMin, latMax } = geo.meta.bbox;

  // positions monde précalculées par nœud de grille
  const lonOf = (i: number) => lonMin + (i / (W - 1)) * (lonMax - lonMin);
  const latOf = (j: number) => latMax - (j / (H - 1)) * (latMax - latMin);
  const xs = new Float32Array(W);
  for (let i = 0; i < W; i++) xs[i] = geo.worldX(lonOf(i));
  const zs = new Float32Array(H);
  for (let j = 0; j < H; j++) zs[j] = geo.worldZ(latOf(j));
  const ys = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) ys[k] = geo.eleToY(geo.heights[k]) + 0.6;

  // affectation de chaque cellule au 1er groupe qui la contient
  const verts: Record<string, number[]> = {};
  for (const e of ETHNOS) verts[e.id] = [];
  const push = (id: string, i: number, j: number) => {
    verts[id].push(xs[i], ys[j * W + i], zs[j]);
  };
  for (let j = 0; j < H - 1; j++) {
    const latC = latOf(j + 0.5);
    for (let i = 0; i < W - 1; i++) {
      const lonC = lonOf(i + 0.5);
      let hit: Ethnos | null = null;
      for (const e of ETHNOS) { if (pointInPolys(lonC, latC, e.polys)) { hit = e; break; } }
      if (!hit) continue;
      // 2 triangles du quad (i,j)
      push(hit.id, i, j); push(hit.id, i, j + 1); push(hit.id, i + 1, j);
      push(hit.id, i + 1, j); push(hit.id, i, j + 1); push(hit.id, i + 1, j + 1);
    }
  }

  const group = new THREE.Group();
  group.name = "ethnos";
  group.visible = false; // activable via le HUD
  const pickables: THREE.Object3D[] = [];
  for (const e of ETHNOS) {
    const arr = verts[e.id];
    if (arr.length < 9) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(arr), 3));
    g.computeVertexNormals();
    const m = new THREE.MeshBasicMaterial({
      color: new THREE.Color(e.color), transparent: true, opacity: 0.5,
      depthWrite: false, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, m);
    mesh.userData = { type: "ethnos", data: e };
    group.add(mesh);
    pickables.push(mesh);
  }

  // étiquettes
  const container = document.createElement("div");
  container.id = "ethnos-labels";
  container.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;display:none";
  root.appendChild(container);
  const labels: EthnosLabel[] = [];
  for (const e of ETHNOS) {
    const el = document.createElement("div");
    el.className = "elab";
    el.textContent = e.name;
    el.style.setProperty("--c", e.color);
    container.appendChild(el);
    labels.push({ el, x: geo.worldX(e.labelAt[0]), yBase: geo.eleToY(geo.sampleEle(e.labelAt[0], e.labelAt[1])) + 4, z: geo.worldZ(e.labelAt[1]) });
  }

  return {
    group, pickables, labels,
    setVisible: (v: boolean) => { group.visible = v; container.style.display = v ? "block" : "none"; },
  };
}

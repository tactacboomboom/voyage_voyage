/** terrain.ts — maillage 3D du relief, coloré par type de terrain. */
import * as THREE from "three";
import { Geo } from "./geo";
import { TERRAIN_STYLE } from "./data/curated";

const WATER = new THREE.Color("#3f6f93");

function classColor(c: number): THREE.Color {
  if (c === 0) return WATER.clone();
  const s = TERRAIN_STYLE[c];
  return new THREE.Color(s ? s.color : "#9bb06a");
}

export function buildTerrain(geo: Geo): THREE.Mesh {
  const { width: W, height: H } = geo.meta;
  const pos = new Float32Array(W * H * 3);
  const col = new Float32Array(W * H * 3);
  const { lonMin, lonMax, latMin, latMax } = geo.meta.bbox;

  const tmp = new THREE.Color();
  for (let j = 0; j < H; j++) {
    const lat = latMax - (j / (H - 1)) * (latMax - latMin);
    for (let i = 0; i < W; i++) {
      const lon = lonMin + (i / (W - 1)) * (lonMax - lonMin);
      const idx = j * W + i;
      const ele = geo.heights[idx];
      pos[idx * 3] = geo.worldX(lon);
      pos[idx * 3 + 1] = geo.eleToY(ele);
      pos[idx * 3 + 2] = geo.worldZ(lat);

      // couleur = type de terrain, modulé par l'altitude (richesse visuelle)
      tmp.copy(classColor(geo.klass[idx]));
      const t = Math.max(0, Math.min(1, (ele - geo.meta.minEle) / (geo.meta.maxEle - geo.meta.minEle)));
      // assombrit légèrement les bas-fonds, éclaircit/neige les hauts sommets
      if (geo.klass[idx] !== 0) {
        tmp.lerp(new THREE.Color("#f6f7fb"), Math.max(0, (t - 0.82) / 0.18) * 0.8); // neige
        tmp.offsetHSL(0, 0, (t - 0.4) * 0.06);
      }
      col[idx * 3] = tmp.r;
      col[idx * 3 + 1] = tmp.g;
      col[idx * 3 + 2] = tmp.b;
    }
  }

  // indices des triangles
  const index: number[] = [];
  for (let j = 0; j < H - 1; j++) {
    for (let i = 0; i < W - 1; i++) {
      const a = j * W + i;
      const b = j * W + i + 1;
      const c = (j + 1) * W + i;
      const d = (j + 1) * W + i + 1;
      index.push(a, c, b, b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geom.setIndex(index);
  geom.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: false,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.name = "terrain";
  mesh.receiveShadow = false;
  return mesh;
}

/** plan d'eau translucide au niveau 0 (mer/grands lacs bas) — optionnel, discret */
export function buildWaterPlane(geo: Geo): THREE.Mesh {
  const g = new THREE.PlaneGeometry(geo.meta.worldWidth * 1.4, geo.meta.worldHeight * 1.4);
  const m = new THREE.MeshStandardMaterial({ color: "#3f6f93", transparent: true, opacity: 0.0 });
  const mesh = new THREE.Mesh(g, m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = geo.eleToY(0) - 0.01;
  mesh.visible = false;
  return mesh;
}

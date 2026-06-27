import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import "./style.css";
import { loadGeo, loadGeoJSON } from "./geo";
import { buildTerrain, buildWaterPlane } from "./terrain";
import { buildLayers } from "./layers";
import { buildOsmRoads, buildPois, POI_STYLE, PoiRecord } from "./layers-osm";
import { buildEthnos } from "./ethnos";
import { Ethnos } from "./data/ethnos";
import { buildHUD, Labels } from "./ui";
import { City, Peak } from "./data/curated";

// --- URLs des données (embarquées par Vite → hors-ligne) ---
import metaUrl from "./data/terrain-meta.json?url";
import heightUrl from "./data/heightmap.bin?url";
import klassUrl from "./data/terrain.bin?url";
import borderUrl from "./data/border.geojson?url";
import aimagsUrl from "./data/aimags.geojson?url";
import riversUrl from "./data/rivers.geojson?url";
import lakesUrl from "./data/lakes.geojson?url";
import roadsOsmUrl from "./data/roads-osm.geojson?url";
import poisUrl from "./data/pois.geojson?url";
import previewUrl from "./data/terrain-preview.png?url";

const root = document.querySelector<HTMLDivElement>("#app")!;
const loading = document.createElement("div");
loading.id = "loading";
loading.innerHTML = `<div><div class="spin"></div>Chargement de la Mongolie…</div>`;
root.appendChild(loading);

function fallback2D(msg: string) {
  root.innerHTML = `<div style="position:fixed;inset:0;display:grid;place-items:center;background:#0e1320;color:#eef2f7;text-align:center;font-family:sans-serif;padding:24px">
    <div><h2>Mode 2D de secours</h2><p style="color:#9aa6b8;max-width:480px">${msg}</p>
    <img src="${previewUrl}" style="max-width:90vw;border-radius:12px;margin-top:14px;box-shadow:0 10px 40px #000"></div></div>`;
}

async function main() {
  // --- Renderer (avec garde WebGL) ---
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    fallback2D("Votre navigateur ne supporte pas WebGL. Voici l'aperçu hypsométrique du relief.");
    return;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);

  // --- Scène & ciel ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#aec6e0");
  scene.fog = new THREE.Fog("#aec6e0", 280, 620);

  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.5, 5000);
  const HOME = new THREE.Vector3(-30, 135, 175);
  camera.position.copy(HOME);

  // MapControls : glisser = se déplacer (pan), clic droit = pivoter, molette = zoom, flèches = naviguer
  const controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 8, 0);
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.minDistance = 12;
  controls.maxDistance = 900;
  controls.zoomSpeed = 1.15;
  controls.panSpeed = 1.1;
  controls.keyPanSpeed = 26;
  controls.listenToKeyEvents(window);

  // --- Lumières (ombrage de relief) ---
  scene.add(new THREE.HemisphereLight(0xcfe2f5, 0x6b5a3e, 0.85));
  const sun = new THREE.DirectionalLight(0xfff4e2, 1.35);
  sun.position.set(-160, 220, 120);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  // --- Données ---
  const [geo, border, aimags, rivers, lakes, roadsOsm, pois] = await Promise.all([
    loadGeo(metaUrl, heightUrl, klassUrl),
    loadGeoJSON(borderUrl),
    loadGeoJSON(aimagsUrl),
    loadGeoJSON(riversUrl),
    loadGeoJSON(lakesUrl),
    loadGeoJSON(roadsOsmUrl),
    loadGeoJSON(poisUrl),
  ]);

  geo.smooth(1); // adoucit le bruit du relief, garde les massifs

  // --- Monde (groupe scalé en Y pour l'exagération du relief) ---
  const world = new THREE.Group();
  scene.add(world);
  world.add(buildTerrain(geo));
  world.add(buildWaterPlane(geo));

  const vectors = new THREE.Group();
  world.add(vectors);
  const layers = buildLayers(geo, { border, aimags, rivers, lakes }, vectors);
  const osm = buildOsmRoads(geo, roadsOsm, vectors);
  const poi = buildPois(geo, pois, vectors);
  const ethnos = buildEthnos(geo, root);
  world.add(ethnos.group);

  const allGroups: Record<string, THREE.Group> = { ...layers.groups, ...osm.groups, ...poi.groups };
  const allLineMaterials = [...layers.lineMaterials, ...osm.lineMaterials];
  const allPickables = [...layers.pickables, ...poi.pickables, ...ethnos.pickables];

  // --- HUD + étiquettes ---
  const labels = new Labels(root, geo);
  const hud = buildHUD(root, {
    onToggle: (g, v) => {
      if (g === "ethnos") ethnos.setVisible(v);
      else if (allGroups[g]) allGroups[g].visible = v;
    },
    onLabels: (v) => labels.setVisible(v),
    onRelief: (v) => { world.scale.y = v; },
    onRecenter: () => {
      camera.position.copy(HOME);
      controls.target.set(0, 8, 0);
    },
  });

  loading.remove();

  // --- Interaction (raycast sur les POI) ---
  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const statusBadge: Record<string, { text: string; color: string }> = {
    climbable: { text: "Se grimpe (randonnée)", color: "#2e8b57" },
    technical: { text: "Technique / glaciaire", color: "#8e44ad" },
    sacred: { text: "Sacré — ascension restreinte", color: "#c79a2b" },
  };
  renderer.domElement.style.cursor = "grab";
  function pick(ev: PointerEvent): THREE.Intersection | null {
    pointer.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(allPickables, false);
    return hits.length ? hits[0] : null;
  }
  // distingue un clic (fiche) d'un glissé (navigation)
  let downAt: { x: number; y: number } | null = null;
  renderer.domElement.addEventListener("pointerdown", (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    downAt = null;
    if (moved > 6) return; // c'était un déplacement, pas un clic
    const hit = pick(e);
    if (!hit) return;
    const o = hit.object;
    if (o.userData.type === "city") {
      const c = o.userData.data as City;
      const kind = c.kind === "capital" ? "Capitale" : c.kind === "aimag" ? "Chef-lieu de province" : "Site";
      hud.showInfo(c.name, `${kind} · ${c.lat.toFixed(2)}°N ${c.lon.toFixed(2)}°E`, c.desc);
    } else if (o.userData.type === "peak") {
      const p = o.userData.data as Peak;
      hud.showInfo(p.name, `Sommet · ${p.ele} m`, p.desc, statusBadge[p.status]);
    } else if (o.userData.poi && hit.instanceId != null) {
      const r = (o.userData.poi as PoiRecord[])[hit.instanceId];
      const st = POI_STYLE[o.userData.cat as string];
      hud.showInfo(r.name || st.label, `${st.label} · ${r.lat.toFixed(2)}°N ${r.lon.toFixed(2)}°E`,
        r.name ? "Point d'intérêt (OpenStreetMap)." : "Point d'intérêt issu d'OpenStreetMap.");
    } else if (o.userData.type === "ethnos") {
      const e2 = o.userData.data as Ethnos;
      hud.showInfo(e2.name, `${e2.region} · ${e2.pop}`,
        `<b>Langue :</b> ${e2.lang}<br>${e2.note}<br><span style="opacity:.6">Territoire approximatif — recensement 2020, vérifié par 3 audits indépendants.</span>`);
    }
  });

  // --- Résize + résolution des fat lines ---
  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    for (const m of allLineMaterials) m.resolution.set(w, h);
  }
  addEventListener("resize", resize);
  resize();

  // --- Boussole ---
  const compassArrow = document.querySelector("#compass div") as HTMLElement;

  // projette les étiquettes ethnies (mêmes maths que Labels)
  const v = new THREE.Vector3();
  function updateEthnosLabels() {
    if (!ethnos.group.visible) return;
    const sy = world.scale.y;
    for (const it of ethnos.labels) {
      v.set(it.x, it.yBase * sy, it.z).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      it.el.style.display = vis ? "block" : "none";
      if (vis) {
        it.el.style.left = (v.x * 0.5 + 0.5) * innerWidth + "px";
        it.el.style.top = (-v.y * 0.5 + 0.5) * innerHeight + "px";
      }
    }
  }

  // --- Boucle ---
  function tick() {
    controls.update();
    labels.update(camera, innerWidth, innerHeight, world.scale.y);
    updateEthnosLabels();
    if (compassArrow) {
      const az = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
      compassArrow.style.transform = `rotate(${az}rad)`;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  tick();
}

main().catch((e) => {
  console.error(e);
  fallback2D("Une erreur est survenue au chargement 3D : " + (e?.message ?? e));
});

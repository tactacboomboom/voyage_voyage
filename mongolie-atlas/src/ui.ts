/** ui.ts — HUD : couches, légende, distances, panneau d'info, étiquettes. */
import * as THREE from "three";
import { ROADS, ROAD_STYLE, TERRAIN_STYLE, CITIES, PEAKS, City, Peak } from "./data/curated";
import { POI_STYLE } from "./layers-osm";
import { ETHNOS, KHALKHA } from "./data/ethnos";
import { Geo, polylineKm } from "./geo";

export interface HUDCallbacks {
  onToggle: (group: string, visible: boolean) => void;
  onLabels: (visible: boolean) => void;
  onRelief: (value: number) => void;
  onRecenter: () => void;
}

export interface HUD {
  showInfo: (title: string, meta: string, body: string, badge?: { text: string; color: string }) => void;
  hideInfo: () => void;
}

function el(tag: string, cls?: string, html?: string): HTMLElement {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function buildHUD(root: HTMLElement, cb: HUDCallbacks): HUD {
  // --- Titre ---
  const title = el("div", "panel", `
    <h1>ATLAS N<span class="o">O</span>MADE</h1>
    <p>Mongolie en relief 3D — routes, terrains, hydrographie. Données réelles, 100 % hors-ligne.</p>`);
  title.id = "title";
  root.appendChild(title);

  // --- Panneau couches ---
  const layers = el("div", "panel");
  layers.id = "layers";

  // Types de terrain (légende, affichage seul)
  layers.appendChild(el("div", "sec-title", "Types de terrain"));
  for (const k of [1, 2, 3, 4]) {
    const s = TERRAIN_STYLE[k];
    const r = el("div", "row");
    r.style.cursor = "default";
    r.innerHTML = `<span class="dot" style="background:${s.color}"></span><span class="label">${s.label}</span>`;
    layers.appendChild(r);
  }

  // Couches activables
  layers.appendChild(el("div", "sec-title", "Réseau & couches"));
  const toggles: Array<{ label: string; group: string; sw: string; on?: boolean }> = [
    { label: "Routes asphaltées", group: "osm-asphalt", sw: "sw-asphalt" },
    { label: "Pistes de terre", group: "osm-dirt", sw: "sw-dirt" },
    { label: "Off-road / tracks", group: "osm-offroad", sw: "sw-offroad" },
    { label: "Voie ferrée", group: "osm-rail", sw: "sw-rail" },
    { label: "Rivières", group: "rivers", sw: "sw-river" },
    { label: "Lacs", group: "lakes", sw: "" },
    { label: "Provinces (aimags)", group: "aimags", sw: "sw-prov", on: false },
  ];
  for (const t of toggles) {
    const r = el("label", "row") as HTMLLabelElement;
    const checked = t.on !== false;
    const swatch = t.group === "lakes"
      ? `<span class="dot" style="background:#3f7da6"></span>`
      : `<span class="sw ${t.sw}"></span>`;
    r.innerHTML = `<input type="checkbox" ${checked ? "checked" : ""}><span class="box"></span>${swatch}<span class="label">${t.label}</span>`;
    const input = r.querySelector("input") as HTMLInputElement;
    input.addEventListener("change", () => cb.onToggle(t.group, input.checked));
    layers.appendChild(r);
    if (!checked) cb.onToggle(t.group, false);
  }
  // étiquettes
  {
    const r = el("label", "row") as HTMLLabelElement;
    r.innerHTML = `<input type="checkbox" checked><span class="box"></span><span class="dot" style="background:#fff"></span><span class="label">Étiquettes</span>`;
    const input = r.querySelector("input") as HTMLInputElement;
    input.addEventListener("change", () => cb.onLabels(input.checked));
    layers.appendChild(r);
  }

  // Points d'intérêt (OSM)
  layers.appendChild(el("div", "sec-title", "Points d'intérêt (OSM)"));
  const poiToggles: Array<{ cat: string; on: boolean }> = [
    { cat: "fuel", on: true }, { cat: "water", on: true },
    { cat: "camp", on: false }, { cat: "repair", on: false }, { cat: "ford", on: false },
  ];
  for (const pt of poiToggles) {
    const st = POI_STYLE[pt.cat];
    const r = el("label", "row") as HTMLLabelElement;
    r.innerHTML = `<input type="checkbox" ${pt.on ? "checked" : ""}><span class="box"></span><span class="dot" style="background:${st.color}"></span><span class="label">${st.icon} ${st.label}</span>`;
    const input = r.querySelector("input") as HTMLInputElement;
    input.addEventListener("change", () => cb.onToggle("poi-" + pt.cat, input.checked));
    layers.appendChild(r);
    cb.onToggle("poi-" + pt.cat, pt.on);
  }

  // Populations & ethnies
  layers.appendChild(el("div", "sec-title", "Populations & ethnies"));
  {
    const r = el("label", "row") as HTMLLabelElement;
    r.innerHTML = `<input type="checkbox"><span class="box"></span><span class="dot" style="background:linear-gradient(90deg,#e0a23a,#3fa08c,#4f86c6)"></span><span class="label">Territoires ethniques</span>`;
    const input = r.querySelector("input") as HTMLInputElement;
    input.addEventListener("change", () => cb.onToggle("ethnos", input.checked));
    layers.appendChild(r);
  }
  layers.appendChild(el("div", "ethnote",
    `Zones <b>approximatives</b> (recensement 2020, audit 3 sources indépendantes). Fond : <b>${KHALKHA.name}</b> ${KHALKHA.pop}. Cliquez une zone pour sa fiche.`));
  const leg = el("div", "ethleg");
  leg.innerHTML = ETHNOS.map((e) => `<span><i style="background:${e.color}"></i>${e.name}</span>`).join("");
  layers.appendChild(leg);

  // Relief (exagération)
  const slider = el("div", "slider");
  slider.innerHTML = `<label>Exagération du relief <span id="relval">1.0×</span></label>
    <input type="range" min="0.3" max="2.5" step="0.1" value="1">`;
  const range = slider.querySelector("input") as HTMLInputElement;
  const relval = slider.querySelector("#relval") as HTMLElement;
  range.addEventListener("input", () => {
    relval.textContent = (+range.value).toFixed(1) + "×";
    cb.onRelief(+range.value);
  });
  layers.appendChild(slider);

  // Itinéraires & distances
  layers.appendChild(el("div", "sec-title", "Itinéraires & distances"));
  const byClass = ["asphalt", "dirt", "offroad", "rail"] as const;
  for (const cls of byClass) {
    for (const road of ROADS.filter((r) => r.cls === cls)) {
      const km = Math.round(polylineKm(road.coords));
      const r = el("div", "row");
      r.style.cursor = "default";
      r.innerHTML = `<span class="dot" style="background:${ROAD_STYLE[cls].color}"></span>
        <span class="label" style="font-size:.74rem">${road.name}</span>
        <span class="km">${km} km</span>`;
      layers.appendChild(r);
    }
  }
  root.appendChild(layers);

  // --- Bouton menu (mobile) : ouvre/ferme le tiroir des couches ---
  const menuBtn = el("button", "", "☰");
  menuBtn.id = "menu-toggle";
  menuBtn.setAttribute("aria-label", "Afficher/masquer les couches");
  menuBtn.addEventListener("click", () => {
    const open = layers.classList.toggle("open");
    menuBtn.textContent = open ? "✕" : "☰";
  });
  root.appendChild(menuBtn);

  // --- Panneau info ---
  const info = el("div", "panel");
  info.id = "info";
  info.innerHTML = `<div class="hd"><div><h2></h2><div class="meta"></div></div><span class="close">✕</span></div><div class="bd"></div>`;
  root.appendChild(info);
  (info.querySelector(".close") as HTMLElement).addEventListener("click", () => (info.style.display = "none"));

  // --- Contrôles + crédits + recentrer ---
  const controls = el("div", "panel");
  controls.id = "controls";
  controls.innerHTML = `
    <div class="hint"><b>Glisser</b> = se déplacer · <b>clic droit</b> = pivoter · <b>molette</b> = zoom · <b>flèches</b> = naviguer.<br>
    Cliquez (sans glisser) une <b>ville</b>, un <b>sommet</b>, un <b>POI</b> ou une <b>zone ethnique</b>.</div>
    <div class="btn" title="Recentrer la vue">↺<span class="btn-txt">Recentrer</span></div>
    <div id="credits">Relief : AWS Terrain Tiles (domaine public). Frontières/hydro : Natural Earth.
    Routes &amp; POI : © OpenStreetMap (ODbL). Ethnies : recensement 2020, approximatif. Carte pédagogique.</div>`;
  (controls.querySelector(".btn") as HTMLElement).addEventListener("click", cb.onRecenter);
  root.appendChild(controls);

  // --- Boussole ---
  const compass = el("div", "panel");
  compass.id = "compass";
  compass.innerHTML = `<div><span class="n">N</span>▲</div>`;
  root.appendChild(compass);

  // --- API info ---
  const h2 = info.querySelector("h2") as HTMLElement;
  const meta = info.querySelector(".meta") as HTMLElement;
  const bd = info.querySelector(".bd") as HTMLElement;
  return {
    showInfo(t, m, body, badge) {
      h2.textContent = t;
      meta.textContent = m;
      bd.innerHTML = body + (badge ? `<br><span class="badge" style="background:${badge.color}33;color:${badge.color}">${badge.text}</span>` : "");
      info.style.display = "block";
    },
    hideInfo() { info.style.display = "none"; },
  };
}

// --- Étiquettes flottantes (villes + sommets) ---
interface LabelItem { x: number; yBase: number; z: number; div: HTMLElement; }
export class Labels {
  container: HTMLElement;
  items: LabelItem[] = [];
  private v = new THREE.Vector3();

  constructor(root: HTMLElement, geo: Geo) {
    this.container = el("div");
    this.container.id = "labels";
    root.appendChild(this.container);

    const add = (name: string, lon: number, lat: number, cls: string, extra = "") => {
      const d = el("div", "lab " + cls, `${name}${extra}`);
      this.container.appendChild(d);
      this.items.push({ x: geo.worldX(lon), yBase: geo.drapeY(lon, lat, 1.6), z: geo.worldZ(lat), div: d });
    };
    for (const c of CITIES as City[]) add(c.name, c.lon, c.lat, c.kind === "capital" ? "cap" : "");
    for (const p of PEAKS as Peak[]) add("▲ " + p.name, p.lon, p.lat, "peak", ` <span class="e">${p.ele} m</span>`);
  }

  setVisible(v: boolean) { this.container.style.display = v ? "block" : "none"; }

  update(camera: THREE.Camera, w: number, h: number, scaleY: number) {
    for (const it of this.items) {
      this.v.set(it.x, it.yBase * scaleY, it.z).project(camera);
      const visible = this.v.z < 1 && Math.abs(this.v.x) < 1.15 && Math.abs(this.v.y) < 1.15;
      if (!visible) { it.div.style.display = "none"; continue; }
      it.div.style.display = "block";
      it.div.style.left = ((this.v.x * 0.5 + 0.5) * w) + "px";
      it.div.style.top = ((-this.v.y * 0.5 + 0.5) * h) + "px";
    }
  }
}

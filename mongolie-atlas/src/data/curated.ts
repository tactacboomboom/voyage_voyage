/**
 * curated.ts — données tracées à la main (décision spec : sous-ensemble curaté).
 * Coordonnées [lon, lat] passant par de vraies villes. Distances calculées au runtime.
 */

export type RoadClass = "asphalt" | "dirt" | "offroad" | "rail";

export interface Road {
  name: string;
  cls: RoadClass;
  coords: number[][];
}

export interface City {
  name: string;
  lon: number;
  lat: number;
  kind: "capital" | "aimag" | "site";
  desc: string;
}

export interface Peak {
  name: string;
  lon: number;
  lat: number;
  ele: number;
  status: "climbable" | "technical" | "sacred";
  desc: string;
}

// --- Villes & sites (lon, lat) ---
const C: Record<string, number[]> = {
  ulaanbaatar: [106.92, 47.92],
  darkhan: [105.95, 49.49],
  sukhbaatar: [106.2, 50.24],
  erdenet: [104.08, 49.03],
  kharkhorin: [102.82, 47.2],
  arvaikheer: [102.78, 46.27],
  tsetserleg: [101.45, 47.47],
  bayankhongor: [100.72, 46.19],
  altai: [96.26, 46.37],
  khovd: [91.64, 48.01],
  ulgii: [89.96, 48.97],
  moron: [100.16, 49.63],
  khatgal: [100.16, 50.45],
  mandalgovi: [106.27, 45.76],
  dalanzadgad: [104.42, 43.57],
  choir: [108.36, 46.36],
  sainshand: [110.14, 44.9],
  zamynuud: [111.9, 43.73],
  ondorkhaan: [110.66, 47.32],
  choibalsan: [114.54, 48.07],
  baruunurt: [113.28, 46.68],
  tosontsengel: [98.29, 48.75],
  yolynam: [104.08, 43.49],
  khongoryn: [102.3, 43.78],
  bayanzag: [103.73, 44.14],
  terelj: [107.47, 47.99],
  tavanbogd: [87.82, 49.1],
};

// --- Routes classées ---
export const ROADS: Road[] = [
  // ===== ASPHALTE =====
  { name: "UB → Darkhan → Sükhbaatar (Russie)", cls: "asphalt",
    coords: [C.ulaanbaatar, [106.5, 48.7], C.darkhan, C.sukhbaatar] },
  { name: "Darkhan → Erdenet", cls: "asphalt",
    coords: [C.darkhan, [105.0, 49.2], C.erdenet] },
  { name: "UB → Kharkhorin → Arvaikheer (route centrale)", cls: "asphalt",
    coords: [C.ulaanbaatar, [105.3, 47.5], [103.9, 47.3], C.kharkhorin, C.arvaikheer] },
  { name: "UB → Mandalgovi → Dalanzadgad (Gobi)", cls: "asphalt",
    coords: [C.ulaanbaatar, [106.6, 46.9], C.mandalgovi, [105.4, 44.7], C.dalanzadgad] },
  { name: "UB → Sainshand → Zamyn-Üüd (Chine)", cls: "asphalt",
    coords: [C.ulaanbaatar, C.choir, [109.3, 45.6], C.sainshand, C.zamynuud] },
  { name: "UB → Öndörkhaan → Choibalsan (est)", cls: "asphalt",
    coords: [C.ulaanbaatar, [108.6, 47.6], C.ondorkhaan, [112.5, 47.7], C.choibalsan] },
  { name: "Arvaikheer → Bayankhongor → Altaï → Khovd (route de l'Ouest)", cls: "asphalt",
    coords: [C.arvaikheer, C.bayankhongor, [98.4, 46.3], C.altai, [93.6, 47.0], C.khovd] },

  // ===== TERRE / GRAVIER =====
  { name: "Kharkhorin → Tsetserleg → Tosontsengel", cls: "dirt",
    coords: [C.kharkhorin, C.tsetserleg, [99.7, 48.3], C.tosontsengel] },
  { name: "Tsetserleg → Mörön → Khatgal (lac Khövsgöl)", cls: "dirt",
    coords: [C.tsetserleg, [100.8, 48.6], C.moron, C.khatgal] },
  { name: "Dalanzadgad → Yolyn Am → Khongoryn Els → Bayanzag (boucle Gobi)", cls: "dirt",
    coords: [C.dalanzadgad, C.yolynam, [103.2, 43.6], C.khongoryn, [103.0, 44.0], C.bayanzag] },
  { name: "Khovd → Ölgii", cls: "dirt",
    coords: [C.khovd, [90.8, 48.5], C.ulgii] },
  { name: "Choibalsan → Baruun-Urt (steppe orientale)", cls: "dirt",
    coords: [C.choibalsan, [113.9, 47.3], C.baruunurt] },

  // ===== OFF-ROAD (traces, pas de tracé fixe) =====
  { name: "Ölgii → Tavan Bogd (Altaï, piste de montagne)", cls: "offroad",
    coords: [C.ulgii, [89.2, 49.0], [88.5, 49.1], C.tavanbogd] },
  { name: "Khongoryn Els → traversée du Gobi central", cls: "offroad",
    coords: [C.khongoryn, [101.2, 44.3], [100.4, 44.8], [99.6, 45.2]] },
  { name: "Mörön → vallée des rennes (taïga)", cls: "offroad",
    coords: [C.moron, [99.6, 50.0], [99.2, 50.6], [99.0, 51.1]] },

  // ===== RAIL (Transmongolien) =====
  { name: "Transmongolien — Sükhbaatar ↔ UB ↔ Zamyn-Üüd", cls: "rail",
    coords: [C.sukhbaatar, C.darkhan, [106.5, 48.6], C.ulaanbaatar, C.choir, C.sainshand, C.zamynuud] },
  { name: "Ligne de l'Est — vers Choibalsan", cls: "rail",
    coords: [C.ulaanbaatar, [110.0, 47.9], C.choibalsan] },
];

// --- Villes & sites ---
export const CITIES: City[] = [
  { name: "Oulan-Bator", lon: C.ulaanbaatar[0], lat: C.ulaanbaatar[1], kind: "capital",
    desc: "La capitale : ~1,6 M d'habitants, soit près de la moitié du pays. Seul vrai hub (loueurs de motos, gare du Transmongolien)." },
  { name: "Darkhan", lon: C.darkhan[0], lat: C.darkhan[1], kind: "aimag",
    desc: "2ᵉ ville, nœud routier et ferroviaire vers la Russie." },
  { name: "Erdenet", lon: C.erdenet[0], lat: C.erdenet[1], kind: "aimag",
    desc: "Ville minière (cuivre), l'une des plus grandes mines à ciel ouvert d'Asie." },
  { name: "Kharkhorin (Karakorum)", lon: C.kharkhorin[0], lat: C.kharkhorin[1], kind: "site",
    desc: "Ancienne capitale de l'Empire mongol. Monastère d'Erdene Zuu. Vallée de l'Orkhon (UNESCO)." },
  { name: "Mörön / Khatgal", lon: C.khatgal[0], lat: C.khatgal[1], kind: "site",
    desc: "Porte du lac Khövsgöl, « la perle bleue » — 2ᵉ plus ancien lac d'eau douce du monde." },
  { name: "Dalanzadgad", lon: C.dalanzadgad[0], lat: C.dalanzadgad[1], kind: "aimag",
    desc: "Capitale du Gobi sud : base pour Yolyn Am, les dunes de Khongoryn Els et les falaises de Bayanzag." },
  { name: "Ölgii", lon: C.ulgii[0], lat: C.ulgii[1], kind: "site",
    desc: "Ouest kazakh, terre des aigliers et porte du massif du Tavan Bogd." },
  { name: "Khovd", lon: C.khovd[0], lat: C.khovd[1], kind: "aimag",
    desc: "Carrefour de l'extrême ouest, vallées et lacs d'altitude." },
  { name: "Choibalsan", lon: C.choibalsan[0], lat: C.choibalsan[1], kind: "aimag",
    desc: "Grand est : steppes infinies, terres de Gengis Khan." },
  { name: "Zamyn-Üüd", lon: C.zamynuud[0], lat: C.zamynuud[1], kind: "site",
    desc: "Poste-frontière avec la Chine, terminus sud du Transmongolien." },
];

// --- Sommets ---
export const PEAKS: Peak[] = [
  { name: "Khüiten (Tavan Bogd)", lon: C.tavanbogd[0], lat: C.tavanbogd[1], ele: 4374, status: "technical",
    desc: "Point culminant de Mongolie. Ascension glaciaire (glacier Potanin, crampons/piolet), guide + permis frontière requis." },
  { name: "Otgontenger", lon: 97.55, lat: 47.6, ele: 4008, status: "sacred",
    desc: "Pic sacré du Khangaï, seul sommet enneigé du massif. Ascension restreinte/interdite pour raisons spirituelles." },
  { name: "Bogd Khan Uul", lon: 106.95, lat: 47.78, ele: 2261, status: "climbable",
    desc: "Au sud d'Oulan-Bator. L'une des plus anciennes aires protégées du monde (1783). Randonnée accessible." },
  { name: "Gorkhi-Terelj", lon: C.terelj[0], lat: C.terelj[1], ele: 1700, status: "climbable",
    desc: "Parc national : rochers de granit (la Tortue), rando facile à 1 h d'UB." },
];

export const ROAD_STYLE: Record<RoadClass, { label: string; color: string }> = {
  asphalt: { label: "Route asphaltée", color: "#2b2f3a" },
  dirt: { label: "Piste de terre / gravier", color: "#c4863a" },
  offroad: { label: "Off-road (sans tracé fixe)", color: "#d2492a" },
  rail: { label: "Voie ferrée (Transmongolien)", color: "#7a4fa3" },
};

export const TERRAIN_STYLE: Record<number, { label: string; color: string }> = {
  1: { label: "Steppe / plaine", color: "#9bb06a" },
  2: { label: "Collines vallonnées", color: "#c2b673" },
  3: { label: "Montagnes", color: "#b08e74" },
  4: { label: "Désert (Gobi)", color: "#dcc488" },
};

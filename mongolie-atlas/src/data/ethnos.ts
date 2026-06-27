/**
 * ethnos.ts — territoires ethniques APPROXIMATIFs (post-validation 3 juges).
 * Chiffres : recensement de Mongolie 2020. Polygones = blobs indicatifs, pas des
 * frontières réelles. Fond = Khalkha majoritaire (~84 %).
 * Voir docs/QUALITY-REPORT.md pour la traçabilité des corrections.
 */
export interface Ethnos {
  id: string;
  name: string;
  region: string;
  color: string;
  pop: string;
  lang: string;
  note: string;
  labelAt: [number, number];
  polys: number[][][]; // un ou plusieurs anneaux [lon,lat]
}

// Ordre : groupes spécifiques/petits d'abord (priorité d'affectation des cellules).
export const ETHNOS: Ethnos[] = [
  {
    id: "dukha", name: "Doukha (Tsaatan)", region: "Taïga nord du Khövsgöl",
    color: "#c98be0", pop: "~0,01 % (≈ 200–400 pers.)", lang: "doukhan (touvain, turcique)",
    note: "Éleveurs de rennes nomades de la taïga (sum de Tsagaannuur). L'un des derniers peuples du renne au monde.",
    labelAt: [99.5, 51.6],
    polys: [[[99.0, 51.25], [99.1, 51.85], [100.1, 51.85], [100.3, 51.3], [99.6, 51.1]]],
  },
  {
    id: "darkhad", name: "Darkhad", region: "Dépression du Darkhad / Shishged",
    color: "#a77fc4", pop: "~0,8 %", lang: "mongol (dialecte darkhad)",
    note: "Vallée à l'ouest-nord-ouest du lac Khövsgöl ; bastion du chamanisme mongol.",
    labelAt: [99.4, 50.9],
    polys: [[[98.8, 50.4], [98.9, 51.3], [99.9, 51.45], [100.3, 50.85], [99.6, 50.3]]],
  },
  {
    id: "tuvan", name: "Touvains (Tsengel)", region: "Sum de Tsengel (Bayan-Ölgii)",
    color: "#d98a4a", pop: "~0,07 %", lang: "touvain (turcique sayan)",
    note: "Poche turcophone dans le Bayan-Ölgii kazakh ; à distinguer des Doukha du Khövsgöl.",
    labelAt: [89.2, 48.95],
    polys: [[[88.7, 48.78], [88.85, 49.18], [89.55, 49.12], [89.55, 48.72], [89.0, 48.6]]],
  },
  {
    id: "uriankhai", name: "Altaï Uriankhai", region: "Altaï (sud Bayan-Ölgii / nord Khovd)",
    color: "#b8893f", pop: "~0,9 %", lang: "mongol (substrat « forestier » uriankhai)",
    note: "Peuple d'origine forestière, aujourd'hui mongolophone, des hautes vallées de l'Altaï.",
    labelAt: [90.4, 47.6],
    polys: [[[89.6, 47.2], [89.9, 48.2], [91.3, 48.1], [91.5, 47.1], [90.3, 46.7]]],
  },
  {
    id: "kazakh", name: "Kazakhs", region: "Bayan-Ölgii (+ Khovd)",
    color: "#e0a23a", pop: "~3,8 % (1ʳᵉ minorité)", lang: "kazakh (turcique)",
    note: "Musulmans sunnites ; ~88–90 % du Bayan-Ölgii. Célèbres pour la chasse à l'aigle royal.",
    labelAt: [89.7, 48.5],
    polys: [[[88.0, 48.3], [88.6, 49.7], [90.1, 49.95], [91.3, 49.0], [90.9, 47.85], [89.3, 47.45], [88.1, 47.9]]],
  },
  {
    id: "oirat-uvs", name: "Oïrates de l'Uvs", region: "Aimag d'Uvs",
    color: "#3fa08c", pop: "Dörvöd ~2,6 % · Bayad ~2,0 · Khoton ~0,4",
    lang: "mongol oïrate (Khoton : d'origine turcique, assimilé)",
    note: "Dörvöd et Bayad (oïrates) autour du lac Uvs ; les Khoton sont d'origine turcique musulmane, oïratisés.",
    labelAt: [93.3, 49.9],
    polys: [[[91.4, 49.2], [92.0, 50.6], [94.4, 50.6], [95.7, 49.9], [95.0, 48.85], [92.6, 48.75], [91.5, 48.9]]],
  },
  {
    id: "oirat-khovd", name: "Oïrates du Khovd", region: "Aimag de Khovd",
    color: "#4aa6ad", pop: "Zakhchin ~1,2 % · Torguud · Myangad · Ööld",
    lang: "mongol oïrate",
    note: "Mosaïque oïrate de l'extrême ouest : Zakhchin, Torguud, Myangad, Ööld.",
    labelAt: [91.7, 47.4],
    polys: [[[90.6, 46.5], [90.9, 48.0], [92.8, 48.0], [93.7, 47.0], [92.6, 45.95], [91.0, 46.05]]],
  },
  {
    id: "khotogoid", name: "Khotogoïd", region: "Nord-ouest (Zavkhan / SW Khövsgöl)",
    color: "#8a6fb0", pop: "~0,27 %", lang: "mongol",
    note: "Groupe mongol du nord-ouest, entre Khangaï et Khövsgöl. (Ajouté après audit.)",
    labelAt: [97.7, 48.9],
    polys: [[[96.4, 48.2], [96.8, 49.5], [98.6, 49.6], [99.2, 48.7], [98.2, 47.9], [96.8, 47.95]]],
  },
  {
    id: "buryat", name: "Bouriates", region: "Nord & nord-est (Dornod surtout)",
    color: "#4f86c6", pop: "~1,4 % (2ᵉ minorité)", lang: "mongol bouriate",
    note: "Apparentés aux Bouriates de Russie (Baïkal). Plus forte concentration à l'est (Dornod ~41 %), aussi Selenge/Bulgan/Khentii.",
    labelAt: [105.2, 49.7],
    polys: [
      [[102.8, 48.9], [103.2, 50.5], [107.5, 50.5], [107.8, 49.0], [105.5, 48.3], [103.5, 48.5]],
      [[111.8, 47.7], [112.2, 49.6], [115.8, 49.7], [116.2, 48.0], [113.8, 47.1]],
    ],
  },
  {
    id: "dariganga", name: "Dariganga", region: "Sud-est (Sükhbaatar)",
    color: "#c065a0", pop: "~1,2 %", lang: "mongol (dialecte dariganga)",
    note: "Plateau volcanique et dunes du Moltsog Els, au sud de l'aimag de Sükhbaatar.",
    labelAt: [113.7, 45.6],
    polys: [[[112.6, 44.8], [112.9, 46.3], [114.6, 46.4], [115.0, 44.9], [113.6, 44.5]]],
  },
  {
    id: "barga", name: "Barga & Üzemchin", region: "Extrême est (frontière chinoise)",
    color: "#a8794f", pop: "Barga ~0,09 % · Üzemchin ~0,07 %", lang: "mongol",
    note: "Petits groupes mongols orientaux le long de la frontière avec la Mongolie-Intérieure (Chine).",
    labelAt: [115.8, 46.9],
    polys: [[[114.8, 46.1], [115.2, 47.7], [116.7, 47.8], [116.9, 46.1], [115.6, 45.7]]],
  },
];

export const KHALKHA = {
  name: "Khalkha",
  pop: "~84 % (83,8 %, recensement 2020)",
  note: "Groupe mongol majoritaire, dominant sur la quasi-totalité du pays (centre, est, sud et une grande partie du nord). Les minorités ci-dessus sont surtout périphériques (ouest, nord, est).",
};

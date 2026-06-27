/** geo.ts — projection lon/lat ↔ monde 3D + échantillonnage du relief. */

export interface TerrainMeta {
  width: number;
  height: number;
  bbox: { lonMin: number; lonMax: number; latMin: number; latMax: number };
  worldWidth: number;
  worldHeight: number;
  minEle: number;
  maxEle: number;
  zoom: number;
}

// facteur de relief de base (l'exagération live se fait via group.scale.y)
export const RELIEF_BASE = 0.12;

export class Geo {
  meta: TerrainMeta;
  heights: Int16Array;
  klass: Uint8Array;

  constructor(meta: TerrainMeta, heights: Int16Array, klass: Uint8Array) {
    this.meta = meta;
    this.heights = heights;
    this.klass = klass;
  }

  worldX(lon: number): number {
    const { lonMin, lonMax } = this.meta.bbox;
    const u = (lon - lonMin) / (lonMax - lonMin);
    return (u - 0.5) * this.meta.worldWidth;
  }
  worldZ(lat: number): number {
    const { latMin, latMax } = this.meta.bbox;
    const v = (lat - latMin) / (latMax - latMin); // nord = 1
    return (0.5 - v) * this.meta.worldHeight; // nord → -Z
  }
  eleToY(ele: number): number {
    return (Math.max(0, ele) / this.meta.maxEle) * this.meta.worldWidth * RELIEF_BASE;
  }

  // altitude bilinéaire à (lon,lat)
  sampleEle(lon: number, lat: number): number {
    const { lonMin, lonMax, latMin, latMax } = this.meta.bbox;
    const { width: W, height: H } = this.meta;
    const fx = ((lon - lonMin) / (lonMax - lonMin)) * (W - 1);
    const fy = ((latMax - lat) / (latMax - latMin)) * (H - 1); // ligne 0 = nord
    const x0 = Math.max(0, Math.min(W - 1, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(H - 1, Math.floor(fy)));
    const x1 = Math.min(W - 1, x0 + 1);
    const y1 = Math.min(H - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const h = this.heights;
    const a = h[y0 * W + x0], b = h[y0 * W + x1], c = h[y1 * W + x0], d = h[y1 * W + x1];
    const top = a + (b - a) * tx;
    const bot = c + (d - c) * tx;
    return top + (bot - top) * ty;
  }

  // Y de drapage pour un point géo (avec petit offset au-dessus du sol)
  drapeY(lon: number, lat: number, offset = 0.25): number {
    return this.eleToY(this.sampleEle(lon, lat)) + offset;
  }

  inBox(lon: number, lat: number): boolean {
    const b = this.meta.bbox;
    return lon >= b.lonMin && lon <= b.lonMax && lat >= b.latMin && lat <= b.latMax;
  }

  // lissage box-blur du relief (réduit le bruit, garde les massifs)
  smooth(passes = 1): void {
    const { width: W, height: H } = this.meta;
    let src = this.heights;
    for (let p = 0; p < passes; p++) {
      const dst = new Int16Array(W * H);
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          let s = 0, n = 0;
          for (let dj = -1; dj <= 1; dj++)
            for (let di = -1; di <= 1; di++) {
              const jj = j + dj, ii = i + di;
              if (jj < 0 || jj >= H || ii < 0 || ii >= W) continue;
              s += src[jj * W + ii]; n++;
            }
          dst[j * W + i] = Math.round(s / n);
        }
      src = dst;
    }
    this.heights = src;
  }
}

export async function loadGeo(metaUrl: string, heightUrl: string, klassUrl: string): Promise<Geo> {
  const [meta, hBuf, kBuf] = await Promise.all([
    fetch(metaUrl).then((r) => r.json() as Promise<TerrainMeta>),
    fetch(heightUrl).then((r) => r.arrayBuffer()),
    fetch(klassUrl).then((r) => r.arrayBuffer()),
  ]);
  return new Geo(meta, new Int16Array(hBuf), new Uint8Array(kBuf));
}

export async function loadGeoJSON(url: string): Promise<any> {
  return fetch(url).then((r) => r.json());
}

// distance haversine en km entre deux [lon,lat]
export function haversine(a: number[], b: number[]): number {
  const R = 6371;
  const dLat = ((b[1] - a[1]) * Math.PI) / 180;
  const dLon = ((b[0] - a[0]) * Math.PI) / 180;
  const la1 = (a[1] * Math.PI) / 180;
  const la2 = (b[1] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// longueur totale d'une polyligne [lon,lat][] en km
export function polylineKm(coords: number[][]): number {
  let s = 0;
  for (let i = 1; i < coords.length; i++) s += haversine(coords[i - 1], coords[i]);
  return s;
}

// densifie une polyligne pour qu'elle épouse le relief (segments ~ stepKm)
export function densify(coords: number[][], stepKm = 12): number[][] {
  const out: number[][] = [];
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const d = haversine(a, b);
    const n = Math.max(1, Math.round(d / stepKm));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  out.push(coords[coords.length - 1]);
  return out;
}

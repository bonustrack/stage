
export function youtubeIdOf(text: string | undefined | null): string | null {
  if (!text) return null;
  const patterns = [
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?[^\s]*[?&]?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
    /(?:m\.youtube\.com\/watch\?[^\s]*[?&]?v=)([A-Za-z0-9_-]{11})/,
    /(?:m\.youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m?.[1]) return m[1];
  }
  return null;
}

export interface MapCoords { lat: number; lng: number; sourceUrl: string }

function coordText(value: number): string {
  return value.toFixed(7).replace(/\.?0+$/, '');
}

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${coordText(lat)},${coordText(lng)}`;
}

export function mapCoordsOf(text: string | undefined | null): MapCoords | null {
  if (!text) return null;
  const patterns: RegExp[] = [
    /https?:\/\/[^\s]*maps\.google\.[^\s]*[?&](?:q|ll|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /https?:\/\/[^\s]*maps\.google\.[^\s]*\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /https?:\/\/(?:www\.)?google\.[^\s/]+\/maps[^\s]*[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i,
    /https?:\/\/(?:www\.)?google\.[^\s/]+\/maps\/[^\s]*@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /https?:\/\/(?:www\.)?openstreetmap\.org\/[^\s]*[?&]mlat=(-?\d+(?:\.\d+)?)[^\s]*&mlon=(-?\d+(?:\.\d+)?)/i,
    /https?:\/\/(?:www\.)?openstreetmap\.org\/[^\s]*#map=\d+\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/i,
    /https?:\/\/maps\.apple\.com\/[^\s]*[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    return { lat, lng, sourceUrl: m[0] };
  }
  return null;
}

const TILE = 256;
const MAX_LAT = 85.0511;

export interface MapView { zoom: number; width: number; height: number }

export interface MapTile { url: string; left: number; top: number; width: number; height: number }

function worldPoint(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const size = TILE * 2 ** zoom;
  const rad = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size,
  };
}

function tileSpan(center: number, span: number): number[] {
  const first = Math.floor((center - span / 2) / TILE);
  const last = Math.ceil((center + span / 2) / TILE) - 1;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

export function osmTileGrid(lat: number, lng: number, view: MapView): MapTile[] {
  const n = 2 ** view.zoom;
  const center = worldPoint(lat, lng, view.zoom);
  const left = center.x - view.width / 2;
  const top = center.y - view.height / 2;
  const rows = tileSpan(center.y, view.height).filter(y => y >= 0 && y < n);
  return rows.flatMap(y => tileSpan(center.x, view.width).map(x => ({
    url: `https://tile.openstreetmap.org/${view.zoom}/${((x % n) + n) % n}/${y}.png`,
    left: ((x * TILE - left) / view.width) * 100,
    top: ((y * TILE - top) / view.height) * 100,
    width: (TILE / view.width) * 100,
    height: (TILE / view.height) * 100,
  })));
}

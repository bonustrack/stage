
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

export function mapCoordsOf(text: string | undefined | null): MapCoords | null {
  if (!text) return null;
  const patterns: RegExp[] = [
    /https?:\/\/[^\s]*maps\.google\.[^\s]*[?&](?:q|ll|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /https?:\/\/[^\s]*maps\.google\.[^\s]*\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
    /https?:\/\/(?:www\.)?google\.[^\s/]+\/maps[^\s]*[?&](?:q|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
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

export function osmTileXY(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

export function osmTileUrl(lat: number, lng: number, zoom = 14): string {
  const { x, y } = osmTileXY(lat, lng, zoom);
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

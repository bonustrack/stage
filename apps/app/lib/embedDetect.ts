/** Pure detection helpers for content embeds rendered inside MessengerBubble.
 *  Tests live alongside the bubble renderer — all logic here is regex-only so
 *  it stays unit-testable + works in both the RN app and the Vue web client. */

/** Extract a YouTube video id from a message body. Supports:
 *   - youtu.be/<id>(?…)
 *   - youtube.com/watch?v=<id>(&…)
 *   - youtube.com/shorts/<id>
 *   - m.youtube.com/watch?v=<id>
 *  Returns null when no link is present. */
export function youtubeIdOf(text: string | undefined | null): string | null {
  if (!text) return null;
  const patterns = [
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?[^\s]*[?&]?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:m\.youtube\.com\/watch\?[^\s]*[?&]?v=)([A-Za-z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = p.exec(text);
    if (m?.[1]) return m[1];
  }
  return null;
}

export interface MapCoords { lat: number; lng: number; sourceUrl: string }

/** Extract lat/lng + the original URL from a message body containing a Google
 *  Maps / OSM / Apple Maps link. Handles the formats Less's location-share
 *  message produces (`📍 https://maps.google.com/?q=<lat>,<lng>`) and the
 *  common alternates a peer might paste.
 *
 *  Returns null when no recognizable map link is present. */
export function mapCoordsOf(text: string | undefined | null): MapCoords | null {
  if (!text) return null;
  /** Google Maps ?q=lat,lng, ?ll=lat,lng, or /@lat,lng,zoom */
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

/** Compute an OSM XYZ tile coordinate for the given lat/lng + zoom. Used to
 *  render a single tile.openstreetmap.org image as a location preview without
 *  an API key. Returns integer x/y in [0, 2^zoom). */
export function osmTileXY(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
}

/** OSM static tile URL at the given lat/lng/zoom. The OSM tile server is
 *  public + free for reasonable usage. We render a single 256x256 tile —
 *  enough for a "where they are roughly" preview. */
export function osmTileUrl(lat: number, lng: number, zoom = 14): string {
  const { x, y } = osmTileXY(lat, lng, zoom);
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

import { describe, expect, test } from 'bun:test';
import { googleMapsUrl, mapCoordsOf, osmTileGrid, type MapTile } from '../src/embed/detect';

describe('googleMapsUrl', () => {
  test('builds the universal Google Maps search link', () => {
    expect(googleMapsUrl(12.3456, -65.4321)).toBe(
      'https://www.google.com/maps/search/?api=1&query=12.3456,-65.4321',
    );
  });

  test('never writes a coordinate in exponent form', () => {
    expect(googleMapsUrl(0.0000001, -0.0000004)).toBe(
      'https://www.google.com/maps/search/?api=1&query=0.0000001,-0.0000004',
    );
    expect(googleMapsUrl(10, -20.123456789)).toBe(
      'https://www.google.com/maps/search/?api=1&query=10,-20.1234568',
    );
  });

  test('round trips through mapCoordsOf', () => {
    const url = googleMapsUrl(-33.123456, 151.654321);
    expect(mapCoordsOf(`📍 ${url}`)).toEqual({ lat: -33.123456, lng: 151.654321, sourceUrl: url });
  });
});

describe('mapCoordsOf', () => {
  test('parses a Google Maps search link with an encoded comma', () => {
    expect(mapCoordsOf('https://www.google.com/maps/search/?api=1&query=10.5%2C20.25')).toMatchObject({
      lat: 10.5, lng: 20.25,
    });
  });

  test('still parses an old OpenStreetMap share link', () => {
    const url = 'https://www.openstreetmap.org/?mlat=12.3456&mlon=-65.4321#map=16/12.3456/-65.4321';
    expect(mapCoordsOf(`📍 ${url}`)).toMatchObject({ lat: 12.3456, lng: -65.4321 });
  });

  test('parses an OpenStreetMap map fragment link', () => {
    expect(mapCoordsOf('https://www.openstreetmap.org/#map=16/-12.5/45.75')).toMatchObject({
      lat: -12.5, lng: 45.75,
    });
  });

  test('rejects out of range coordinates and plain text', () => {
    expect(mapCoordsOf('https://www.google.com/maps/search/?api=1&query=95,10')).toBeNull();
    expect(mapCoordsOf('no link here')).toBeNull();
    expect(mapCoordsOf(null)).toBeNull();
  });
});

function covers(tiles: MapTile[], axis: 'left' | 'top', size: 'width' | 'height'): boolean {
  const starts = [...new Set(tiles.map(t => t[axis]))].sort((a, b) => a - b);
  const first = starts[0] ?? 1;
  const last = (starts.at(-1) ?? 0) + (tiles[0]?.[size] ?? 0);
  const contiguous = starts.every((start, i) => i === 0 || Math.abs(start - (starts[i - 1] ?? 0) - (tiles[0]?.[size] ?? 0)) < 1e-9);
  return first <= 0 && last >= 100 && contiguous;
}

describe('osmTileGrid', () => {
  const view = { zoom: 15, width: 512, height: 320 };

  test('fills the whole view with at most a 3x3 grid', () => {
    for (const [lat, lng] of [[12.3456, -65.4321], [-33.5, 151.25], [0, 0], [64.1, -21.9]] as const) {
      const tiles = osmTileGrid(lat, lng, view);
      expect(tiles.length).toBeLessThanOrEqual(9);
      expect(covers(tiles, 'left', 'width')).toBe(true);
      expect(covers(tiles, 'top', 'height')).toBe(true);
    }
    expect(osmTileGrid(12.3456, -65.4321, { zoom: 15, width: 144, height: 144 }).length).toBeLessThanOrEqual(4);
  });

  test('puts the point at the exact centre of the view', () => {
    const lat = 12.3456;
    const lng = -65.4321;
    const n = 2 ** view.zoom;
    const worldX = ((lng + 180) / 360) * n;
    const rad = (lat * Math.PI) / 180;
    const worldY = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
    const url = `https://tile.openstreetmap.org/15/${Math.floor(worldX)}/${Math.floor(worldY)}.png`;
    const tile = osmTileGrid(lat, lng, view).find(t => t.url === url);
    expect(tile).toBeDefined();
    if (!tile) return;
    expect(tile.left + (worldX % 1) * tile.width).toBeCloseTo(50, 9);
    expect(tile.top + (worldY % 1) * tile.height).toBeCloseTo(50, 9);
  });

  test('wraps tiles across the antimeridian', () => {
    const urls = osmTileGrid(10, 179.999, view).map(t => t.url);
    expect(urls.some(u => /\/15\/0\/\d+\.png$/.test(u))).toBe(true);
    expect(urls.every(u => /^https:\/\/tile\.openstreetmap\.org\/15\/\d+\/\d+\.png$/.test(u))).toBe(true);
  });
});

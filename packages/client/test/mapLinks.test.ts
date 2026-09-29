import { describe, expect, test } from 'bun:test';
import { googleMapsUrl, mapCoordsOf } from '../src/embed/detect';

describe('googleMapsUrl', () => {
  test('builds the universal Google Maps search link', () => {
    expect(googleMapsUrl(12.3456, -65.4321)).toBe(
      'https://www.google.com/maps/search/?api=1&query=12.3456,-65.4321',
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

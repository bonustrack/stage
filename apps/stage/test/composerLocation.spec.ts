import { describe, expect, test } from 'bun:test';
import { isLocation, locationAttachment, locationText, withLocation } from '../components/composer/location.model';
import type { Attachment } from '../components/composer/types';

const photo: Attachment = { id: 'photo', url: 'blob:photo', kind: 'image', mime: 'image/png', size: 10, name: 'photo.png' };

describe('share location adds a pending attachment', () => {
  test('a location attachment carries the Google Maps link', () => {
    const location = locationAttachment(12.3456, -65.4321, 'loc');
    expect(location).toEqual({
      id: 'loc', kind: 'location', mime: '', size: 0, name: 'Location',
      url: 'https://www.google.com/maps/search/?api=1&query=12.3456,-65.4321',
    });
    expect(isLocation(location)).toBe(true);
    expect(isLocation(photo)).toBe(false);
    expect(locationText(location)).toBe('📍 https://www.google.com/maps/search/?api=1&query=12.3456,-65.4321');
  });

  test('sits next to pending images', () => {
    const location = locationAttachment(1.5, 2.5, 'loc');
    expect(withLocation([photo], location)).toEqual([photo, location]);
  });

  test('a new location replaces the previous one and keeps the images', () => {
    const first = locationAttachment(1.5, 2.5, 'loc-1');
    const second = locationAttachment(-3.25, 4.75, 'loc-2');
    expect(withLocation([first, photo], second)).toEqual([photo, second]);
  });
});

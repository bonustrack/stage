import { googleMapsUrl } from '@stage-labs/client/embed/detect';
import type { Attachment } from './types';

export function locationAttachment(lat: number, lng: number, id: string): Attachment {
  return { id, url: googleMapsUrl(lat, lng), kind: 'location', mime: '', size: 0, name: 'Location' };
}

export function isLocation(at: Attachment): boolean {
  return at.kind === 'location';
}

export function withLocation(pending: Attachment[], location: Attachment): Attachment[] {
  return [...pending.filter(at => !isLocation(at)), location];
}

export function locationText(location: Attachment): string {
  return `📍 ${location.url}`;
}

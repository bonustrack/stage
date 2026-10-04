type AudioRoute = 'EARPIECE' | 'SPEAKER_PHONE' | 'WIRED_HEADSET' | 'BLUETOOTH';

export interface AudioRoutes { available: readonly AudioRoute[]; selected: AudioRoute | null }

export const NO_ROUTES: AudioRoutes = { available: [], selected: null };

const ROUTES: readonly AudioRoute[] = ['BLUETOOTH', 'WIRED_HEADSET', 'EARPIECE', 'SPEAKER_PHONE'];
const HEADSETS: readonly AudioRoute[] = ['BLUETOOTH', 'WIRED_HEADSET'];

function routeOf(value: unknown): AudioRoute | null {
  return ROUTES.find(route => route === value) ?? null;
}

export function parseAudioRoutes(status: unknown): AudioRoutes {
  if (typeof status !== 'object' || status === null) return NO_ROUTES;
  const list = 'availableAudioDeviceList' in status ? status.availableAudioDeviceList : null;
  const names: readonly string[] = typeof list === 'string' ? list.match(/[A-Z_]+/g) ?? [] : [];
  return {
    available: ROUTES.filter(route => names.includes(route)),
    selected: routeOf('selectedAudioDevice' in status ? status.selectedAudioDevice : null),
  };
}

export function speakerOn(routes: AudioRoutes): boolean {
  return routes.selected === 'SPEAKER_PHONE';
}

function privateRoute(routes: AudioRoutes): AudioRoute | null {
  return routes.available.find(route => route !== 'SPEAKER_PHONE') ?? null;
}

export function canToggleSpeaker(routes: AudioRoutes): boolean {
  return routes.available.includes('SPEAKER_PHONE') && privateRoute(routes) !== null;
}

export function speakerTarget(routes: AudioRoutes): AudioRoute | null {
  if (!canToggleSpeaker(routes)) return null;
  return speakerOn(routes) ? privateRoute(routes) : 'SPEAKER_PHONE';
}

export function joinedHeadset(before: AudioRoutes, after: AudioRoutes): AudioRoute | null {
  if (before.available.length === 0) return null;
  return HEADSETS.find(route => after.available.includes(route) && !before.available.includes(route) && after.selected !== route) ?? null;
}

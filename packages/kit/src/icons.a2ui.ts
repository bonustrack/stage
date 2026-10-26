import type { HERO_ICON_DATA } from './heroicons.data';

type KitIconName = keyof typeof HERO_ICON_DATA;

export type A2uiExtraIcon = 'brokenHeart' | 'bellOff' | 'skip' | 'backward' | 'starLines' | 'volumeDown' | 'mute';

export const A2UI_ICONS = {
  accountCircle: 'userCircle',
  add: 'plus',
  arrowBack: 'arrowLeft',
  arrowForward: 'arrowRight',
  attachFile: 'paperClip',
  calendarToday: 'calendar',
  call: 'phone',
  camera: 'camera',
  check: 'check',
  close: 'x',
  delete: 'trash',
  download: 'download',
  edit: 'pencil',
  event: 'calendar',
  error: 'exclamationCircle',
  fastForward: 'fastForward',
  favorite: 'heart',
  favoriteOff: { extra: 'brokenHeart' },
  folder: 'folder',
  help: 'questionMarkCircle',
  home: 'home',
  info: 'informationCircle',
  locationOn: 'locationMarker',
  lock: 'lockClosed',
  lockOpen: 'lockOpen',
  mail: 'mail',
  menu: 'menu',
  moreVert: 'dotsVertical',
  moreHoriz: 'dotsHorizontal',
  notificationsOff: { extra: 'bellOff' },
  notifications: 'bell',
  pause: 'pause',
  payment: 'creditCard',
  person: 'user',
  phone: 'phone',
  photo: 'photograph',
  play: 'play',
  print: 'printer',
  refresh: 'refresh',
  rewind: 'rewind',
  search: 'search',
  send: 'paperAirplane',
  settings: 'cog',
  share: 'share',
  shoppingCart: 'shoppingCart',
  skipNext: { extra: 'skip' },
  skipPrevious: { extra: 'backward' },
  star: 'star',
  starHalf: { extra: 'starLines' },
  starOff: 'star',
  stop: 'stop',
  upload: 'upload',
  visibility: 'eye',
  visibilityOff: 'eyeOff',
  volumeDown: { extra: 'volumeDown' },
  volumeMute: { extra: 'mute' },
  volumeOff: 'volumeOff',
  volumeUp: 'volumeUp',
  warning: 'exclamation',
} as const satisfies Record<string, KitIconName | { extra: A2uiExtraIcon }>;

export type A2uiIconName = keyof typeof A2UI_ICONS;

export const A2UI_ICON_NAMES = Object.keys(A2UI_ICONS) as A2uiIconName[];

export function isA2uiIconName(name: string): name is A2uiIconName {
  return Object.hasOwn(A2UI_ICONS, name);
}


export const colors = {
  'bg-dark': '#0e0f10',
  'bg-light': '#ffffff',
  'surface-dark': '#282a2d',
  'surface-light': '#e4e4e5',
  'input-bg-dark': '#1c1d1f',
  'input-bg-light': '#f2f2f3',
  'toolbar-bg-dark': '#0e0f10',
  'toolbar-bg-light': '#ffffff',
  'hover-dark': '#1c1d1f',
  'hover-light': '#f2f2f3',
  'fg-dark': '#9f9fa3',
  'fg-light': '#57606a',
  'sub-dark': '#7a7a7e',
  'sub-light': '#8a929d',
  'head-dark': '#ffffff',
  'head-light': '#000000',
  'border-dark': '#282a2d',
  'border-light': '#e4e4e5',
  accent: '#ffffff',
  'accent-hover': '#cccccc',
  ok: '#83c989',
  warn: '#c0a06e',
  err: '#d96868',
  'danger-dark': '#eb4c5b',
  'danger-light': '#eb4c5b',
  'success-dark': '#57b375',
  'success-light': '#57b375',
  'primary-dark': '#ffffff',
  'primary-light': '#000000',
  'link-dark': '#ffffff',
  'link-light': '#000000',
} as const;

export const semanticColors = {
  bgColor: { dark: colors['bg-dark'], light: colors['bg-light'] },
  borderColor: { dark: colors['border-dark'], light: colors['border-light'] },
  textColor: { dark: colors['fg-dark'], light: colors['fg-light'] },
  subColor: { dark: colors['sub-dark'], light: colors['sub-light'] },
  linkColor: { dark: colors['link-dark'], light: colors['link-light'] },
  primaryColor: { dark: colors['primary-dark'], light: colors['primary-light'] },
  dangerColor: { dark: colors['danger-dark'], light: colors['danger-light'] },
  successColor: { dark: colors['success-dark'], light: colors['success-light'] },
  inputBgColor: { dark: colors['input-bg-dark'], light: colors['input-bg-light'] },
  toolbarBgColor: { dark: colors['toolbar-bg-dark'], light: colors['toolbar-bg-light'] },
} as const;

export function semanticPalette(scheme: 'light' | 'dark'): {
  bgColor: string; borderColor: string; textColor: string; subColor: string;
  linkColor: string; primaryColor: string;
  dangerColor: string; successColor: string;
  inputBgColor: string; toolbarBgColor: string;
} {
  return {
    bgColor: semanticColors.bgColor[scheme],
    borderColor: semanticColors.borderColor[scheme],
    textColor: semanticColors.textColor[scheme],
    subColor: semanticColors.subColor[scheme],
    linkColor: semanticColors.linkColor[scheme],
    primaryColor: semanticColors.primaryColor[scheme],
    dangerColor: semanticColors.dangerColor[scheme],
    successColor: semanticColors.successColor[scheme],
    inputBgColor: semanticColors.inputBgColor[scheme],
    toolbarBgColor: semanticColors.toolbarBgColor[scheme],
  };
}

export type ColorToken =
  | 'text'
  | 'secondary'
  | 'muted'
  | 'link'
  | 'primary'
  | 'danger'
  | 'success'
  | 'border';

const COLOR_TOKEN_MAP: Record<ColorToken, keyof typeof semanticColors> = {
  text: 'textColor',
  secondary: 'subColor',
  muted: 'subColor',
  link: 'linkColor',
  primary: 'primaryColor',
  danger: 'dangerColor',
  success: 'successColor',
  border: 'borderColor',
};

export function isColorToken(c: string): c is ColorToken {
  return c in COLOR_TOKEN_MAP;
}

export function resolveColorToken(c: string, scheme: 'light' | 'dark'): string {
  return isColorToken(c) ? semanticColors[COLOR_TOKEN_MAP[c]][scheme] : c;
}

export interface SchemePalette {
  head: string;
  text: string;
  sub: string;
  surface: string;
  pressed: string;
  border: string;
}

export function schemePalette(dark: boolean): SchemePalette {
  const k = dark ? 'dark' : 'light';
  return {
    head: colors[`head-${k}`],
    text: colors[`fg-${k}`],
    sub: colors[`sub-${k}`],
    surface: colors[`hover-${k}`],
    pressed: colors[`hover-${k}`],
    border: colors[`border-${k}`],
  };
}

export const RADIUS_DEFAULT = 999;
export const RADIUS_MIN = 0;
export const RADIUS_MAX = 999;
export const BUTTON_RADIUS_DEFAULT = 999;
export const BLOCK_RADIUS_DEFAULT = 12;


export type FontSizeName =
  | '3xs'
  | '2xs'
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | '7xl';

export const FONT_SIZE: Record<FontSizeName, number> = {
  '3xs': 11,
  '2xs': 12,
  xs: 13,
  sm: 14,
  md: 15,
  lg: 16,
  xl: 17,
  '2xl': 18,
  '3xl': 19,
  '4xl': 20,
  '5xl': 24,
  '6xl': 32,
  '7xl': 40,
} as const;

export const FONT_SIZE_DEFAULT: FontSizeName = 'md';

export function fontSize(name: FontSizeName): number {
  return FONT_SIZE[name];
}

export const FONT_SIZE_SNAP: Record<string, FontSizeName> = {
  '10': '3xs', '11': '3xs',
  '12': '2xs',
  '13': 'xs',
  '14': 'sm',
  '15': 'md',
  '16': 'lg',
  '17': 'xl',
  '18': '2xl',
  '19': '3xl',
  '20': '4xl',
  '22': '5xl', '24': '5xl', '26': '5xl',
  '28': '6xl', '34': '6xl', '38': '6xl',
} as const;

export const fontFamily = {
  sans: ['Calibre-Medium', 'system-ui', 'sans-serif'],
  head: ['Calibre-Semibold', 'system-ui', 'sans-serif'],
  mono: ['Menlo', 'ui-monospace', 'monospace'],
} as const;


export type RadiusName = 'pill' | 'round' | 'soft' | 'sharp';

export const RADIUS_SCALE: Record<RadiusName, number> = {
  pill: 999,
  round: 16,
  soft: 12,
  sharp: 0,
} as const;

export const RADIUS_NAME_DEFAULT: RadiusName = 'pill';

export {
  type RadiusValue,
  BOX_RADIUS_SCALE,
  isRadiusValue,
  resolveBoxRadius,
} from './radius';

export type Density = 'compact' | 'normal' | 'spacious';

export const DENSITY_SCALE: Record<Density, { paddingX: number; paddingY: number; gap: number }> = {
  compact: { paddingX: 10, paddingY: 6, gap: 6 },
  normal: { paddingX: 14, paddingY: 10, gap: 10 },
  spacious: { paddingX: 18, paddingY: 14, gap: 14 },
} as const;

export const DENSITY_DEFAULT: Density = 'normal';

export type BaseSize = 14 | 15 | 16 | 17 | 18;

export const BASE_SIZE_DEFAULT: BaseSize = 15;

export interface KitTheme {
  colorScheme: 'light' | 'dark';
  color: {
    surface: { background: string; foreground: string };
    accent: { primary: string; level: 0 | 1 | 2 | 3 };
  };
  status: { danger: string; success: string };
  border: string;
  radius: { name: RadiusName; px: number };
  density: { name: Density; paddingX: number; paddingY: number; gap: number };
  typography: { baseSize: BaseSize; fontFamily: string; fontFamilyMono: string };
}

export interface KitThemeOptions {
  radius?: RadiusName;
  density?: Density;
  baseSize?: BaseSize;
  accentLevel?: 0 | 1 | 2 | 3;
}

export function kitTheme(scheme: 'light' | 'dark', opts: KitThemeOptions = {}): KitTheme {
  const radiusName = opts.radius ?? RADIUS_NAME_DEFAULT;
  const densityName = opts.density ?? DENSITY_DEFAULT;
  const density = DENSITY_SCALE[densityName];
  return {
    colorScheme: scheme,
    color: {
      surface: {
        background: semanticColors.bgColor[scheme],
        foreground: semanticColors.textColor[scheme],
      },
      accent: {
        primary: semanticColors.linkColor[scheme],
        level: opts.accentLevel ?? 0,
      },
    },
    status: {
      danger: semanticColors.dangerColor[scheme],
      success: semanticColors.successColor[scheme],
    },
    border: semanticColors.borderColor[scheme],
    radius: { name: radiusName, px: RADIUS_SCALE[radiusName] },
    density: { name: densityName, ...density },
    typography: {
      baseSize: opts.baseSize ?? BASE_SIZE_DEFAULT,
      fontFamily: fontFamily.sans[0],
      fontFamilyMono: fontFamily.mono[0],
    },
  };
}

/** Badge - a ChatKit-styled pill / chip for the Metro mobile client.
 *
 *  Mirrors OpenAI ChatKit's `Badge` widget node (WidgetNode). Real ChatKit
 *  props kept verbatim: `label`, `color`, `variant`, `pill`, `size`. The only
 *  deviation is the `dark` boolean (kit is hook-free, the caller passes the
 *  effective scheme).
 *
 *  Badge is ChatKit's node for unread counts, label chips, and status pills -
 *  the 999-radius blocks that recur across apps/app (ChannelRow unread counts +
 *  LabelChips, group labels, status pills). `variant` controls the fill:
 *    - solid    color background, contrast text
 *    - soft     translucent color background, color text (default)
 *    - outline  transparent background, color border + text
 *  `pill` (default true) gives fully-rounded corners; false uses a soft radius.
 *  `color` accepts a hex/token and defaults to the muted scheme fill. */

import { View, Text as RNText, type ViewStyle } from 'react-native';

export type BadgeVariant = 'solid' | 'soft' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'lg';

const SIZE: Record<BadgeSize, { font: number; padH: number; padV: number; minH: number }> = {
  sm: { font: 11, padH: 6, padV: 1, minH: 16 },
  md: { font: 12, padH: 8, padV: 2, minH: 20 },
  lg: { font: 14, padH: 10, padV: 3, minH: 24 },
};

export interface BadgeProps {
  /** ChatKit: label. Text or count shown in the badge. */
  label: string | number;
  /** ChatKit: color. Token/hex driving the fill/text. Defaults to scheme accent. */
  color?: string;
  /** ChatKit: variant. solid | soft | outline. Default 'soft'. */
  variant?: BadgeVariant;
  /** ChatKit: pill. Fully-rounded corners. Default true. */
  pill?: boolean;
  /** ChatKit: size. Default 'md'. */
  size?: BadgeSize;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark: boolean;
  /** Escape-hatch style merged last. */
  style?: ViewStyle;
}

/** Add an alpha channel to a #rrggbb hex (for the soft fill). */
function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${a}`;
}

/** Readable text color on a solid fill: white on dark fills, near-black on light. */
function contrastOn(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#ffffff';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? '#000000' : '#ffffff';
}

/** ChatKit-style RN badge. */
export function Badge(props: BadgeProps): React.ReactElement {
  const { label, color, variant = 'soft', pill = true, size = 'md', dark, style } = props;
  const s = SIZE[size];
  const accent = color ?? (dark ? '#9f9fa3' : '#57606a');

  let bg = 'transparent';
  let fg = accent;
  let borderColor = 'transparent';
  let borderWidth = 0;
  if (variant === 'solid') {
    bg = accent;
    fg = contrastOn(accent);
  } else if (variant === 'soft') {
    bg = withAlpha(accent, dark ? 0.22 : 0.16);
    fg = accent;
  } else {
    borderColor = accent;
    borderWidth = 1;
    fg = accent;
  }

  const base: ViewStyle = {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: s.minH,
    paddingHorizontal: s.padH,
    paddingVertical: s.padV,
    borderRadius: pill ? 999 : 8,
    backgroundColor: bg,
    borderColor,
    borderWidth,
  };

  return (
    <View style={style ? [base, style] : base}>
      <RNText style={{ color: fg, fontSize: s.font, fontFamily: 'Calibre-Semibold' }} numberOfLines={1}>
        {label}
      </RNText>
    </View>
  );
}

import { Pressable, Text as RNText, View, type TextStyle, type ViewStyle } from 'react-native';
import { Glyph, type CentralIcon } from './glyph';
import { surfaceColor } from '../layout';
import { textRoleColor } from '../text.styles';
import { FONT_SIZE, RADIUS_SCALE, fontName, kitPalette, type Scheme } from '../tokens';
import { useKitPalette, useKitScheme } from './theme-context';

export interface TabsOptionView {
  value: string;
  label: string;
  icon?: CentralIcon;
}

export interface TabsProps {
  value: string;
  options: TabsOptionView[];
  variant?: 'segmented' | 'underline';
  onChange?: (value: string) => void;
  dark?: boolean;
}

interface TabsColors {
  track: string | undefined;
  thumb: string | undefined;
  text: string;
  activeText: string;
}

function schemeOf(dark: boolean | undefined, fallback: Scheme): Scheme {
  if (dark === undefined) return fallback;
  return dark ? 'dark' : 'light';
}

function useTabsColors(dark: boolean | undefined): TabsColors {
  const context = useKitPalette();
  const contextScheme = useKitScheme();
  const scheme = schemeOf(dark, contextScheme);
  const palette = scheme === contextScheme ? context : kitPalette(scheme);
  return {
    track: surfaceColor('raised', palette),
    thumb: surfaceColor('surface', palette),
    text: textRoleColor('secondary', palette),
    activeText: textRoleColor('default', palette),
  };
}

function trackStyle(underline: boolean, c: TabsColors): ViewStyle {
  if (underline) return { flexDirection: 'row', gap: 16 };
  return { flexDirection: 'row', gap: 2, padding: 3, borderRadius: RADIUS_SCALE.pill, backgroundColor: c.track };
}

function segmentStyle(underline: boolean, selected: boolean, c: TabsColors): ViewStyle {
  const base: ViewStyle = { flexDirection: 'row', alignItems: 'center', gap: 6 };
  if (underline) {
    return { ...base, paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: selected ? c.activeText : 'transparent' };
  }
  return {
    ...base,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: RADIUS_SCALE.pill,
    backgroundColor: selected ? c.thumb : 'transparent',
  };
}

function labelStyle(underline: boolean, color: string): TextStyle {
  if (underline) return { color, fontSize: FONT_SIZE['2xl'], fontFamily: fontName.head };
  return { color, fontSize: FONT_SIZE.lg, fontFamily: fontName.sans };
}

export function Tabs(props: TabsProps): React.ReactElement {
  const { value, options, variant = 'segmented', onChange, dark } = props;
  const c = useTabsColors(dark);
  const underline = variant === 'underline';
  return (
    <View style={trackStyle(underline, c)}>
      {options.map((opt) => {
        const selected = opt.value === value;
        const color = selected ? c.activeText : c.text;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange?.(opt.value)}
            style={segmentStyle(underline, selected, c)}
          >
            {opt.icon ? <Glyph icon={opt.icon} size={16} color={color} /> : null}
            <RNText numberOfLines={1} style={labelStyle(underline, color)}>{opt.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

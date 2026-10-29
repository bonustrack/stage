import { useState, type ReactNode } from 'react';
import { Pressable, Text as RNText, View, type TextStyle, type ViewStyle } from 'react-native';
import { surfaceColor } from '../layout';
import { FONT_SIZE, RADIUS_SCALE, fontName, kitPalette, type Scheme } from '../tokens';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';
import { Icon, type IconName } from './icon';
import { useKitPalette, useKitScheme } from './theme-context';

export type TabsVariant = 'segmented' | 'underline';

export interface TabItem {
  title: string;
  child?: ReactNode;
  icon?: IconName;
}

export interface TabsProps extends A2uiCommonProps {
  tabs: readonly TabItem[];
  selectedIndex?: number;
  defaultIndex?: number;
  onChange?: (index: number) => void;
  variant?: TabsVariant;
  dark?: boolean;
}

interface TabsColors {
  track: string | undefined;
  thumb: string | undefined;
  text: string;
  activeText: string;
}

function useTabsColors(dark: boolean | undefined): TabsColors {
  const context = useKitPalette();
  const contextScheme = useKitScheme();
  const scheme: Scheme = dark === undefined ? contextScheme : dark ? 'dark' : 'light';
  const palette = scheme === contextScheme ? context : kitPalette(scheme);
  return { track: surfaceColor('raised', palette), thumb: surfaceColor('surface', palette), text: palette.sub, activeText: palette.link };
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
  if (underline) return { color, fontSize: FONT_SIZE.lg, fontFamily: fontName.head };
  return { color, fontSize: FONT_SIZE.sm, fontFamily: fontName.sans };
}

const CONTENT_GAP = 12;

export function Tabs(props: TabsProps): React.ReactElement {
  const { tabs, selectedIndex, defaultIndex = 0, onChange, variant = 'segmented', dark, weight, accessibility } = props;
  const [internal, setInternal] = useState(defaultIndex);
  const current = selectedIndex ?? internal;
  const c = useTabsColors(dark);
  const underline = variant === 'underline';
  const select = (index: number): void => {
    if (selectedIndex === undefined) setInternal(index);
    onChange?.(index);
  };
  const content = tabs[current]?.child;
  const bar = (
    <View style={trackStyle(underline, c)} accessibilityRole="tablist">
      {tabs.map((tab, index) => {
        const selected = index === current;
        const color = selected ? c.activeText : c.text;
        return (
          <Pressable
            key={`${index}:${tab.title}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              select(index);
            }}
            style={segmentStyle(underline, selected, c)}
          >
            {tab.icon === undefined ? null : <Icon name={tab.icon} size={16} color={color} />}
            <RNText numberOfLines={1} style={labelStyle(underline, color)}>
              {tab.title}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
  if (content === undefined && weight === undefined && accessibility === undefined) return bar;
  return (
    <View {...accessibilityProps(accessibility)} style={[{ gap: CONTENT_GAP }, weightStyle(weight)]}>
      {bar}
      {content}
    </View>
  );
}

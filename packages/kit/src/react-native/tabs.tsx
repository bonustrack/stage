
import { Pressable, Text as RNText, View, type ViewStyle } from 'react-native';
import { Icon } from './icon';
import type { HeroIconName } from '@stage-labs/kit/icons';

export interface TabsOptionView {
  value: string;
  label: string;
  icon?: HeroIconName;
}

export interface TabsProps {
  value: string;
  options: TabsOptionView[];
  variant?: 'segmented' | 'underline';
  onChange?: (value: string) => void;
  dark?: boolean;
}

function palette(dark: boolean): {
  bg: string;
  active: string;
  text: string;
  activeText: string;
} {
  return {
    bg: dark ? '#1c1c1e' : '#f0f0f2',
    active: dark ? '#000000' : '#ffffff',
    text: dark ? '#9a9ca0' : '#6b6d72',
    activeText: dark ? '#ffffff' : '#000000',
  };
}

function segmentStyle(selected: boolean, p: ReturnType<typeof palette>): ViewStyle {
  return {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: selected ? p.active : 'transparent',
  };
}

export function Tabs(props: TabsProps): React.ReactElement {
  const { value, options, variant = 'segmented', onChange, dark = false } = props;
  const p = palette(dark);
  const underline = variant === 'underline';
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: underline ? 16 : 4,
        padding: underline ? 0 : 3,
        borderRadius: 11,
        backgroundColor: underline ? 'transparent' : p.bg,
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange?.(opt.value)}
            style={
              underline
                ? {
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: 8,
                    borderBottomWidth: 2,
                    borderBottomColor: selected ? p.activeText : 'transparent',
                  }
                : segmentStyle(selected, p)
            }
          >
            {opt.icon ? (
              <Icon
                name={opt.icon}
                size={16}
                color={selected ? p.activeText : p.text}
              />
            ) : null}
            <RNText
              style={{
                color: selected ? p.activeText : p.text,
                fontSize: 14,
                fontFamily: 'Calibre-Semibold',
              }}
            >
              {opt.label}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

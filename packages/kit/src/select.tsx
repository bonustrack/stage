/** Select - a ChatKit-styled dropdown for the Metro mobile client.
 *
 *  Mirrors OpenAI ChatKit's `Select` widget node (WidgetNode). Real ChatKit
 *  props kept verbatim: `options`, `name`, `placeholder`, `variant`, `size`,
 *  `pill`, `block`, `clearable`, `disabled`. Deviations the proposal calls out:
 *  a `dark` boolean (kit is hook-free re: app theme) and `onChange`/`value` in
 *  place of ChatKit's server `onChangeAction`/`defaultValue` (RN dispatches a
 *  local handler; the field is controlled).
 *
 *  Visual: a trigger row (current label or placeholder + chevron) that opens a
 *  bottom-anchored option sheet on press. `variant` matches Badge/Button fills
 *  (solid | soft | outline, default outline). `block` makes it full-width;
 *  `pill` rounds the trigger fully. `clearable` shows a clear affordance once a
 *  value is set. Internal open state is component-local useState (not an app
 *  theme hook), so the kit stays free of the app's hooks. */

import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text as RNText, View, type ViewStyle } from 'react-native';
import { BLOCK_RADIUS_DEFAULT } from './tokens';

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectVariant = 'solid' | 'soft' | 'outline';
export type SelectSize = 'sm' | 'md' | 'lg';

const SIZE: Record<SelectSize, { font: number; padH: number; padV: number }> = {
  sm: { font: 14, padH: 10, padV: 6 },
  md: { font: 15, padH: 12, padV: 9 },
  lg: { font: 16, padH: 14, padV: 12 },
};

export interface SelectProps {
  /** ChatKit: options. */
  options: SelectOption[];
  /** Controlled value (ChatKit: defaultValue is uncontrolled; we control it). */
  value?: string;
  /** RN form of ChatKit onChangeAction. */
  onChange: (value: string) => void;
  /** ChatKit: name. */
  name?: string;
  /** ChatKit: placeholder. Shown when no value is selected. */
  placeholder?: string;
  /** ChatKit: variant. Default 'outline'. */
  variant?: SelectVariant;
  /** ChatKit: size. Default 'md'. */
  size?: SelectSize;
  /** ChatKit: pill. Fully-rounded trigger. */
  pill?: boolean;
  /** ChatKit: block. Full-width trigger. */
  block?: boolean;
  /** ChatKit: clearable. Allow clearing the selection (emits ''). */
  clearable?: boolean;
  /** ChatKit: disabled. */
  disabled?: boolean;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark: boolean;
  /** Escape-hatch style merged onto the trigger last. */
  style?: ViewStyle;
}

function palette(dark: boolean): {
  surface: string; border: string; head: string; sub: string; pressed: string; scrim: string;
} {
  return dark
    ? { surface: '#1c1d1f', border: '#282a2d', head: '#ffffff', sub: '#7a7a7e', pressed: '#282a2d', scrim: 'rgba(0,0,0,0.5)' }
    : { surface: '#ffffff', border: '#e4e4e5', head: '#000000', sub: '#8a929d', pressed: '#f2f2f3', scrim: 'rgba(0,0,0,0.35)' };
}

/** ChatKit-style RN select. */
export function Select(props: SelectProps): React.ReactElement {
  const {
    options, value, onChange, name, placeholder = 'Select', variant = 'outline',
    size = 'md', pill, block, clearable, disabled, dark, style,
  } = props;
  const [open, setOpen] = useState(false);
  const c = palette(dark);
  const s = SIZE[size];
  const selected = options.find((o) => o.value === value);

  const radius = pill ? 999 : BLOCK_RADIUS_DEFAULT;
  const trigger: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: block ? 'stretch' : 'flex-start',
    paddingHorizontal: s.padH,
    paddingVertical: s.padV,
    borderRadius: radius,
    borderWidth: variant === 'outline' ? 1 : 0,
    borderColor: c.border,
    backgroundColor: variant === 'solid' || variant === 'soft' ? c.pressed : 'transparent',
    opacity: disabled ? 0.4 : 1,
  };

  function pick(v: string): void {
    onChange(v);
    setOpen(false);
  }

  return (
    <View style={block ? { alignSelf: 'stretch' } : undefined}>
      <Pressable
        accessibilityLabel={name}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={style ? [trigger, style] : trigger}
      >
        <RNText
          numberOfLines={1}
          style={{ flex: block ? 1 : 0, color: selected ? c.head : c.sub, fontSize: s.font, fontFamily: 'Calibre-Medium' }}
        >
          {selected ? selected.label : placeholder}
        </RNText>
        {clearable && selected ? (
          <Pressable hitSlop={8} onPress={() => onChange('')}>
            <RNText style={{ color: c.sub, fontSize: s.font }}>×</RNText>
          </Pressable>
        ) : null}
        <RNText style={{ color: c.sub, fontSize: s.font - 2 }}>▾</RNText>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: c.scrim, justifyContent: 'flex-end' }} onPress={() => setOpen(false)}>
          <Pressable
            style={{ backgroundColor: c.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingVertical: 8, maxHeight: '60%' }}
          >
            <ScrollView>
              {options.map((o) => (
                <Pressable
                  key={o.value}
                  onPress={() => pick(o.value)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 18, paddingVertical: 14,
                    backgroundColor: pressed ? c.pressed : 'transparent',
                  })}
                >
                  <RNText
                    style={{
                      color: o.value === value ? c.head : c.head,
                      fontSize: 16,
                      fontFamily: o.value === value ? 'Calibre-Semibold' : 'Calibre-Medium',
                    }}
                  >
                    {o.label}
                  </RNText>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

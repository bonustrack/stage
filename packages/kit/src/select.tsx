/**
 * @file Select — a hook-free interactive ChatKit-styled dropdown (controlled `value` + `onChange`) implemented as a Pressable trigger opening an RN Modal options sheet, with no native picker dependency.
 */

import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text as RNText,
  View,
  type ViewStyle,
} from 'react-native';
import {
  controlBoxStyle,
  controlColors,
  type ControlSize,
  type ControlVariant,
} from './control.styles';
import { BLOCK_RADIUS_DEFAULT, FONT_SIZE, schemePalette } from './tokens';
import { Icon } from './icon';

/** ChatKit Select option shape. */
export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  /** ChatKit: name. Form field name (required). */
  name?: string;
  /** ChatKit: options. The selectable choices. */
  options?: SelectOption[];
  /** ChatKit: defaultValue. Initial selection (uncontrolled). */
  defaultValue?: string;
  /** Controlled selected value (kit extension; pair with onChange). */
  value?: string;
  /** ChatKit: placeholder. Shown when no value is selected. */
  placeholder?: string;
  /** ChatKit: variant. 'soft' (filled) | 'outline'. Default 'soft'. */
  variant?: ControlVariant;
  /** ChatKit: size. ControlSize scale. Default 'md'. */
  size?: ControlSize;
  /** ChatKit: pill. Fully-rounded corners. */
  pill?: boolean;
  /** ChatKit: block. Stretch to the container width. */
  block?: boolean;
  /** ChatKit: clearable. Show a clear ('x') affordance when a value is set. */
  clearable?: boolean;
  /** ChatKit: disabled. */
  disabled?: boolean;
  /** Corner radius (px). Falls back to the block radius token (or pill). */
  radius?: number;
  /** RN substitute for ChatKit's onChangeAction. */
  onChange?: (value: string) => void;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark?: boolean;
  /** Escape-hatch style merged last onto the trigger box. */
  style?: ViewStyle | ViewStyle[];
}

/** ChatKit-style RN select / dropdown. */
export function Select(props: SelectProps): React.ReactElement {
  const {
    name,
    options = [],
    defaultValue,
    value: controlled,
    placeholder = 'Select...',
    variant = 'soft',
    size = 'md',
    pill,
    block,
    clearable,
    disabled,
    radius,
    onChange,
    dark = false,
    style,
  } = props;

  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const [open, setOpen] = useState(false);
  const selected = controlled ?? internal;

  const colors = controlColors(variant, dark);
  const corner = radius ?? (pill ? 999 : BLOCK_RADIUS_DEFAULT);
  const box = controlBoxStyle(size, variant, colors, corner, false);
  const p = schemePalette(dark);
  const head = p.head;
  // Sheet fill has no semantic token equivalent (kept literal).
  const sheetBg = dark ? '#1b1c1e' : '#ffffff';
  const rowBorder = p.border;

  const current = options.find((o) => o.value === selected);

  /** Pick helper. */
  function pick(v: string): void {
    if (controlled === undefined) setInternal(v);
    onChange?.(v);
    setOpen(false);
  }

  /** Clear helper. */
  function clear(): void {
    if (controlled === undefined) setInternal(undefined);
    onChange?.('');
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={name}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => { setOpen(true); }}
        style={[
          box,
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            alignSelf: block ? 'stretch' : 'flex-start',
            opacity: disabled ? 0.5 : 1,
          },
          ...(style ? (Array.isArray(style) ? style : [style]) : []),
        ]}
      >
        <RNText
          numberOfLines={1}
          style={{
            flex: 1,
            color: current ? head : colors.placeholder,
            fontSize: FONT_SIZE.md,
            fontFamily: 'Calibre-Medium',
          }}
        >
          {current ? current.label : placeholder}
        </RNText>
        {clearable && current ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={clear} hitSlop={8}>
            <Icon name="x" size={16} color={colors.placeholder} />
          </Pressable>
        ) : null}
        <Icon name="selector" size={16} color={colors.placeholder} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => { setOpen(false); }}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}
          onPress={() => { setOpen(false); }}
        >
          <Pressable
            style={{ backgroundColor: sheetBg, borderRadius: 14, overflow: 'hidden', maxHeight: '70%' }}
            onPress={() => {
              /* intentional no-op: swallow press so taps inside the sheet don't dismiss it */
            }}
          >
            <ScrollView>
              {options.map((opt) => {
                const isSel = opt.value === selected;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSel }}
                    onPress={() => { pick(opt.value); }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: 16,
                      paddingVertical: 13,
                      borderBottomWidth: 1,
                      borderBottomColor: rowBorder,
                    }}
                  >
                    <RNText style={{ flex: 1, color: head, fontSize: FONT_SIZE.lg, fontFamily: 'Calibre-Medium' }}>
                      {opt.label}
                    </RNText>
                    {isSel ? <Icon name="check" size={18} color={head} /> : null}
                  </Pressable>
                );
              })}
              {options.length === 0 ? (
                <View style={{ padding: 16 }}>
                  <RNText style={{ color: colors.placeholder, fontFamily: 'Calibre-Medium' }}>No options</RNText>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

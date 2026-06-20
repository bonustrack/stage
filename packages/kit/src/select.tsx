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

/** Normalise the escape-hatch style prop to a flat array. */
function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
}

/** Props for the select trigger box. */
interface SelectTriggerProps {
  name?: string;
  disabled?: boolean;
  block?: boolean;
  clearable?: boolean;
  open: boolean;
  current?: SelectOption;
  placeholder: string;
  box: ViewStyle;
  head: string;
  placeholderColor: string;
  style?: ViewStyle | ViewStyle[];
  onOpen: () => void;
  onClear: () => void;
}

/** Pressable trigger box showing the selected option and affordances. */
function SelectTrigger(props: SelectTriggerProps): React.ReactElement {
  const { name, disabled, block, clearable, open, current, placeholder, box, head, placeholderColor, style, onOpen, onClear } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled, expanded: open }}
      disabled={disabled}
      onPress={onOpen}
      style={[
        box,
        { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: block ? 'stretch' : 'flex-start', opacity: disabled ? 0.5 : 1 },
        ...styleList(style),
      ]}
    >
      <RNText
        numberOfLines={1}
        style={{ flex: 1, color: current ? head : placeholderColor, fontSize: FONT_SIZE.md, fontFamily: 'Calibre-Medium' }}
      >
        {current ? current.label : placeholder}
      </RNText>
      {clearable && current ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={onClear} hitSlop={8}>
          <Icon name="x" size={16} color={placeholderColor} />
        </Pressable>
      ) : null}
      <Icon name="selector" size={16} color={placeholderColor} />
    </Pressable>
  );
}

/** A single option row inside the select sheet. */
function SelectRow(props: {
  opt: SelectOption;
  selected: string | undefined;
  head: string;
  rowBorder: string;
  onPick: (v: string) => void;
}): React.ReactElement {
  const { opt, selected, head, rowBorder, onPick } = props;
  const isSel = opt.value === selected;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityState={{ selected: isSel }}
      onPress={() => { onPick(opt.value); }}
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
}

/** Modal sheet listing the select options. */
function SelectSheet(props: {
  open: boolean;
  options: SelectOption[];
  selected: string | undefined;
  sheetBg: string;
  head: string;
  rowBorder: string;
  placeholderColor: string;
  onPick: (v: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const { open, options, selected, sheetBg, head, rowBorder, placeholderColor, onPick, onClose } = props;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: sheetBg, borderRadius: 14, overflow: 'hidden', maxHeight: '70%' }}
          onPress={() => {
            /* intentional no-op: swallow press so taps inside the sheet don't dismiss it */
          }}
        >
          <ScrollView>
            {options.map((opt) => (
              <SelectRow key={opt.value} opt={opt} selected={selected} head={head} rowBorder={rowBorder} onPick={onPick} />
            ))}
            {options.length === 0 ? (
              <View style={{ padding: 16 }}>
                <RNText style={{ color: placeholderColor, fontFamily: 'Calibre-Medium' }}>No options</RNText>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
  /** Sheet fill has no semantic token equivalent (kept literal). */
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
      <SelectTrigger
        name={name}
        disabled={disabled}
        block={block}
        clearable={clearable}
        open={open}
        current={current}
        placeholder={placeholder}
        box={box}
        head={head}
        placeholderColor={colors.placeholder}
        style={style}
        onOpen={() => { setOpen(true); }}
        onClear={clear}
      />

      <SelectSheet
        open={open}
        options={options}
        selected={selected}
        sheetBg={sheetBg}
        head={head}
        rowBorder={rowBorder}
        placeholderColor={colors.placeholder}
        onPick={pick}
        onClose={() => { setOpen(false); }}
      />
    </>
  );
}

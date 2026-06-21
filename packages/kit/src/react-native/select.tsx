
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
} from '../control.styles';
import { BLOCK_RADIUS_DEFAULT, FONT_SIZE, schemePalette } from '../tokens';
import { Icon } from './icon';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  name?: string;
  options?: SelectOption[];
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  variant?: ControlVariant;
  size?: ControlSize;
  pill?: boolean;
  block?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  radius?: number;
  onChange?: (value: string) => void;
  dark?: boolean;
  style?: ViewStyle | ViewStyle[];
}

function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
}

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
          onPress={() => undefined}
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
  const sheetBg = dark ? '#1b1c1e' : '#ffffff';
  const rowBorder = p.border;

  const current = options.find((o) => o.value === selected);

  function pick(v: string): void {
    if (controlled === undefined) setInternal(v);
    onChange?.(v);
    setOpen(false);
  }

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

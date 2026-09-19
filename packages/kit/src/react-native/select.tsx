
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
import { CONTROL_RADIUS_DEFAULT, FONT_SIZE, fontName, schemePalette } from '../tokens';
import { Icon } from './icon';
import { ControlTrigger } from './control-trigger';

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
      <RNText style={{ flex: 1, color: head, fontSize: FONT_SIZE.lg, fontFamily: fontName.sans }}>
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
                <RNText style={{ color: placeholderColor, fontFamily: fontName.sans }}>No options</RNText>
              </View>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function cornerOf(radius: number | undefined, pill: boolean | undefined): number {
  return radius ?? (pill ? 999 : CONTROL_RADIUS_DEFAULT);
}

function labelOf(current: SelectOption | undefined, placeholder: string): string {
  return current === undefined ? placeholder : current.label;
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
  const box = controlBoxStyle(size, variant, colors, cornerOf(radius, pill));
  const { head, border: rowBorder } = schemePalette(dark);
  const sheetBg = dark ? '#1b1c1e' : '#ffffff';

  const current = options.find((o) => o.value === selected);

  function select(v: string | undefined): void {
    if (controlled === undefined) setInternal(v);
    onChange?.(v ?? '');
    setOpen(false);
  }

  return (
    <>
      <ControlTrigger
        name={name}
        disabled={disabled}
        block={block}
        clearable={clearable}
        open={open}
        hasValue={current !== undefined}
        label={labelOf(current, placeholder)}
        icon="selector"
        box={box}
        headColor={head}
        placeholderColor={colors.placeholder}
        style={style}
        onOpen={() => { setOpen(true); }}
        onClear={() => { select(undefined); }}
      />

      <SelectSheet
        open={open}
        options={options}
        selected={selected}
        sheetBg={sheetBg}
        head={head}
        rowBorder={rowBorder}
        placeholderColor={colors.placeholder}
        onPick={select}
        onClose={() => { setOpen(false); }}
      />
    </>
  );
}

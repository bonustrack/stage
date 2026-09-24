
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text as RNText,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import {
  controlBoxStyle,
  controlColors,
  type ControlSize,
  type ControlVariant,
} from '../control.styles';
import { CONTROL_RADIUS_DEFAULT, FONT_SIZE, fontName, schemePalette } from '../tokens';
import { ControlTrigger } from './control-trigger';
import { DROPDOWN_MENU, DropdownMenu, DropdownMenuItem } from './dropdown-menu';

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

const MENU_GAP = 4;
const EDGE_MARGIN = 8;

interface TriggerRect { x: number; y: number; width: number; height: number }

function SelectMenu(props: {
  anchor: TriggerRect | null;
  options: SelectOption[];
  selected: string | undefined;
  dark: boolean;
  placeholderColor: string;
  onPick: (v: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const { anchor, options, selected, dark, placeholderColor, onPick, onClose } = props;
  const window = useWindowDimensions();
  const top = anchor === null ? 0 : anchor.y + anchor.height + MENU_GAP;
  return (
    <Modal visible={anchor !== null} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        {anchor === null ? null : (
          <Pressable
            onPress={() => undefined}
            style={{ position: 'absolute', top, left: anchor.x, minWidth: anchor.width }}
          >
            <DropdownMenu dark={dark} maxHeight={Math.max(window.height - top - EDGE_MARGIN, 120)} style={{ alignSelf: 'stretch' }}>
              {options.map((opt) => (
                <DropdownMenuItem key={opt.value} dark={dark} label={opt.label} selected={opt.value === selected} onPress={() => { onPick(opt.value); }} />
              ))}
              {options.length === 0 ? (
                <View style={{ paddingHorizontal: DROPDOWN_MENU.itemPadX, paddingVertical: DROPDOWN_MENU.itemPadY }}>
                  <RNText style={{ color: placeholderColor, fontFamily: fontName.sans, fontSize: FONT_SIZE.md }}>No options</RNText>
                </View>
              ) : null}
            </DropdownMenu>
          </Pressable>
        )}
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
  const [anchor, setAnchor] = useState<TriggerRect | null>(null);
  const triggerRef = useRef<View>(null);
  const open = anchor !== null;
  const selected = controlled ?? internal;

  const colors = controlColors(variant, dark);
  const box = controlBoxStyle(size, variant, colors, cornerOf(radius, pill));
  const { head } = schemePalette(dark);

  const current = options.find((o) => o.value === selected);

  function select(v: string | undefined): void {
    if (controlled === undefined) setInternal(v);
    onChange?.(v ?? '');
    setAnchor(null);
  }

  function openMenu(): void {
    triggerRef.current?.measureInWindow((x, y, width, height) => { setAnchor({ x, y, width, height }); });
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
        triggerRef={triggerRef}
        onOpen={openMenu}
        onClear={() => { select(undefined); }}
      />

      <SelectMenu
        anchor={anchor}
        options={options}
        selected={selected}
        dark={dark}
        placeholderColor={colors.placeholder}
        onPick={select}
        onClose={() => { setAnchor(null); }}
      />
    </>
  );
}

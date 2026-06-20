
import { useState } from 'react';
import { Pressable, View, Text as RNText, type ViewStyle } from 'react-native';
import { Icon } from './icon';

export interface CheckboxProps {
  name?: string;
  label?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  disabled?: boolean;
  required?: boolean;
  onChange?: (checked: boolean) => void;
  size?: number;
  dark?: boolean;
  style?: ViewStyle | ViewStyle[];
}

function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
}

function checkboxColors(dark: boolean): { head: string; bg: string; border: string } {
  return {
    head: dark ? '#ffffff' : '#000000',
    bg: dark ? '#0e0f10' : '#ffffff',
    border: dark ? '#282a2d' : '#e4e4e5',
  };
}

function boxStyle(
  size: number,
  checked: boolean,
  colors: { head: string; bg: string; border: string },
): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: 6,
    borderWidth: checked ? 0 : 1,
    borderColor: colors.border,
    backgroundColor: checked ? colors.head : colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

export function Checkbox(props: CheckboxProps): React.ReactElement {
  const {
    name,
    label,
    defaultChecked,
    checked: controlled,
    disabled,
    onChange,
    size = 20,
    dark = false,
    style,
  } = props;

  const [internal, setInternal] = useState(defaultChecked ?? false);
  const checked = controlled ?? internal;

  const { head, bg } = checkboxColors(dark);

  function toggle(): void {
    if (disabled) return;
    const next = !checked;
    if (controlled === undefined) setInternal(next);
    onChange?.(next);
  }

  const box = boxStyle(size, checked, checkboxColors(dark));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label ?? name}
      disabled={disabled}
      onPress={toggle}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: disabled ? 0.5 : 1 },
        ...styleList(style),
      ]}
    >
      <View style={box}>
        {checked ? <Icon name="check" size={size - 4} color={bg} /> : null}
      </View>
      {label ? (
        <RNText style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Medium' }}>{label}</RNText>
      ) : null}
    </Pressable>
  );
}

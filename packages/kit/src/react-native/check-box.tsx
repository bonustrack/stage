import { useState } from 'react';
import { Pressable, Text as RNText, View, type ViewStyle } from 'react-native';
import type { ValidationResult } from '../a2ui/protocol';
import { styleList } from '../control.styles';
import { FONT_SIZE, fontName } from '../tokens';
import { accessibilityProps, type A2uiCommonProps } from './a2ui-props';
import { WithChecks } from './control-trigger';
import { Icon } from './icon';
import { useKitScheme } from './theme-context';
import { loadKitFonts } from './fonts.load';

loadKitFonts();

export type CheckBoxDisplayStyle = 'checkbox' | 'switch';

export interface CheckBoxProps extends A2uiCommonProps {
  label?: string;
  value?: boolean;
  defaultValue?: boolean;
  onChange?: (value: boolean) => void;
  checks?: readonly ValidationResult[];
  displayStyle?: CheckBoxDisplayStyle;
  disabled?: boolean;
  size?: number;
  dark?: boolean;
  name?: string;
  style?: ViewStyle | ViewStyle[];
}

interface CheckColors {
  head: string;
  bg: string;
  border: string;
}

export function checkboxColors(dark: boolean): CheckColors {
  return {
    head: dark ? '#ffffff' : '#000000',
    bg: dark ? '#0e0f10' : '#ffffff',
    border: dark ? '#282a2d' : '#e4e4e5',
  };
}

export function CheckboxBox({ size, checked, colors }: { size: number; checked: boolean; colors: CheckColors }): React.ReactElement {
  const box: ViewStyle = {
    width: size,
    height: size,
    borderRadius: 6,
    borderWidth: checked ? 0 : 1,
    borderColor: colors.border,
    backgroundColor: checked ? colors.head : colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return <View style={box}>{checked ? <Icon name="check" size={size - 4} color={colors.bg} /> : null}</View>;
}

function track(checked: boolean, dark: boolean): ViewStyle {
  return {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: checked ? (dark ? '#ffffff' : '#000000') : (dark ? '#3a3c40' : '#d8d8da'),
    padding: 3,
    justifyContent: 'center',
  };
}

function knob(checked: boolean, dark: boolean): ViewStyle {
  return {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: checked && dark ? '#000000' : '#ffffff',
    alignSelf: checked ? 'flex-end' : 'flex-start',
  };
}

function SwitchTrack({ checked, dark }: { checked: boolean; dark: boolean }): React.ReactElement {
  return (
    <View style={track(checked, dark)}>
      <View style={knob(checked, dark)} />
    </View>
  );
}

function useChecked(value: boolean | undefined, defaultValue: boolean | undefined): [boolean, (next: boolean) => void] {
  const [internal, setInternal] = useState(defaultValue ?? false);
  const checked = value ?? internal;
  return [checked, (next) => {
    if (value === undefined) setInternal(next);
  }];
}

export function CheckBox(props: CheckBoxProps): React.ReactElement {
  const { label, value, defaultValue, onChange, checks, displayStyle = 'checkbox', disabled, size = 20, name, style, weight, accessibility } = props;
  const scheme = useKitScheme();
  const dark = props.dark ?? scheme === 'dark';
  const [checked, setChecked] = useChecked(value, defaultValue);
  const isSwitch = displayStyle === 'switch';
  const colors = checkboxColors(dark);
  const toggle = (): void => {
    if (disabled) return;
    setChecked(!checked);
    onChange?.(!checked);
  };
  return (
    <WithChecks checks={checks} weight={weight}>
      {(rootStyle) => (
        <Pressable
          accessibilityRole={isSwitch ? 'switch' : 'checkbox'}
          accessibilityState={{ checked, disabled }}
          accessibilityLabel={label ?? name}
          {...accessibilityProps(accessibility)}
          disabled={disabled}
          onPress={toggle}
          style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: disabled ? 0.5 : 1 }, ...styleList(style), ...styleList(rootStyle)]}
        >
          {isSwitch ? <SwitchTrack checked={checked} dark={dark} /> : <CheckboxBox size={size} checked={checked} colors={colors} />}
          {label ? <RNText style={{ color: colors.head, fontSize: FONT_SIZE.xs, fontFamily: fontName.sans }}>{label}</RNText> : null}
        </Pressable>
      )}
    </WithChecks>
  );
}

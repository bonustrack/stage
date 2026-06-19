/**
 * @file RadioGroup — a hook-free interactive ChatKit-styled radio group (controlled `value` + `onChange`) rendering each option's dot with RN views.
 */

import { useState } from 'react';
import { Pressable, View, Text as RNText, type ViewStyle } from 'react-native';

/** ChatKit RadioGroup option shape. */
export interface RadioOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** ChatKit: name. Form field name. */
  name?: string;
  /** ChatKit: options. The selectable choices. */
  options?: RadioOption[];
  /** ChatKit: defaultValue. Initial selection (uncontrolled). */
  defaultValue?: string;
  /** Controlled selected value (kit extension; pair with onChange). */
  value?: string;
  /** ChatKit: direction. Layout axis. Default 'col'. */
  direction?: 'row' | 'col';
  /** ChatKit: disabled. Disables every option. */
  disabled?: boolean;
  /** ChatKit: required (parity only). */
  required?: boolean;
  /** ChatKit: ariaLabel. Accessibility label for the group. */
  ariaLabel?: string;
  /** RN substitute for ChatKit's onChangeAction. */
  onChange?: (value: string) => void;
  /** Dot size (px). Default 20. */
  size?: number;
  /** Effective color scheme. */
  dark?: boolean;
  /** Escape-hatch style merged onto the group container. */
  style?: ViewStyle | ViewStyle[];
}

/** Normalise the escape-hatch style prop to a flat array. */
function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
}

/** A single radio option row: dot + label. */
function RadioOptionRow(props: {
  opt: RadioOption;
  selected: string | undefined;
  groupDisabled: boolean;
  size: number;
  head: string;
  border: string;
  onPick: (v: string) => void;
}): React.ReactElement {
  const { opt, selected, groupDisabled, size, head, border, onPick } = props;
  const isSel = opt.value === selected;
  const optDisabled = groupDisabled || (opt.disabled ?? false);
  const outer: ViewStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: 1.5,
    borderColor: isSel ? head : border,
    alignItems: 'center',
    justifyContent: 'center',
  };
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSel, disabled: optDisabled }}
      accessibilityLabel={opt.label}
      disabled={optDisabled}
      onPress={() => { onPick(opt.value); }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: optDisabled ? 0.5 : 1 }}
    >
      <View style={outer}>
        {isSel ? (
          <View style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, backgroundColor: head }} />
        ) : null}
      </View>
      <RNText style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Medium' }}>{opt.label}</RNText>
    </Pressable>
  );
}

/** ChatKit-style RN radio group. */
export function RadioGroup(props: RadioGroupProps): React.ReactElement {
  const {
    name,
    options = [],
    defaultValue,
    value: controlled,
    direction = 'col',
    disabled: groupDisabled,
    ariaLabel,
    onChange,
    size = 20,
    dark = false,
    style,
  } = props;

  const [internal, setInternal] = useState<string | undefined>(defaultValue);
  const selected = controlled ?? internal;

  const head = dark ? '#ffffff' : '#000000';
  const border = dark ? '#282a2d' : '#e4e4e5';

  /** Pick helper. */
  function pick(v: string): void {
    if (controlled === undefined) setInternal(v);
    onChange?.(v);
  }

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={ariaLabel ?? name}
      style={[
        { flexDirection: direction === 'row' ? 'row' : 'column', gap: 12 },
        ...styleList(style),
      ]}
    >
      {options.map((opt) => (
        <RadioOptionRow
          key={opt.value}
          opt={opt}
          selected={selected}
          groupDisabled={groupDisabled ?? false}
          size={size}
          head={head}
          border={border}
          onPick={pick}
        />
      ))}
    </View>
  );
}

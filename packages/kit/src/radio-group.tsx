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

/** ChatKit-style RN radio group. */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor (complexity 12)
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
        ...(style ? (Array.isArray(style) ? style : [style]) : []),
      ]}
    >
      {options.map((opt) => {
        const isSel = opt.value === selected;
        const optDisabled = (groupDisabled ?? false) || (opt.disabled ?? false);
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
            key={opt.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSel, disabled: optDisabled }}
            accessibilityLabel={opt.label}
            disabled={optDisabled}
            onPress={() => { pick(opt.value); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: optDisabled ? 0.5 : 1 }}
          >
            <View style={outer}>
              {isSel ? (
                <View
                  style={{
                    width: size * 0.5,
                    height: size * 0.5,
                    borderRadius: size * 0.25,
                    backgroundColor: head,
                  }}
                />
              ) : null}
            </View>
            <RNText style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Medium' }}>{opt.label}</RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

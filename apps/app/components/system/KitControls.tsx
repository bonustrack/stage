/** Shared Storybook-style control primitives for the Kit page tabs — a labeled
 *  segmented control, a labeled text input, and a labeled toggle switch. Kept
 *  generic + strongly typed (the segmented control is parameterised over the
 *  value union) so each component story can drive its own prop unions
 *  (ButtonVariant, TitleLevel, TextWeight, …) with no `any`. Fonts are
 *  Calibre-Medium / Calibre-Semibold only. */

import { Pressable, Switch, TextInput } from 'react-native';
import { Box, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';

export interface ControlPalette {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}

function FieldLabel({ label, sub }: { label: string; sub: string }): React.ReactElement {
  return (
    <Text style={{ color: sub, fontSize: 13, fontFamily: 'Calibre-Semibold', textTransform: 'uppercase' }}>
      {label}
    </Text>
  );
}

/** Segmented control. `options` are the selectable values of union type T;
 *  `labelOf` renders each as a human string (defaults to String(value)). */
export function Segmented<T extends string | number>({
  label, value, options, onChange, labelOf, p,
}: {
  label: string; value: T; options: ReadonlyArray<T>;
  onChange: (v: T) => void; labelOf?: (v: T) => string; p: ControlPalette;
}): React.ReactElement {
  return (
    <Box mt={14}>
      <FieldLabel label={label} sub={p.sub} />
      <Row gap={8} mt={8} style={{ flexWrap: 'wrap' }}>
        {options.map((opt) => {
          const active = opt === value;
          return (
            <Pressable
              key={String(opt)}
              onPress={() => onChange(opt)}
              style={{
                paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1,
                borderColor: active ? p.head : p.border,
                backgroundColor: active ? p.rowBg : 'transparent',
              }}
            >
              <Text style={{ color: active ? p.head : p.sub, fontSize: 15, fontFamily: 'Calibre-Semibold' }}>
                {labelOf ? labelOf(opt) : String(opt)}
              </Text>
            </Pressable>
          );
        })}
      </Row>
    </Box>
  );
}

export function TextField({ label, value, onChange, p, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  p: ControlPalette; placeholder?: string;
}): React.ReactElement {
  return (
    <Box mt={14}>
      <FieldLabel label={label} sub={p.sub} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={p.sub}
        style={{
          marginTop: 8, borderWidth: 1, borderColor: p.border, borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 10,
          color: p.head, fontSize: 15, fontFamily: 'Calibre-Medium',
          backgroundColor: p.rowBg,
        }}
      />
    </Box>
  );
}

export function ToggleField({ label, value, onChange, p }: {
  label: string; value: boolean; onChange: (v: boolean) => void; p: ControlPalette;
}): React.ReactElement {
  return (
    <Row mt={14} align="center" justify="between">
      <FieldLabel label={label} sub={p.sub} />
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: p.border, true: p.head }}
        thumbColor={p.rowBg}
      />
    </Row>
  );
}

/** A faint label + a bordered preview surface the live example renders into,
 *  pinned above the full variant grid on every tab. */
export function PreviewStage({ p, children }: {
  p: ControlPalette; children: React.ReactNode;
}): React.ReactElement {
  return (
    <Box mt={16} style={{
      borderWidth: 1, borderColor: p.border, borderRadius: 14, padding: 18,
      backgroundColor: p.rowBg, alignItems: 'flex-start', minHeight: 72, justifyContent: 'center',
    }}>
      {children}
    </Box>
  );
}

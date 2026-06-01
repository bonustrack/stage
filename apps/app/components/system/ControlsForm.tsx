/** ControlsForm — ONE generic, data-driven renderer for every Kit tab. Fed a
 *  ControlSpec<S> + the current state value + onChange, it maps each control
 *  descriptor's `kind` to the right widget (enum→Segmented, boolean→ToggleField,
 *  string→TextField, number→NumberField, icon→IconPicker) and patches the value
 *  object on change. NO bespoke per-component form code — every tab uses this,
 *  fed a different spec. Strongly typed over S; no `any`. */

import { type HeroIconName } from '@metro-labs/kit/icon';
import { type Control, type ControlSpec } from './KitSpec';
import {
  Segmented, TextField, NumberField, ToggleField, type ControlPalette,
} from './KitControls';
import { IconPicker } from './KitIconPicker';

/** Render a single descriptor → its widget, wired to patch `value[key]`. */
function ControlRow<S>({ control, value, patch, p }: {
  control: Control<S, keyof S>;
  value: S;
  patch: (key: keyof S, v: S[keyof S]) => void;
  p: ControlPalette;
}): React.ReactElement {
  const { key, label } = control;
  const set = (v: S[keyof S]): void => patch(key, v);

  switch (control.kind) {
    case 'enum':
      return (
        <Segmented
          label={label}
          value={value[key] as string | number}
          options={control.options as ReadonlyArray<string | number>}
          onChange={(v) => set(v as S[keyof S])}
          labelOf={control.labelOf as ((v: string | number) => string) | undefined}
          p={p}
        />
      );
    case 'boolean':
      return (
        <ToggleField
          label={label}
          value={value[key] as boolean}
          onChange={(v) => set(v as S[keyof S])}
          p={p}
        />
      );
    case 'string':
      return (
        <TextField
          label={label}
          value={value[key] as string}
          onChange={(v) => set(v as S[keyof S])}
          placeholder={control.placeholder}
          p={p}
        />
      );
    case 'number':
      return (
        <NumberField
          label={label}
          value={value[key] as number}
          onChange={(v) => set(v as S[keyof S])}
          min={control.min}
          p={p}
        />
      );
    case 'icon':
      return (
        <IconPicker
          label={label}
          value={value[key] as HeroIconName}
          onChange={(v) => set(v as S[keyof S])}
          p={p}
        />
      );
  }
}

export function ControlsForm<S>({ spec, value, onChange, p }: {
  spec: ControlSpec<S>;
  value: S;
  onChange: (next: S) => void;
  p: ControlPalette;
}): React.ReactElement {
  const patch = (key: keyof S, v: S[keyof S]): void =>
    onChange({ ...value, [key]: v });

  return (
    <>
      {spec.map((control) => (
        <ControlRow
          key={String(control.key)}
          control={control}
          value={value}
          patch={patch}
          p={p}
        />
      ))}
    </>
  );
}

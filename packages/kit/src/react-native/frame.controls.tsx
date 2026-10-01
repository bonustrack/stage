import type { FrameNodeOf } from '../frame';
import type { ControlSize, ControlVariant } from '../control.styles';
import { Checkbox } from './checkbox';
import { DatePicker } from './date-picker';
import { Input } from './input';
import { RadioGroup } from './radio-group';
import { Select } from './select';
import { Textarea } from './textarea';
import { useFormField, useFrameRuntime } from './frame.runtime';

type FrameControlSize = '3xs' | '2xs' | 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export function controlSize(size: FrameControlSize | undefined): ControlSize | undefined {
  if (size === '3xs' || size === '2xs') return 'xs';
  if (size === '2xl' || size === '3xl') return 'xl';
  return size;
}

function fieldVariant(variant: 'solid' | 'soft' | 'outline' | 'ghost' | undefined): ControlVariant | undefined {
  return variant === 'outline' ? 'outline' : variant === undefined ? undefined : 'soft';
}

function useLocked(disabled: boolean | undefined): { dark: boolean; locked: boolean } {
  const { dark, enabled } = useFrameRuntime();
  return { dark, locked: disabled === true || !enabled };
}

export function FrameTextField({ name, value, placeholder, required }: {
  name: string; value: string | undefined; placeholder?: string; required?: boolean;
}): React.ReactElement {
  const { dark, locked } = useLocked(undefined);
  const scope = useFormField(name, value ?? '', required);
  return (
    <Input name={name} defaultValue={value} placeholder={placeholder} disabled={locked} dark={dark}
      onChangeText={(t) => { scope?.set(name, t); }} />
  );
}

export function FrameInput({ node }: { node: FrameNodeOf<'Input'> }): React.ReactElement {
  const { name, defaultValue, placeholder, required, disabled, size, inputType, variant, pill } = node.props;
  const { dark, locked } = useLocked(disabled);
  const scope = useFormField(name ?? '', defaultValue ?? '', required);
  return (
    <Input name={name} defaultValue={defaultValue} placeholder={placeholder} inputType={inputType}
      variant={variant} size={controlSize(size)} pill={pill} disabled={locked} dark={dark}
      onChangeText={(t) => { scope?.set(name ?? '', t); }} />
  );
}

export function FrameTextarea({ node }: { node: FrameNodeOf<'Textarea'> }): React.ReactElement {
  const { name, defaultValue, placeholder, required, disabled, size, variant, rows, autoResize, maxRows } = node.props;
  const { dark, locked } = useLocked(disabled);
  const scope = useFormField(name ?? '', defaultValue ?? '', required);
  return (
    <Textarea name={name} defaultValue={defaultValue} placeholder={placeholder} variant={variant}
      size={controlSize(size)} rows={rows} autoResize={autoResize} maxRows={maxRows} disabled={locked} dark={dark}
      onChangeText={(t) => { scope?.set(name ?? '', t); }} />
  );
}

export function FrameSelect({ node }: { node: FrameNodeOf<'Select'> }): React.ReactElement {
  const { name = '', options = [], defaultValue, placeholder, required, disabled, size, variant, pill, block, clearable, onChangeAction } = node.props;
  const { dark, locked } = useLocked(disabled);
  const scope = useFormField(name, defaultValue, required);
  return (
    <Select name={name} options={options.map((o) => ({ label: o.label, value: o.value }))}
      defaultValue={defaultValue} placeholder={placeholder} variant={fieldVariant(variant)} size={controlSize(size)}
      pill={pill} block={block} clearable={clearable} disabled={locked} dark={dark}
      onChange={(v) => { void scope?.change(name, v, onChangeAction); }} />
  );
}

export function FrameDatePicker({ node }: { node: FrameNodeOf<'DatePicker'> }): React.ReactElement {
  const { name = '', defaultValue, placeholder, required, disabled, size, variant, pill, block, clearable, min, max, onChangeAction } = node.props;
  const { dark, locked } = useLocked(disabled);
  const scope = useFormField(name, defaultValue, required);
  return (
    <DatePicker name={name} defaultValue={defaultValue} placeholder={placeholder} variant={fieldVariant(variant)}
      size={controlSize(size)} pill={pill} block={block} clearable={clearable} min={min} max={max}
      disabled={locked} dark={dark} onChange={(v) => { void scope?.change(name, v, onChangeAction); }} />
  );
}

export function FrameCheckbox({ node }: { node: FrameNodeOf<'Checkbox'> }): React.ReactElement {
  const { name = '', label, defaultChecked, required, disabled, onChangeAction } = node.props;
  const { dark, locked } = useLocked(disabled);
  const scope = useFormField(name, defaultChecked === true, required);
  return (
    <Checkbox name={name} label={label} defaultChecked={defaultChecked} disabled={locked} dark={dark}
      onChange={(v) => { void scope?.change(name, v, onChangeAction); }} />
  );
}

export function FrameRadioGroup({ node }: { node: FrameNodeOf<'RadioGroup'> }): React.ReactElement {
  const { name = '', options, defaultValue, direction, required, disabled, onChangeAction } = node.props;
  const { dark, locked } = useLocked(disabled);
  const scope = useFormField(name, defaultValue, required);
  return (
    <RadioGroup name={name} options={options} defaultValue={defaultValue} direction={direction}
      disabled={locked} dark={dark} onChange={(v) => { void scope?.change(name, v, onChangeAction); }} />
  );
}

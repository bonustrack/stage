import type { ReactNode } from 'react';
import { CheckBox } from './check-box';
import { ChoicePicker, type ChoiceOption } from './choice-picker';
import { DateTimeInput } from './date-time-input';
import { Slider } from './slider';
import { TextField } from './text-field';
import {
  asBoolean, asEnum, asNumber, asOptionalString, asString, asStringList,
  commonProps, type A2uiRenderers, type RenderContext,
} from './a2ui-context';

function visibleChecks(ctx: RenderContext): RenderContext['checks'] | undefined {
  return ctx.touched ? ctx.checks : undefined;
}

function optionsOf(value: unknown): ChoiceOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option: unknown) => {
    if (typeof option !== 'object' || option === null) return [];
    const entry = option as Record<string, unknown>;
    return [{ label: asString(entry.label), value: asString(entry.value) }];
  });
}

function textFieldRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const binding = ctx.binding<string>('value');
  return (
    <TextField
      disabled={ctx.disabled}
      {...commonProps(ctx)}
      dark={ctx.dark}
      label={asOptionalString(p.label)}
      value={asString(binding.value)}
      placeholder={asOptionalString(p.placeholder)}
      variant={asEnum(p.variant, ['shortText', 'longText', 'number', 'obscured'])}
      appearance={asEnum(p.appearance, ['soft', 'outline', 'plain'])}
      hint={asOptionalString(p.hint)}
      checks={visibleChecks(ctx)}
      onChangeText={binding.set}
    />
  );
}

function checkBoxRenderer(ctx: RenderContext): ReactNode {
  const binding = ctx.binding<boolean>('value');
  return (
    <CheckBox
      disabled={ctx.disabled}
      {...commonProps(ctx)}
      dark={ctx.dark}
      label={asOptionalString(ctx.props.label)}
      value={asBoolean(binding.value) ?? false}
      displayStyle={asEnum(ctx.props.displayStyle, ['checkbox', 'switch'])}
      checks={visibleChecks(ctx)}
      onChange={binding.set}
    />
  );
}

function choicePickerRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const binding = ctx.binding<string[]>('value');
  return (
    <ChoicePicker
      disabled={ctx.disabled}
      {...commonProps(ctx)}
      dark={ctx.dark}
      label={asOptionalString(p.label)}
      options={optionsOf(p.options)}
      value={asStringList(binding.value)}
      variant={asEnum(p.variant, ['mutuallyExclusive', 'multipleSelection'])}
      displayStyle={asEnum(p.displayStyle, ['checkbox', 'chips'])}
      filterable={asBoolean(p.filterable)}
      checks={visibleChecks(ctx)}
      onChange={binding.set}
    />
  );
}

function sliderRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const binding = ctx.binding<number>('value');
  const min = asNumber(p.min) ?? 0;
  return (
    <Slider
      disabled={ctx.disabled}
      {...commonProps(ctx)}
      dark={ctx.dark}
      label={asOptionalString(p.label)}
      min={min}
      max={asNumber(p.max) ?? min + 100}
      steps={asNumber(p.steps)}
      value={asNumber(binding.value) ?? min}
      checks={visibleChecks(ctx)}
      onChange={binding.set}
    />
  );
}

function dateTimeRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const binding = ctx.binding<string>('value');
  return (
    <DateTimeInput
      disabled={ctx.disabled}
      {...commonProps(ctx)}
      dark={ctx.dark}
      label={asOptionalString(p.label)}
      value={asString(binding.value)}
      enableDate={asBoolean(p.enableDate)}
      enableTime={asBoolean(p.enableTime)}
      min={asOptionalString(p.min)}
      max={asOptionalString(p.max)}
      placeholder={asOptionalString(p.placeholder)}
      block
      checks={visibleChecks(ctx)}
      onChange={binding.set}
    />
  );
}

export const INPUT_RENDERERS: A2uiRenderers = {
  TextField: textFieldRenderer,
  CheckBox: checkBoxRenderer,
  ChoicePicker: choicePickerRenderer,
  Slider: sliderRenderer,
  DateTimeInput: dateTimeRenderer,
};

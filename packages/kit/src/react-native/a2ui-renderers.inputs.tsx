import type { ReactNode } from 'react';
import { isEventAction } from '../a2ui/protocol';
import { failingChecks } from './a2ui-props';
import { useModalClose } from './modal';
import { CheckBox } from './check-box';
import { ChoicePicker, type ChoiceOption } from './choice-picker';
import { DateTimeInput } from './date-time-input';
import { Slider } from './slider';
import { TextField } from './text-field';
import {
  asBoolean,
  asEnum,
  asNumber,
  asOptionalString,
  asString,
  asStringList,
  commonProps,
  type A2uiRenderers,
  type RenderContext,
} from './a2ui-context';

function fieldProps(ctx: RenderContext) {
  return {
    disabled: ctx.disabled,
    ...commonProps(ctx),
    label: asOptionalString(ctx.props.label),
    checks: ctx.touched ? ctx.checks : undefined,
  };
}

function optionsOf(value: unknown): ChoiceOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((option: unknown) => {
    if (typeof option !== 'object' || option === null) return [];
    const entry = option as Record<string, unknown>;
    return [{ label: asString(entry.label), value: asString(entry.value) }];
  });
}

export function useA2uiAction(ctx: RenderContext): (action?: unknown) => void {
  const closeModal = useModalClose();
  return (action = ctx.instance.action) => {
    const result = ctx.dispatch(action);
    if (result?.ok === true && isEventAction(action)) closeModal?.();
  };
}

function A2uiTextField({ ctx }: { ctx: RenderContext }): React.ReactElement {
  const p = ctx.props;
  const act = useA2uiAction(ctx);
  const binding = ctx.binding<string>('value');
  const field = fieldProps(ctx);
  const hidden =
    asBoolean(p.hideLabel) === true
      ? { label: undefined, accessibility: { ...field.accessibility, label: field.accessibility?.label ?? field.label } }
      : {};
  return (
    <TextField
      {...field}
      {...hidden}
      value={asString(binding.value)}
      placeholder={asOptionalString(p.placeholder)}
      variant={asEnum(p.variant, ['shortText', 'longText', 'number', 'obscured'])}
      appearance={asEnum(p.appearance, ['soft', 'outline', 'plain'])}
      pill={asBoolean(p.pill)}
      hint={asOptionalString(p.hint)}
      onChangeText={binding.set}
      onSubmit={() => {
        if (!failingChecks(ctx.checks)) act();
      }}
    />
  );
}

const textFieldRenderer = (ctx: RenderContext): ReactNode => <A2uiTextField ctx={ctx} />;

function A2uiCheckBox({ ctx }: { ctx: RenderContext }): React.ReactElement {
  const binding = ctx.binding<boolean>('value');
  const act = useA2uiAction(ctx);
  return (
    <CheckBox
      {...fieldProps(ctx)}
      value={asBoolean(binding.value) ?? false}
      displayStyle={asEnum(ctx.props.displayStyle, ['checkbox', 'switch'])}
      onChange={(next) => {
        binding.set(next);
        if (ctx.instance.action !== undefined) act();
      }}
    />
  );
}

const checkBoxRenderer = (ctx: RenderContext): ReactNode => <A2uiCheckBox ctx={ctx} />;

function choicePickerRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const binding = ctx.binding<string[]>('value');
  return (
    <ChoicePicker
      {...fieldProps(ctx)}
      options={optionsOf(p.options)}
      value={asStringList(binding.value)}
      variant={asEnum(p.variant, ['mutuallyExclusive', 'multipleSelection'])}
      displayStyle={asEnum(p.displayStyle, ['checkbox', 'chips'])}
      filterable={asBoolean(p.filterable)}
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
      {...fieldProps(ctx)}
      min={min}
      max={asNumber(p.max) ?? min + 100}
      steps={asNumber(p.steps)}
      value={asNumber(binding.value) ?? min}
      onChange={binding.set}
    />
  );
}

function dateTimeRenderer(ctx: RenderContext): ReactNode {
  const p = ctx.props;
  const binding = ctx.binding<string>('value');
  return (
    <DateTimeInput
      {...fieldProps(ctx)}
      value={asString(binding.value)}
      enableDate={asBoolean(p.enableDate)}
      enableTime={asBoolean(p.enableTime)}
      min={asOptionalString(p.min)}
      max={asOptionalString(p.max)}
      placeholder={asOptionalString(p.placeholder)}
      block
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

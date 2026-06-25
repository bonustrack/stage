
import type { ReactNode } from 'react';
import type {
  ButtonNode,
  CheckboxNode,
  DatePickerNode,
  InputNode,
  RadioGroupNode,
  SelectNode,
  TextareaNode,
} from '../kit';
import {
  resolveButtonStyle,
  resolveButtonVariant,
  resolveControlSize,
  resolveDirection,
  resolveFieldVariant,
} from '../kit';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { DatePicker } from './date-picker';
import { Icon } from './icon';
import { Input } from './input';
import { RadioGroup } from './radio-group';
import { Select } from './select';
import { Textarea } from './textarea';
import type { ControlVariant as KitControlVariant } from '../kit';
import type { ControlVariant as FieldControlVariant } from '../control.styles';
import {
  dispatch,
  resolveIconName,
  submitForm,
  type RenderCtx,
} from './kit-render-shared';

function fieldVariant(value: KitControlVariant | undefined): FieldControlVariant {
  return value === 'outline' || value === 'solid' ? 'outline' : 'soft';
}

function iconNode(name: string | undefined, ctx: RenderCtx): ReactNode {
  const resolved = resolveIconName(name);
  if (resolved === undefined) return undefined;
  return <Icon name={resolved} size={18} dark={ctx.dark} />;
}

export function renderButton(node: ButtonNode, ctx: RenderCtx): ReactNode {
  const onPress = (): void => {
    if (node.submit === true && ctx.form !== undefined) {
      submitForm(node.onClickAction, ctx);
      return;
    }
    dispatch(node.onClickAction, ctx);
  };
  const styled = resolveButtonStyle(node.color, node.background, ctx.scheme);
  return (
    <Button
      label={node.label}
      color={styled.color}
      tintBg={styled.tintBg}
      tintFg={styled.tintFg}
      variant={resolveButtonVariant(node.variant)}
      size={resolveControlSize(node.size)}
      pill={node.pill}
      uniform={node.uniform}
      block={node.block}
      disabled={node.disabled}
      dark={ctx.dark}
      iconStart={iconNode(node.iconStart, ctx)}
      iconEnd={iconNode(node.iconEnd, ctx)}
      onPress={onPress}
    />
  );
}

export function renderInput(node: InputNode, ctx: RenderCtx): ReactNode {
  ctx.form?.set(node.name, node.defaultValue ?? '');
  return (
    <Input
      name={node.name}
      defaultValue={node.defaultValue}
      placeholder={node.placeholder}
      inputType={node.inputType}
      variant={resolveFieldVariant(node.variant)}
      size={resolveControlSize(node.size)}
      pill={node.pill}
      disabled={node.disabled}
      autoFocus={node.autoFocus}
      autoSelect={node.autoSelect}
      required={node.required}
      pattern={node.pattern}
      dark={ctx.dark}
      onChangeText={(text) => ctx.form?.set(node.name, text)}
    />
  );
}

export function renderTextarea(node: TextareaNode, ctx: RenderCtx): ReactNode {
  ctx.form?.set(node.name, node.defaultValue ?? '');
  return (
    <Textarea
      name={node.name}
      defaultValue={node.defaultValue}
      placeholder={node.placeholder}
      variant={resolveFieldVariant(node.variant)}
      size={resolveControlSize(node.size)}
      disabled={node.disabled}
      rows={node.rows}
      maxRows={node.maxRows}
      autoResize={node.autoResize}
      autoFocus={node.autoFocus}
      autoSelect={node.autoSelect}
      required={node.required}
      pattern={node.pattern}
      dark={ctx.dark}
      onChangeText={(text) => ctx.form?.set(node.name, text)}
    />
  );
}

export function renderSelect(node: SelectNode, ctx: RenderCtx): ReactNode {
  if (node.defaultValue !== undefined) ctx.form?.set(node.name, node.defaultValue);
  return (
    <Select
      name={node.name}
      options={node.options}
      defaultValue={node.defaultValue}
      placeholder={node.placeholder}
      variant={fieldVariant(node.variant)}
      size={resolveControlSize(node.size)}
      pill={node.pill}
      block={node.block}
      clearable={node.clearable}
      disabled={node.disabled}
      dark={ctx.dark}
      onChange={(value) => {
        ctx.form?.set(node.name, value);
        dispatch(node.onChangeAction, ctx, { [node.name]: value });
      }}
    />
  );
}

export function renderCheckbox(node: CheckboxNode, ctx: RenderCtx): ReactNode {
  ctx.form?.set(node.name, node.defaultChecked ?? false);
  return (
    <Checkbox
      name={node.name}
      label={node.label}
      defaultChecked={node.defaultChecked}
      disabled={node.disabled}
      required={node.required}
      dark={ctx.dark}
      onChange={(checked) => {
        ctx.form?.set(node.name, checked);
        dispatch(node.onChangeAction, ctx, { [node.name]: checked });
      }}
    />
  );
}

export function renderRadioGroup(node: RadioGroupNode, ctx: RenderCtx): ReactNode {
  if (node.defaultValue !== undefined) ctx.form?.set(node.name, node.defaultValue);
  return (
    <RadioGroup
      name={node.name}
      options={node.options}
      defaultValue={node.defaultValue}
      direction={resolveDirection(node.direction) === 'row' ? 'row' : 'col'}
      disabled={node.disabled}
      required={node.required}
      ariaLabel={node.ariaLabel}
      dark={ctx.dark}
      onChange={(value) => {
        ctx.form?.set(node.name, value);
        dispatch(node.onChangeAction, ctx, { [node.name]: value });
      }}
    />
  );
}

export function renderDatePicker(node: DatePickerNode, ctx: RenderCtx): ReactNode {
  if (node.defaultValue !== undefined) ctx.form?.set(node.name, node.defaultValue);
  return (
    <DatePicker
      name={node.name}
      defaultValue={node.defaultValue}
      placeholder={node.placeholder}
      min={node.min}
      max={node.max}
      variant={fieldVariant(node.variant)}
      size={resolveControlSize(node.size)}
      pill={node.pill}
      block={node.block}
      clearable={node.clearable}
      disabled={node.disabled}
      dark={ctx.dark}
      onChange={(value) => {
        ctx.form?.set(node.name, value);
        dispatch(node.onChangeAction, ctx, { [node.name]: value });
      }}
    />
  );
}

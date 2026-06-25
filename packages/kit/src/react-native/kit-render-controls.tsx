
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
import type { DimensionValue, TextStyle, ViewStyle } from 'react-native';
import {
  resolveButtonStyle,
  resolveButtonVariant,
  resolveControlSize,
  resolveDirection,
  resolveFieldVariant,
  resolveOptionalColor,
  resolveRadius,
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

function iconNode(
  name: string | undefined,
  ctx: RenderCtx,
  color?: string,
  size = 18,
): ReactNode {
  const resolved = resolveIconName(name);
  if (resolved === undefined) return undefined;
  return <Icon name={resolved} size={size} color={color} dark={ctx.dark} />;
}

function buttonOverrideStyle(node: ButtonNode): ViewStyle | undefined {
  if (node.paddingX === undefined && node.paddingY === undefined) return undefined;
  const out: ViewStyle = {};
  if (node.paddingX !== undefined) out.paddingHorizontal = node.paddingX as DimensionValue;
  if (node.paddingY !== undefined) out.paddingVertical = node.paddingY as DimensionValue;
  return out;
}

function buttonOverrideTextStyle(node: ButtonNode): TextStyle | undefined {
  if (node.fontFamily === undefined && node.fontSize === undefined) return undefined;
  const out: TextStyle = {};
  if (node.fontFamily !== undefined) out.fontFamily = node.fontFamily;
  if (node.fontSize !== undefined) out.fontSize = node.fontSize;
  return out;
}

export function renderButton(node: ButtonNode, ctx: RenderCtx): ReactNode {
  const onPress = (): void => {
    if (node.submit === true && ctx.form !== undefined) {
      submitForm(node.onClickAction, ctx);
      return;
    }
    dispatch(node.onClickAction, ctx);
  };
  const styled = resolveButtonStyle(node.color, node.background, ctx.scheme, {
    pressedBackground: node.pressedBackground,
    foreground: node.foreground,
  });
  const radius = resolveRadius(node.radius);
  const iconColor =
    node.foreground === undefined
      ? undefined
      : resolveOptionalColor(node.foreground, ctx.scheme);
  const overrideStyle = buttonOverrideStyle(node);
  const overrideTextStyle = buttonOverrideTextStyle(node);
  return (
    <Button
      label={node.label}
      color={styled.color}
      tintBg={styled.tintBg}
      tintFg={styled.tintFg}
      tintPressedBg={styled.tintPressedBg}
      radius={typeof radius === 'number' ? radius : undefined}
      variant={resolveButtonVariant(node.variant)}
      size={resolveControlSize(node.size)}
      pill={node.pill}
      uniform={node.uniform}
      block={node.block}
      disabled={node.disabled}
      dark={ctx.dark}
      style={overrideStyle}
      textStyle={overrideTextStyle}
      iconStart={iconNode(node.iconStart, ctx, iconColor, node.iconPx)}
      iconEnd={iconNode(node.iconEnd, ctx, iconColor, node.iconPx)}
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


import type {
  ActionConfig,
  Color,
  ControlSize,
  ControlVariant,
  Dimension,
  FieldVariant,
  FlexDirection,
  FontWeight,
  GutterSize,
  InputType,
  NodeBase,
  PopoverSide,
  RadioOption,
  RadiusValue,
  ReturnKeyType,
  SelectOption,
  TabsVariant,
  TextAlign,
  TextFieldVariant,
} from './node-fields';

export interface SwitchNode extends NodeBase {
  type: 'Switch';
  name: string;
  checked: boolean;
  onChangeAction?: ActionConfig;
  disabled?: boolean;
  label?: string;
}

export interface TabsOption {
  value: string;
  label: string;
  icon?: string;
}

export interface TabsNode extends NodeBase {
  type: 'Tabs';
  name: string;
  value: string;
  options: TabsOption[];
  onChangeAction?: ActionConfig;
  variant?: TabsVariant;
}

export interface SelectionRange {
  start: number;
  end: number;
}

export interface TextFieldNode extends NodeBase {
  type: 'TextField';
  name: string;
  value: string;
  onChangeAction: ActionConfig;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  autoGrow?: boolean;
  disabled?: boolean;
  onSelectionChangeAction?: ActionConfig;
  selection?: SelectionRange;
  focusNonce?: number;
  blurNonce?: number;
  variant?: TextFieldVariant;
  background?: Color;
  borderColor?: Color;
  radius?: RadiusValue;
  paddingX?: Dimension;
  paddingY?: Dimension;
  paddingTop?: Dimension;
  paddingBottom?: Dimension;
  lineHeight?: number;
  fontSize?: number;
  fontWeight?: FontWeight;
  color?: Color;
  placeholderColor?: Color;
  maxLength?: number;
  maxHeight?: Dimension;
  minHeight?: Dimension;
  returnKeyType?: ReturnKeyType;
  onSubmitAction?: ActionConfig;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
}

export interface ColorPickerNode extends NodeBase {
  type: 'ColorPicker';
  name: string;
  value: string;
  mode?: 'swatches' | 'hsv';
  onChangeAction?: ActionConfig;
  swatches?: string[];
  headColor?: Color;
  subColor?: Color;
  borderColor?: Color;
  rowBg?: Color;
}

export interface InputNode extends NodeBase {
  type: 'Input';
  name: string;
  inputType?: InputType;
  defaultValue?: string;
  placeholder?: string;
  pattern?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  autoSelect?: boolean;
  allowAutofillExtensions?: boolean;
  variant?: FieldVariant;
  size?: ControlSize;
  gutterSize?: GutterSize;
  pill?: boolean;
}

export interface TextareaNode extends NodeBase {
  type: 'Textarea';
  name: string;
  defaultValue?: string;
  placeholder?: string;
  pattern?: string;
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  autoSelect?: boolean;
  variant?: FieldVariant;
  size?: ControlSize;
  gutterSize?: GutterSize;
  rows?: number;
  autoResize?: boolean;
  maxRows?: number;
  allowAutofillExtensions?: boolean;
}

export interface SelectNode extends NodeBase {
  type: 'Select';
  name: string;
  options: SelectOption[];
  onChangeAction?: ActionConfig;
  placeholder?: string;
  defaultValue?: string;
  variant?: ControlVariant;
  size?: ControlSize;
  pill?: boolean;
  block?: boolean;
  clearable?: boolean;
  disabled?: boolean;
  searchable?: boolean;
}

export interface CheckboxNode extends NodeBase {
  type: 'Checkbox';
  name: string;
  label?: string;
  defaultChecked?: boolean;
  onChangeAction?: ActionConfig;
  disabled?: boolean;
  required?: boolean;
}

export interface RadioGroupNode extends NodeBase {
  type: 'RadioGroup';
  name: string;
  options?: RadioOption[];
  ariaLabel?: string;
  onChangeAction?: ActionConfig;
  defaultValue?: string;
  direction?: FlexDirection;
  disabled?: boolean;
  required?: boolean;
}

export interface DatePickerNode extends NodeBase {
  type: 'DatePicker';
  name: string;
  onChangeAction?: ActionConfig;
  placeholder?: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  variant?: ControlVariant;
  size?: ControlSize;
  side?: PopoverSide;
  align?: TextAlign;
  pill?: boolean;
  block?: boolean;
  clearable?: boolean;
  disabled?: boolean;
}

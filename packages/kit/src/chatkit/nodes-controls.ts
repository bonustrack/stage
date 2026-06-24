
import type {
  ActionConfig,
  ControlSize,
  ControlVariant,
  FieldVariant,
  FlexDirection,
  GutterSize,
  InputType,
  PopoverSide,
  RadioOption,
  SelectOption,
  TextAlign,
} from './node-fields';
import type { NodeBase } from './nodes';

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

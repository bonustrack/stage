import {
  action, bool, border, cardAction, color, editable, fieldName, httpsUrl, int, label, length, oneOf, options,
  padding, px, ratio, space, status, text, type Validator,
} from './frame.values';

const CHATKIT_ICONS = [
  'agent', 'analytics', 'atom', 'batch', 'bolt', 'book-open', 'book-closed', 'book-clock', 'bug',
  'calendar', 'chart', 'check', 'check-circle', 'check-circle-filled', 'chevron-left', 'chevron-right',
  'circle-question', 'compass', 'confetti', 'cube', 'desktop', 'document', 'dot', 'dots-horizontal',
  'dots-vertical', 'empty-circle', 'external-link', 'globe', 'keys', 'lab', 'images', 'info',
  'lifesaver', 'lightbulb', 'mail', 'map-pin', 'maps', 'mobile', 'name', 'notebook',
  'notebook-pencil', 'page-blank', 'phone', 'play', 'plus', 'profile', 'profile-card', 'reload',
  'star', 'star-filled', 'search', 'sparkle', 'sparkle-double', 'square-code', 'square-image',
  'square-text', 'suitcase', 'settings-slider', 'user', 'wreath', 'write', 'write-alt', 'write-alt2',
] as const;

const STAGE_ICONS = [
  'arrow-up', 'chevron-down', 'chevron-up', 'copy', 'mic', 'send', 'share', 'thumbs-down', 'thumbs-up',
] as const;

export const FRAME_ICONS = [...CHATKIT_ICONS, ...STAGE_ICONS] as const;

export type FrameIconName = (typeof FRAME_ICONS)[number];

const ALIGN = oneOf(['start', 'center', 'end', 'baseline', 'stretch']);
const JUSTIFY = oneOf(['start', 'center', 'end', 'between', 'around', 'evenly']);
const DIRECTION = oneOf(['row', 'col']);
const WEIGHT = oneOf(['normal', 'medium', 'semibold', 'bold']);
const TEXT_ALIGN = oneOf(['start', 'center', 'end']);
const TEXT_SIZE = oneOf(['xs', 'sm', 'md', 'lg', 'xl']);
const RADIUS = oneOf(['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full', '100%', 'none']);
const CONTROL_SIZE = oneOf(['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']);
const CONTROL_VARIANT = oneOf(['solid', 'soft', 'outline', 'ghost']);
const FIELD_VARIANT = oneOf(['soft', 'outline']);
const THEME = oneOf(['light', 'dark']);
const ICON = oneOf(FRAME_ICONS);
const FLEX: Validator<number> = (raw) => (typeof raw === 'number' && raw >= 0 && raw <= 100 ? raw : undefined);

const BLOCK = {
  height: length, width: length, size: length, minHeight: length, minWidth: length, minSize: length,
  maxHeight: length, maxWidth: length, maxSize: length, aspectRatio: ratio, radius: RADIUS, margin: padding,
};

const BOX = {
  ...BLOCK, align: ALIGN, justify: JUSTIFY, wrap: oneOf(['nowrap', 'wrap', 'wrap-reverse']),
  flex: FLEX, gap: space, padding, border, background: color,
};

const TEXT_BASE = {
  value: text, color, weight: WEIGHT, textAlign: TEXT_ALIGN, truncate: bool, maxLines: int(1, 100),
};

const FIELD = { name: fieldName, placeholder: label, required: bool, disabled: bool, size: CONTROL_SIZE };

interface NodeSchema {
  props: Record<string, Validator<unknown>>;
  children?: 'nodes' | 'single';
  required?: readonly string[];
}

export const FRAME_NODE_SCHEMAS = {
  Card: {
    props: {
      size: oneOf(['sm', 'md', 'lg', 'full']), padding, background: color, status, collapsed: bool,
      asForm: bool, confirm: cardAction, cancel: cardAction, theme: THEME,
    },
    children: 'nodes',
  },
  ListView: { props: { limit: int(1, 500), status, theme: THEME }, children: 'nodes' },
  ListViewItem: { props: { onClickAction: action, gap: space, align: ALIGN }, children: 'nodes' },
  Basic: {
    props: { direction: DIRECTION, gap: space, padding, align: ALIGN, justify: JUSTIFY, background: color, theme: THEME },
    children: 'nodes',
  },
  Box: { props: { ...BOX, direction: DIRECTION }, children: 'nodes' },
  Row: { props: BOX, children: 'nodes' },
  Col: { props: BOX, children: 'nodes' },
  Form: { props: { ...BOX, direction: DIRECTION, onSubmitAction: action }, children: 'nodes' },
  Text: {
    props: { ...TEXT_BASE, size: TEXT_SIZE, italic: bool, lineThrough: bool, width: length, editable },
    required: ['value'],
  },
  Title: { props: { ...TEXT_BASE, size: oneOf(['sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl']) }, required: ['value'] },
  Caption: { props: { ...TEXT_BASE, size: oneOf(['sm', 'md', 'lg']) }, required: ['value'] },
  Label: {
    props: { value: label, fieldName, size: TEXT_SIZE, weight: WEIGHT, textAlign: TEXT_ALIGN, color },
    required: ['value'],
  },
  Markdown: { props: { value: text }, required: ['value'] },
  Badge: {
    props: {
      label, color: oneOf(['secondary', 'success', 'danger', 'warning', 'info', 'discovery']),
      variant: oneOf(['solid', 'soft', 'outline']), size: oneOf(['sm', 'md', 'lg']), pill: bool,
    },
    required: ['label'],
  },
  Icon: { props: { name: ICON, color, size: oneOf(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']) }, required: ['name'] },
  Image: {
    props: {
      ...BLOCK, src: httpsUrl, alt: label, fit: oneOf(['cover', 'contain', 'fill', 'scale-down', 'none']),
      frame: bool, flush: bool, background: color,
    },
    required: ['src'],
  },
  Button: {
    props: {
      label, onClickAction: action, submit: bool, iconStart: ICON, iconEnd: ICON,
      style: oneOf(['primary', 'secondary']),
      color: oneOf(['primary', 'secondary', 'info', 'discovery', 'success', 'caution', 'warning', 'danger']),
      variant: CONTROL_VARIANT, size: CONTROL_SIZE, pill: bool, uniform: bool, block: bool, disabled: bool,
    },
  },
  Spacer: { props: { minSize: length } },
  Divider: { props: { color, size: px, spacing: space, flush: bool } },
  Transition: { props: {}, children: 'single' },
  Input: {
    props: {
      ...FIELD, inputType: oneOf(['number', 'email', 'text', 'password', 'tel', 'url']),
      defaultValue: text, variant: FIELD_VARIANT, pill: bool, autoFocus: bool,
    },
    required: ['name'],
  },
  Textarea: {
    props: { ...FIELD, defaultValue: text, variant: FIELD_VARIANT, rows: int(1, 30), autoResize: bool, maxRows: int(1, 30) },
    required: ['name'],
  },
  Select: {
    props: {
      ...FIELD, options, onChangeAction: action, defaultValue: label, variant: CONTROL_VARIANT,
      pill: bool, block: bool, clearable: bool,
    },
    required: ['name', 'options'],
  },
  DatePicker: {
    props: {
      ...FIELD, onChangeAction: action, defaultValue: label, min: label, max: label,
      variant: CONTROL_VARIANT, pill: bool, block: bool, clearable: bool,
    },
    required: ['name'],
  },
  Checkbox: {
    props: { name: fieldName, label, defaultChecked: bool, onChangeAction: action, disabled: bool, required: bool },
    required: ['name'],
  },
  RadioGroup: {
    props: {
      name: fieldName, options, onChangeAction: action, defaultValue: label, direction: DIRECTION,
      disabled: bool, required: bool,
    },
    required: ['name', 'options'],
  },
  Table: { props: {}, children: 'nodes' },
  'Table.Row': { props: { header: bool }, children: 'nodes' },
  'Table.Cell': {
    props: { width: length, padding, align: TEXT_ALIGN, vAlign: TEXT_ALIGN, colSpan: int(1, 12) },
    children: 'nodes',
  },
} as const satisfies Record<string, NodeSchema>;

export type FrameNodeType = keyof typeof FRAME_NODE_SCHEMAS;

type PropsOf<S> = { [K in keyof S]?: S[K] extends Validator<infer T> ? T : never };

export type FrameSchemaNode = {
  [T in FrameNodeType]: {
    type: T;
    props: PropsOf<(typeof FRAME_NODE_SCHEMAS)[T]['props']>;
    children: FrameNode[];
  };
}[FrameNodeType];

export interface FrameChartNode {
  type: 'Chart';
  props: { header: string[]; rows: string[][] };
  children: FrameNode[];
}

export interface FrameUnsupportedNode {
  type: 'Unsupported';
  props: { name: string };
  children: FrameNode[];
}

export type FrameNode = FrameSchemaNode | FrameChartNode | FrameUnsupportedNode;

export type FrameNodeOf<T extends FrameNode['type']> = Extract<FrameNode, { type: T }>;

export function isFrameNodeType(type: string): type is FrameNodeType {
  return Object.hasOwn(FRAME_NODE_SCHEMAS, type);
}

export function schemaOf(type: FrameNodeType): NodeSchema {
  return FRAME_NODE_SCHEMAS[type];
}

import { CENTRAL_ICON_NAMES } from '../central-icons.names.data';
import { BRAND_ICON_NAMES } from '../brand-icons.data';
import { BUTTON_COLORS, BUTTON_FILLS, SIZES } from '../button.styles';
import { CHART_COLORS, CHART_CURVE_TYPES, CHART_LIMITS } from '../chart';
import { HERO_ICON_DATA as HERO_ICON_PATHS } from '../heroicons.data';
import { A2UI_ICON_NAMES } from '../icons.a2ui';
import { BOX_RADIUS_SCALE, COLOR_TOKENS, FONT_SIZE } from '../tokens';
import { BASIC_CATALOG_ID, type JsonObject } from './protocol';

export const common = (name: string): JsonObject => ({ $ref: `common_types.json#/$defs/${name}` });
export const basic = (pointer: string): JsonObject => ({ $ref: `${BASIC_CATALOG_ID}#${pointer}` });
const strings = (values: readonly string[], description: string): JsonObject => ({ type: 'string', enum: [...values], description });

export const dynamic = (description: string, literal: JsonObject): JsonObject => ({
  description,
  anyOf: [literal, common('DataBinding'), common('FunctionCall')],
});
export const token = (values: readonly string[], description: string): JsonObject =>
  dynamic(description, { type: 'string', enum: [...values] });
const NON_NEGATIVE: JsonObject = { type: 'number', minimum: 0 };
const HEX: JsonObject = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const COLOR_LITERAL: JsonObject = { anyOf: [{ type: 'string', enum: [...COLOR_TOKENS] }, HEX] };
export const COLOR = dynamic(`A Kit colour token (${COLOR_TOKENS.join(', ')}) or a #rrggbb hex colour.`, COLOR_LITERAL);
export const BOOLEAN = common('DynamicBoolean');
export const SPACING = dynamic('Spacing in density-independent pixels.', NON_NEGATIVE);
const LENGTH = dynamic('A size in density-independent pixels, or a percentage of the parent such as "40%".', {
  anyOf: [NON_NEGATIVE, { type: 'string', pattern: '^(100|[0-9]{1,2})(\\.[0-9]+)?%$' }],
});
const SIDES = ['top', 'right', 'bottom', 'left', 'x', 'y'];
export const PADDING = dynamic('Padding in pixels: one number, or per side with top, right, bottom, left, x and y.', {
  anyOf: [
    NON_NEGATIVE,
    { type: 'object', properties: Object.fromEntries(SIDES.map((side) => [side, NON_NEGATIVE])), additionalProperties: false },
  ],
});
const BORDER_SIDE: JsonObject = {
  type: 'object',
  properties: { size: NON_NEGATIVE, color: COLOR_LITERAL, style: { type: 'string', enum: ['solid', 'dashed', 'dotted'] } },
  required: ['size'],
  additionalProperties: false,
};
const BORDER = dynamic(
  'A border: a width in pixels, { size, color, style } on every side, or { top, right, bottom, left } with one of those per side.',
  {
    anyOf: [
      NON_NEGATIVE,
      BORDER_SIDE,
      {
        type: 'object',
        properties: Object.fromEntries(['top', 'right', 'bottom', 'left'].map((side) => [side, { anyOf: [NON_NEGATIVE, BORDER_SIDE] }])),
        minProperties: 1,
        additionalProperties: false,
      },
    ],
  },
);
export const OPACITY = dynamic('Opacity from 0 (invisible) to 1 (the default), for muted or inactive content.', {
  type: 'number',
  minimum: 0,
  maximum: 1,
});
export const MAX_LINES = dynamic('Clamp to this many lines.', { type: 'integer', minimum: 1 });
export const ASPECT_RATIO = dynamic('Width divided by height.', { type: 'number', exclusiveMinimum: 0 });
export const SURFACE = token(
  ['none', 'surface', 'raised', 'sunken', 'toolbar'],
  'A Kit surface background: surface is the page background.',
);
export const RADIUS: JsonObject = dynamic('A Kit corner radius token, or a radius in density-independent pixels.', {
  anyOf: [{ type: 'string', enum: Object.keys(BOX_RADIUS_SCALE) }, NON_NEGATIVE],
});
export const FONT_SIZES = token(Object.keys(FONT_SIZE), 'A Kit font size token.');
export const ICON_NAME: JsonObject = {
  description:
    'An icon: a basic catalog name, a Kit HeroIcon name, a Central icon name (its Central name without the Icon prefix, such as settingsGear1 or chevronRightSmall) or a brand icon name.',
  oneOf: [
    strings([...new Set([...A2UI_ICON_NAMES, ...Object.keys(HERO_ICON_PATHS), ...CENTRAL_ICON_NAMES, ...BRAND_ICON_NAMES])], 'Icon name.'),
    { type: 'object', properties: { svgPath: common('DynamicString') }, required: ['svgPath'], additionalProperties: false },
    common('DataBinding'),
  ],
};

export function inherit(name: string, extras: JsonObject = {}): JsonObject {
  return {
    type: 'object',
    allOf: [
      basic(`/components/${name}`),
      { type: 'object', properties: { component: { const: name }, ...extras }, required: ['component'] },
    ],
  };
}

export function component(name: string, properties: JsonObject, required: readonly string[], description: string): JsonObject {
  return {
    type: 'object',
    description,
    properties: { component: { const: name }, ...properties, weight: basic('/components/Text/properties/weight') },
    required: ['component', ...required],
  };
}

export const LAYOUT_EXTRAS: JsonObject = {
  opacity: OPACITY,
  action: {
    ...common('Action'),
    description:
      'Makes the whole Row or Column pressable, with hover and pressed feedback and a button role: a clickable card, nav item or list row that keeps the look you give it. Give it an accessibility.label.',
  },
  feedback: token(
    ['opacity', 'highlight', 'none'],
    'How a Row or Column with an action reacts to hover and press: opacity fades it (the default), highlight tints its background, none shows nothing.',
  ),
  gap: SPACING,
  padding: PADDING,
  wrap: BOOLEAN,
  surface: SURFACE,
  background: COLOR,
  radius: RADIUS,
  border: BORDER,
  width: LENGTH,
  height: LENGTH,
  minWidth: LENGTH,
  minHeight: LENGTH,
  maxWidth: LENGTH,
  maxHeight: LENGTH,
  aspectRatio: ASPECT_RATIO,
};

export const BUTTON: JsonObject = {
  type: 'object',
  allOf: [
    common('Checkable'),
    {
      type: 'object',
      properties: {
        component: { const: 'Button' },
        child: basic('/components/Button/allOf/1/properties/child'),
        action: basic('/components/Button/allOf/1/properties/action'),
        weight: basic('/components/Button/allOf/1/properties/weight'),
        variant: {
          ...token(
            ['default', 'primary', 'borderless', ...BUTTON_FILLS],
            'default, primary and borderless are the basic catalog hints; solid, soft, outline and ghost pick a Kit fill used with color.',
          ),
          default: 'default',
        },
        color: token(BUTTON_COLORS, 'The Kit button colour.'),
        size: token(Object.keys(SIZES), 'The Kit button size.'),
        pill: BOOLEAN,
        block: BOOLEAN,
        uniform: BOOLEAN,
        iconStart: ICON_NAME,
        iconEnd: ICON_NAME,
        disabled: common('DynamicBoolean'),
        loading: {
          ...common('DynamicBoolean'),
          description: 'Shows a spinner in place of the label and ignores presses, for a save in progress.',
        },
        opacity: OPACITY,
      },
      required: ['component', 'child', 'action'],
    },
  ],
};

export const ICON: JsonObject = {
  type: 'object',
  properties: {
    component: { const: 'Icon' },
    name: ICON_NAME,
    size: dynamic('Icon size in pixels. Defaults to 24.', { type: 'number', minimum: 1 }),
    color: COLOR,
    variant: token(['outline', 'solid'], 'Outline (default) or solid HeroIcon.'),
    opacity: OPACITY,
    weight: basic('/components/Icon/properties/weight'),
  },
  required: ['component', 'name'],
};

const CHART_SERIES: JsonObject = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['bar', 'line', 'area'] },
    dataKey: common('DynamicString'),
    label: common('DynamicString'),
    color: {
      ...common('DynamicString'),
      description: `A chart colour (${CHART_COLORS.join(', ')}), a shade such as blue-500, a Kit colour token or a #rrggbb hex colour.`,
    },
    stack: common('DynamicString'),
    curveType: { type: 'string', enum: [...CHART_CURVE_TYPES] },
  },
  required: ['type', 'dataKey'],
  additionalProperties: false,
};

export const CHART: JsonObject = component(
  'Chart',
  {
    data: dynamic('The rows to plot, usually bound to an array of objects in the data model.', {
      type: 'array',
      maxItems: CHART_LIMITS.rows,
      items: { type: 'object', additionalProperties: { type: ['string', 'number'] } },
    }),
    series: dynamic('The series to draw, or a binding to them.', {
      type: 'array',
      minItems: 1,
      maxItems: CHART_LIMITS.series,
      items: CHART_SERIES,
    }),
    xAxis: {
      description: 'The data key of the categories, or { dataKey, hide, labels }.',
      anyOf: [
        { type: 'string' },
        {
          type: 'object',
          properties: {
            dataKey: { type: 'string' },
            hide: { type: 'boolean' },
            labels: { type: 'object', additionalProperties: { type: 'string' } },
          },
          required: ['dataKey'],
          additionalProperties: false,
        },
      ],
    },
    yAxis: {
      type: 'object',
      properties: {
        domain: {
          type: 'array',
          minItems: 2,
          maxItems: 2,
          items: { anyOf: [{ type: 'number' }, { type: 'string', enum: ['auto', 'dataMin', 'dataMax'] }] },
        },
      },
      additionalProperties: false,
    },
    showYAxis: BOOLEAN,
    showLegend: BOOLEAN,
    showTooltip: BOOLEAN,
    barGap: NON_NEGATIVE,
    barCategoryGap: NON_NEGATIVE,
    width: LENGTH,
    height: LENGTH,
    aspectRatio: ASPECT_RATIO,
  },
  ['data', 'series', 'xAxis'],
  'A bar, line or area chart with the ChatKit Chart props.',
);

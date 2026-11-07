import { CENTRAL_ICON_NAMES } from '../central-icons.names.data';
import { BRAND_ICON_NAMES } from '../brand-icons.data';
import { KIT_ICON_ALIASES } from '../central-icons.aliases';
import { BUTTON_COLORS, BUTTON_SIZES, BUTTON_VARIANTS } from '../button.styles';
import { CHART_COLORS, CHART_CURVE_TYPES, CHART_LIMITS } from '../chart';
import { A2UI_ICON_NAMES } from '../icons.a2ui';
import {
  A2UI_ICON_VARIANTS,
  BORDER_SIDES,
  BORDER_STYLES,
  CHART_DOMAIN_BOUNDS,
  CHART_SERIES_TYPES,
  LITERAL_HEX_COLOR_PATTERN,
  PADDING_SIDES,
  PERCENT_PATTERN,
  PRESS_FEEDBACKS,
  SURFACES,
} from '../kit-vocabulary';
import type { Size, Spacing } from '../layout';
import { BOX_RADIUS_SCALE, COLOR_TOKENS, FONT_SIZE, type FontSizeName, type RadiusValue } from '../tokens';
import {
  asBoolean,
  asEnum,
  asNumber,
  borderSpecOf,
  colorValueOf,
  lengthOf,
  radiusOf,
  spacingOf,
  type BorderSpec,
} from './kit-catalog.coerce';
import { BASIC_CATALOG_ID, type JsonObject } from './protocol';

export interface KitProp<T> {
  readonly schema: JsonObject;
  readonly coerce: (value: unknown) => T | undefined;
}

export type PropSpec = KitProp<unknown> | JsonObject;

export type PropSpecs = Readonly<Record<string, PropSpec>>;

export type CoercedProps<P extends PropSpecs> = {
  [K in keyof P as P[K] extends KitProp<unknown> ? K : never]: P[K] extends KitProp<infer T> ? T | undefined : never;
};

function isKitProp(spec: PropSpec): spec is KitProp<unknown> {
  return typeof spec.coerce === 'function';
}

export function schemaOf(spec: PropSpec): JsonObject {
  return isKitProp(spec) ? spec.schema : spec;
}

export function schemasOf(props: PropSpecs): JsonObject {
  return Object.fromEntries(Object.entries(props).map(([name, spec]) => [name, schemaOf(spec)]));
}

export function coerceProps<P extends PropSpecs>(props: P, values: Readonly<Record<string, unknown>>): CoercedProps<P> {
  const out: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(props)) if (isKitProp(spec)) out[name] = spec.coerce(values[name]);
  return out as CoercedProps<P>;
}

export function prop<T>(schema: JsonObject, coerce: (value: unknown) => T | undefined): KitProp<T> {
  return { schema, coerce };
}

export function described<T>(spec: KitProp<T>, description: string): KitProp<T> {
  return prop({ ...spec.schema, description }, spec.coerce);
}

export function withDefault<T>(spec: KitProp<T>, value: T & string): KitProp<T> {
  return prop({ ...spec.schema, default: value }, spec.coerce);
}

export const common = (name: string): JsonObject => ({ $ref: `common_types.json#/$defs/${name}` });
export const basic = (pointer: string): JsonObject => ({ $ref: `${BASIC_CATALOG_ID}#${pointer}` });
const strings = (values: readonly string[], description: string): JsonObject => ({ type: 'string', enum: [...values], description });

export const dynamic = (description: string, literal: JsonObject): JsonObject => ({
  description,
  anyOf: [literal, common('DataBinding'), common('FunctionCall')],
});

export function token<const T extends string>(values: readonly T[], description: string): KitProp<T> {
  return prop(dynamic(description, { type: 'string', enum: [...values] }), (value) => asEnum(value, values));
}

export function number(description: string, literal: JsonObject): KitProp<number> {
  return prop(dynamic(description, literal), asNumber);
}

const NON_NEGATIVE: JsonObject = { type: 'number', minimum: 0 };
const HEX: JsonObject = { type: 'string', pattern: LITERAL_HEX_COLOR_PATTERN };
const COLOR_LITERAL: JsonObject = { anyOf: [{ type: 'string', enum: [...COLOR_TOKENS] }, HEX] };
export const COLOR = prop(dynamic(`A Kit colour token (${COLOR_TOKENS.join(', ')}) or a #rrggbb hex colour.`, COLOR_LITERAL), colorValueOf);
export const BOOLEAN = prop(common('DynamicBoolean'), asBoolean);
export const SPACING = prop(dynamic('Spacing in density-independent pixels.', NON_NEGATIVE), asNumber);
export const LENGTH = prop<Size>(
  dynamic('A size in density-independent pixels, or a percentage of the parent such as "40%".', {
    anyOf: [NON_NEGATIVE, { type: 'string', pattern: PERCENT_PATTERN }],
  }),
  lengthOf,
);
export const PADDING = prop<number | Spacing>(
  dynamic('Padding in pixels: one number, or per side with top, right, bottom, left, x and y.', {
    anyOf: [
      NON_NEGATIVE,
      { type: 'object', properties: Object.fromEntries(PADDING_SIDES.map((side) => [side, NON_NEGATIVE])), additionalProperties: false },
    ],
  }),
  spacingOf,
);
const BORDER_SIDE: JsonObject = {
  type: 'object',
  properties: { size: NON_NEGATIVE, color: COLOR_LITERAL, style: { type: 'string', enum: [...BORDER_STYLES] } },
  required: ['size'],
  additionalProperties: false,
};
export const BORDER = prop<BorderSpec>(
  dynamic(
    'A border: a width in pixels, { size, color, style } on every side, or { top, right, bottom, left } with one of those per side.',
    {
      anyOf: [
        NON_NEGATIVE,
        BORDER_SIDE,
        {
          type: 'object',
          properties: Object.fromEntries(BORDER_SIDES.map((side) => [side, { anyOf: [NON_NEGATIVE, BORDER_SIDE] }])),
          minProperties: 1,
          additionalProperties: false,
        },
      ],
    },
  ),
  borderSpecOf,
);
export const OPACITY = number('Opacity from 0 (invisible) to 1 (the default), for muted or inactive content.', {
  type: 'number',
  minimum: 0,
  maximum: 1,
});
export const MAX_LINES = number('Clamp to this many lines.', { type: 'integer', minimum: 1 });
export const ASPECT_RATIO = number('Width divided by height.', { type: 'number', exclusiveMinimum: 0 });
export const SURFACE = token(SURFACES, 'A Kit surface background: surface is the page background.');
export const RADIUS = prop<RadiusValue | number>(
  dynamic('A Kit corner radius token, or a radius in density-independent pixels.', {
    anyOf: [{ type: 'string', enum: Object.keys(BOX_RADIUS_SCALE) }, NON_NEGATIVE],
  }),
  radiusOf,
);
export const FONT_SIZES = token(Object.keys(FONT_SIZE) as FontSizeName[], 'A Kit font size token.');
export const ICON_NAME: JsonObject = {
  description:
    'An icon: a basic catalog name, a Kit alias (a HeroIcon name or pin), a Central icon name (its Central name without the Icon prefix, such as settingsGear1 or chevronRightSmall) or a brand icon name.',
  oneOf: [
    strings([...new Set([...A2UI_ICON_NAMES, ...Object.keys(KIT_ICON_ALIASES), ...CENTRAL_ICON_NAMES, ...BRAND_ICON_NAMES])], 'Icon name.'),
    { type: 'object', properties: { svgPath: common('DynamicString') }, required: ['svgPath'], additionalProperties: false },
    common('DataBinding'),
  ],
};

export function inherit(name: string, extras: PropSpecs = {}): JsonObject {
  return {
    type: 'object',
    allOf: [
      basic(`/components/${name}`),
      { type: 'object', properties: { component: { const: name }, ...schemasOf(extras) }, required: ['component'] },
    ],
  };
}

export function component(name: string, properties: PropSpecs, required: readonly string[], description: string): JsonObject {
  return {
    type: 'object',
    description,
    properties: { component: { const: name }, ...schemasOf(properties), weight: basic('/components/Text/properties/weight') },
    required: ['component', ...required],
  };
}

export const LAYOUT_EXTRAS = {
  opacity: OPACITY,
  action: {
    ...common('Action'),
    description:
      'Makes the whole Row or Column pressable, with hover and pressed feedback and a button role: a clickable card, nav item or list row that keeps the look you give it. Give it an accessibility.label.',
  },
  feedback: token(
    PRESS_FEEDBACKS,
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

export const BUTTON_PROPS = {
  variant: withDefault(
    token(
      BUTTON_VARIANTS,
      'default, primary and borderless are the basic catalog hints; solid, soft, outline and ghost pick a Kit fill used with color.',
    ),
    'default',
  ),
  color: token(BUTTON_COLORS, 'The Kit button colour.'),
  size: token(BUTTON_SIZES, 'The Kit button size.'),
  pill: BOOLEAN,
  block: BOOLEAN,
  uniform: BOOLEAN,
  iconStart: ICON_NAME,
  iconEnd: ICON_NAME,
  disabled: BOOLEAN,
  loading: described(BOOLEAN, 'Shows a spinner in place of the label and ignores presses, for a save in progress.'),
  opacity: OPACITY,
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
        ...schemasOf(BUTTON_PROPS),
      },
      required: ['component', 'child', 'action'],
    },
  ],
};

export const ICON_PROPS = {
  name: ICON_NAME,
  size: number('Icon size in pixels. Defaults to 24.', { type: 'number', minimum: 1 }),
  color: COLOR,
  variant: token(A2UI_ICON_VARIANTS, 'Outline (default) or solid HeroIcon.'),
  opacity: OPACITY,
};

export const ICON: JsonObject = {
  type: 'object',
  properties: { component: { const: 'Icon' }, ...schemasOf(ICON_PROPS), weight: basic('/components/Icon/properties/weight') },
  required: ['component', 'name'],
};

const CHART_SERIES: JsonObject = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: [...CHART_SERIES_TYPES] },
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

export const CHART_PROPS = {
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
        items: { anyOf: [{ type: 'number' }, { type: 'string', enum: [...CHART_DOMAIN_BOUNDS] }] },
      },
    },
    additionalProperties: false,
  },
  showYAxis: BOOLEAN,
  showLegend: BOOLEAN,
  showTooltip: BOOLEAN,
  barGap: prop(NON_NEGATIVE, asNumber),
  barCategoryGap: prop(NON_NEGATIVE, asNumber),
  width: LENGTH,
  height: LENGTH,
  aspectRatio: ASPECT_RATIO,
};

export const CHART: JsonObject = component(
  'Chart',
  CHART_PROPS,
  ['data', 'series', 'xAxis'],
  'A bar, line or area chart with the ChatKit Chart props.',
);

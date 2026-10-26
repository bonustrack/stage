import { BADGE_COLORS, BADGE_SIZES, BADGE_VARIANTS } from '../badge';
import { BRAND_ICON_NAMES } from '../brand-icons.data';
import { BUTTON_COLORS, BUTTON_FILLS, SIZES } from '../button.styles';
import { CHART_COLORS, CHART_CURVE_TYPES, CHART_LIMITS } from '../chart';
import { HERO_ICON_DATA as HERO_ICON_PATHS } from '../heroicons.data';
import { A2UI_ICON_NAMES } from '../icons.a2ui';
import { BOX_RADIUS_SCALE, COLOR_TOKENS, FONT_SIZE } from '../tokens';
import { A2UI_PROTOCOL_VERSION, BASIC_CATALOG_ID, entriesOf, isJsonObject, type JsonObject, type JsonValue } from './protocol';
import { BASIC_CATALOG } from './schemas';

export const KIT_CATALOG_ID = 'https://kit.stage.box/a2ui/v1_0/catalog.json';

const common = (name: string): JsonObject => ({ $ref: `common_types.json#/$defs/${name}` });
const basic = (pointer: string): JsonObject => ({ $ref: `${BASIC_CATALOG_ID}#${pointer}` });
const strings = (values: readonly string[], description: string): JsonObject => ({ type: 'string', enum: [...values], description });

const dynamic = (description: string, literal: JsonObject): JsonObject => ({
  description,
  anyOf: [literal, common('DataBinding'), common('FunctionCall')],
});
const token = (values: readonly string[], description: string): JsonObject => dynamic(description, { type: 'string', enum: [...values] });
const NON_NEGATIVE: JsonObject = { type: 'number', minimum: 0 };
const HEX: JsonObject = { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' };
const COLOR_LITERAL: JsonObject = { anyOf: [{ type: 'string', enum: [...COLOR_TOKENS] }, HEX] };
const COLOR = dynamic(`A Kit colour token (${COLOR_TOKENS.join(', ')}) or a #rrggbb hex colour.`, COLOR_LITERAL);
const BOOLEAN = common('DynamicBoolean');
const SPACING = dynamic('Spacing in density-independent pixels.', NON_NEGATIVE);
const LENGTH = dynamic('A size in density-independent pixels, or a percentage of the parent such as "40%".', {
  anyOf: [NON_NEGATIVE, { type: 'string', pattern: '^(100|[0-9]{1,2})(\\.[0-9]+)?%$' }],
});
const SIDES = ['top', 'right', 'bottom', 'left', 'x', 'y'];
const PADDING = dynamic('Padding in pixels: one number, or per side with top, right, bottom, left, x and y.', {
  anyOf: [NON_NEGATIVE, { type: 'object', properties: Object.fromEntries(SIDES.map((side) => [side, NON_NEGATIVE])), additionalProperties: false }],
});
const BORDER = dynamic('A border: a width in pixels, or { size, color, style }.', {
  anyOf: [
    NON_NEGATIVE,
    {
      type: 'object',
      properties: { size: NON_NEGATIVE, color: COLOR_LITERAL, style: { type: 'string', enum: ['solid', 'dashed', 'dotted'] } },
      required: ['size'],
      additionalProperties: false,
    },
  ],
});
const MAX_LINES = dynamic('Clamp to this many lines.', { type: 'integer', minimum: 1 });
const ASPECT_RATIO = dynamic('Width divided by height.', { type: 'number', exclusiveMinimum: 0 });
const SURFACE = token(['none', 'surface', 'raised', 'sunken', 'toolbar'], 'A Kit surface background: surface is the page background.');
const RADIUS: JsonObject = token(Object.keys(BOX_RADIUS_SCALE), 'A Kit corner radius token.');
const FONT_SIZES = token(Object.keys(FONT_SIZE), 'A Kit font size token.');
const ICON_NAME: JsonObject = {
  description: 'An icon: a basic catalog name, a Kit HeroIcon name or a brand icon name.',
  oneOf: [
    strings([...new Set([...A2UI_ICON_NAMES, ...Object.keys(HERO_ICON_PATHS), ...BRAND_ICON_NAMES])], 'Icon name.'),
    { type: 'object', properties: { svgPath: common('DynamicString') }, required: ['svgPath'], additionalProperties: false },
    common('DataBinding'),
  ],
};

function inherit(name: string, extras: JsonObject = {}): JsonObject {
  return {
    type: 'object',
    allOf: [basic(`/components/${name}`), { type: 'object', properties: { component: { const: name }, ...extras }, required: ['component'] }],
  };
}

function component(name: string, properties: JsonObject, required: readonly string[], description: string): JsonObject {
  return {
    type: 'object',
    description,
    properties: { component: { const: name }, ...properties, weight: basic('/components/Text/properties/weight') },
    required: ['component', ...required],
  };
}

const LAYOUT_EXTRAS: JsonObject = {
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

const BUTTON: JsonObject = {
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
          ...token(['default', 'primary', 'borderless', ...BUTTON_FILLS], 'default, primary and borderless are the basic catalog hints; solid, soft, outline and ghost pick a Kit fill used with color.'),
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
      },
      required: ['component', 'child', 'action'],
    },
  ],
};

const ICON: JsonObject = {
  type: 'object',
  properties: {
    component: { const: 'Icon' },
    name: ICON_NAME,
    size: dynamic('Icon size in pixels. Defaults to 24.', { type: 'number', minimum: 1 }),
    color: COLOR,
    variant: token(['outline', 'solid'], 'Outline (default) or solid HeroIcon.'),
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
    color: { ...common('DynamicString'), description: `A chart colour (${CHART_COLORS.join(', ')}), a shade such as blue-500, a Kit colour token or a #rrggbb hex colour.` },
    stack: common('DynamicString'),
    curveType: { type: 'string', enum: [...CHART_CURVE_TYPES] },
  },
  required: ['type', 'dataKey'],
  additionalProperties: false,
};

const CHART: JsonObject = component('Chart', {
  data: dynamic('The rows to plot, usually bound to an array of objects in the data model.', {
    type: 'array',
    maxItems: CHART_LIMITS.rows,
    items: { type: 'object', additionalProperties: { type: ['string', 'number'] } },
  }),
  series: dynamic('The series to draw, or a binding to them.', { type: 'array', minItems: 1, maxItems: CHART_LIMITS.series, items: CHART_SERIES }),
  xAxis: {
    description: 'The data key of the categories, or { dataKey, hide, labels }.',
    anyOf: [
      { type: 'string' },
      {
        type: 'object',
        properties: { dataKey: { type: 'string' }, hide: { type: 'boolean' }, labels: { type: 'object', additionalProperties: { type: 'string' } } },
        required: ['dataKey'],
        additionalProperties: false,
      },
    ],
  },
  yAxis: {
    type: 'object',
    properties: { domain: { type: 'array', minItems: 2, maxItems: 2, items: { anyOf: [{ type: 'number' }, { type: 'string', enum: ['auto', 'dataMin', 'dataMax'] }] } } },
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
}, ['data', 'series', 'xAxis'], 'A bar, line or area chart with the ChatKit Chart props.');

const KIT_COMPONENTS: Record<string, JsonObject> = {
  Text: inherit('Text', {
    size: FONT_SIZES,
    fontWeight: token(['normal', 'medium', 'semibold', 'bold'], 'The font weight.'),
    color: COLOR,
    textAlign: token(['start', 'center', 'end'], 'Horizontal alignment.'),
    italic: BOOLEAN,
    lineThrough: BOOLEAN,
    truncate: BOOLEAN,
    maxLines: MAX_LINES,
    fontFamily: token(['sans', 'mono'], 'The Kit font family.'),
  }),
  Image: inherit('Image', { radius: RADIUS, size: SPACING, width: SPACING, height: SPACING, aspectRatio: ASPECT_RATIO, background: COLOR }),
  Icon: ICON,
  Video: inherit('Video'),
  AudioPlayer: inherit('AudioPlayer'),
  Row: inherit('Row', LAYOUT_EXTRAS),
  Column: inherit('Column', LAYOUT_EXTRAS),
  List: inherit('List', { gap: SPACING }),
  Card: inherit('Card', { size: token(['sm', 'md', 'lg'], 'Card padding size.'), padding: SPACING, surface: SURFACE, background: COLOR }),
  Tabs: inherit('Tabs', { variant: token(['segmented', 'underline'], 'The tab bar style.') }),
  Modal: inherit('Modal', { title: common('DynamicString') }),
  Divider: inherit('Divider', { spacing: SPACING, color: COLOR }),
  Button: BUTTON,
  TextField: inherit('TextField', {
    appearance: token(['soft', 'outline', 'plain'], 'The input surface style.'),
    hint: common('DynamicString'),
    hideLabel: { ...BOOLEAN, description: 'Keep the compact field: the label is read by screen readers only.' },
  }),
  CheckBox: inherit('CheckBox', { displayStyle: token(['checkbox', 'switch'], 'Render as a checkbox (default) or a toggle switch.') }),
  ChoicePicker: inherit('ChoicePicker'),
  Slider: inherit('Slider'),
  DateTimeInput: inherit('DateTimeInput', { placeholder: common('DynamicString') }),
  Title: component('Title', {
    text: common('DynamicString'),
    level: dynamic('Heading level, 1 is largest.', { type: 'integer', enum: [1, 2, 3] }),
    maxLines: MAX_LINES,
    size: token(['sm', 'md', 'lg'], 'Heading size.'),
    color: COLOR,
  }, ['text'], 'A heading in the Kit head font.'),
  Badge: component('Badge', {
    label: common('DynamicString'),
    color: token(BADGE_COLORS, 'The badge colour.'),
    variant: token(BADGE_VARIANTS, 'The badge fill.'),
    size: token(BADGE_SIZES, 'The badge size.'),
    pill: BOOLEAN,
  }, ['label'], 'A small status label.'),
  ListView: component('ListView', {
    children: common('ChildList'),
    limit: dynamic('Show at most this many items.', { type: 'integer', minimum: 1 }),
    status: common('DynamicString'),
  }, ['children'], 'A list of ListViewItem rows separated by inset dividers.'),
  ListViewItem: component('ListViewItem', {
    children: common('ChildList'),
    action: common('Action'),
    gap: SPACING,
    align: token(['start', 'center', 'end'], 'Cross-axis alignment of the row.'),
  }, ['children'], 'A pressable row inside a ListView.'),
  Spinner: component('Spinner', { size: SPACING, color: COLOR }, [], 'An indeterminate progress indicator.'),
  Chart: CHART,
  QrCode: component('QrCode', { value: common('DynamicString'), size: SPACING }, ['value'], 'A QR code for a string such as a payment link.'),
};

const AGENT_CALLABLE = new Set(['formatString', 'formatNumber', 'formatCurrency', 'formatDate', 'pluralize']);

function inheritedFunction(name: string, definition: JsonValue): JsonObject {
  const source = isJsonObject(definition) ? definition : {};
  const inherited = Object.fromEntries(entriesOf(source).filter(([key]) => ['returnType', 'allowedCallers', 'requiresUserActivation', 'description'].includes(key)));
  const meta = AGENT_CALLABLE.has(name) ? { ...inherited, allowedCallers: 'rendererOrAgent', requiresUserActivation: false } : inherited;
  const props = isJsonObject(source.properties) ? source.properties : {};
  return {
    type: 'object',
    ...meta,
    properties: { '@call': { const: name }, ...(props.args === undefined ? {} : { args: basic(`/functions/${name}/properties/args`) }) },
    required: Array.isArray(source.required) ? source.required : ['@call'],
  };
}

const BASIC_FUNCTIONS = isJsonObject(BASIC_CATALOG.functions) ? BASIC_CATALOG.functions : {};
const KIT_FUNCTIONS: Record<string, JsonObject> = {
  ...Object.fromEntries(entriesOf(BASIC_FUNCTIONS).map(([name, def]) => [name, inheritedFunction(name, def)])),
  openSurface: {
    type: 'object',
    description: 'Shows another surface of the same message as a new screen with a back button (requires user activation). This function has no return value.',
    returnType: 'void',
    requiresUserActivation: true,
    properties: {
      '@call': { const: 'openSurface' },
      args: {
        type: 'object',
        properties: { surfaceId: { description: 'The id of the surface to show.', oneOf: [{ type: 'string' }, common('DataBinding'), common('FunctionCall')] } },
        required: ['surfaceId'],
        unevaluatedProperties: false,
      },
    },
    required: ['@call', 'args'],
  },
  closeSurface: {
    type: 'object',
    description: 'Goes back to the screen shown before the last openSurface (requires user activation). This function has no return value.',
    returnType: 'void',
    requiresUserActivation: true,
    properties: { '@call': { const: 'closeSurface' } },
    required: ['@call'],
  },
};

const INSTRUCTIONS = [
  'This catalog is the A2UI basic catalog rendered with the Stage Kit design system. Every basic catalog component is available with the same props, plus optional Kit props.',
  '',
  '## Layout',
  '',
  'Use Row and Column to organise components. Kit adds `gap`, `padding` (one number or per side), `wrap`, `surface` (surface, raised, sunken, toolbar), `background`, `radius`, `border`, and `width`, `height`, `minWidth`, `minHeight`, `maxWidth`, `maxHeight` in pixels or as a percentage such as "40%". Prefer `gap` on the container over spacing on the children. A proportional bar is a Row whose filled Column has a `width` bound to a percentage.',
  '',
  '## Data binding',
  '',
  'Every Kit style prop (colours, sizes, variants, widths, flags) also takes a data binding or a function call, so a status colour or a bar width can come from the data model. Values that are not a Kit token, a #rrggbb colour or a valid size are ignored.',
  '',
  '## Charts',
  '',
  'Chart takes the ChatKit Chart props: `data` (an array of objects, usually bound to the data model), `series` (bar, line or area, each with a `dataKey`), `xAxis` and the optional `yAxis`, `showYAxis`, `showLegend`, `showTooltip`, `barGap`, `barCategoryGap`, `width`, `height` and `aspectRatio`.',
  '',
  '## Text',
  '',
  'Text takes the Kit `size` tokens (3xs to 3xl, md is the body size), `fontWeight` (normal, medium, semibold, bold) and `color` tokens: text, secondary, muted, link, primary, danger, success, border. Use `variant: caption` for secondary small print and Title for headings.',
  '',
  '## Buttons',
  '',
  'Button `variant` accepts the basic hints (default, primary, borderless) or a Kit fill (solid, soft, outline, ghost) combined with `color` (primary, secondary, info, discovery, success, caution, warning, danger). Use exactly one primary button per surface.',
  '',
  '## Icons',
  '',
  'Icon `name` accepts the basic catalog names and the Kit HeroIcon names such as wallet, qrcode, sparkles or chatAlt.',
  '',
  '## Screens',
  '',
  'A message can create several surfaces. The first one shows; a button whose action calls `openSurface` with another surface id shows that surface as a new screen with a back button, and `closeSurface` goes back.',
  '',
  '## Functions',
  '',
  'Every basic catalog function is available. In this catalog the agent may also call formatString, formatNumber, formatCurrency, formatDate and pluralize with callRendererFunction.',
  '',
  '## Inputs',
  '',
  'As in the basic catalog, inputs only write to the data model. To act on them, add a Button whose action context references the input paths (or set `sendDataModel` on the surface): for example an Apply button for filters or a Search button for a search field.',
].join('\n');

export const KIT_CATALOG: JsonObject = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: KIT_CATALOG_ID,
  protocolVersion: A2UI_PROTOCOL_VERSION,
  title: 'Stage Kit Catalog',
  description: 'The A2UI basic catalog extended with the Stage Kit design system: extra props, tokens, icons and components.',
  catalogId: KIT_CATALOG_ID,
  instructions: INSTRUCTIONS,
  components: KIT_COMPONENTS,
  functions: KIT_FUNCTIONS,
  $defs: {
    anyComponent: { oneOf: Object.keys(KIT_COMPONENTS).map((name) => ({ $ref: `#/components/${name}` })), discriminator: { propertyName: 'component' } },
    anyFunction: { oneOf: Object.keys(KIT_FUNCTIONS).map((name) => ({ $ref: `#/functions/${name}` })) },
  },
};

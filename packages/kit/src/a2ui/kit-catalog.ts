import { CENTRAL_ICON_NAMES } from '../central-icons.names.data';
import { BADGE_COLORS, BADGE_SIZES, BADGE_VARIANTS } from '../badge';
import { BRAND_ICON_NAMES } from '../brand-icons.data';
import { BUTTON_COLORS, BUTTON_FILLS, SIZES } from '../button.styles';
import { CHART_COLORS, CHART_CURVE_TYPES, CHART_LIMITS } from '../chart';
import { HERO_ICON_DATA as HERO_ICON_PATHS } from '../heroicons.data';
import { A2UI_ICON_NAMES } from '../icons.a2ui';
import { BOX_RADIUS_SCALE, COLOR_TOKENS, FONT_SIZE } from '../tokens';
import { A2UI_PROTOCOL_VERSION, BASIC_CATALOG_ID, entriesOf, isJsonObject, type JsonObject, type JsonValue } from './protocol';
import { KIT_INSTRUCTIONS as INSTRUCTIONS } from './kit-catalog.instructions';
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
const RADIUS: JsonObject = dynamic('A Kit corner radius token, or a radius in density-independent pixels.', { anyOf: [{ type: 'string', enum: Object.keys(BOX_RADIUS_SCALE) }, NON_NEGATIVE] });
const FONT_SIZES = token(Object.keys(FONT_SIZE), 'A Kit font size token.');
const ICON_NAME: JsonObject = {
  description: 'An icon: a basic catalog name, a Kit HeroIcon name, a Central icon name (its Central name without the Icon prefix, such as settingsGear1 or chevronRightSmall) or a brand icon name.',
  oneOf: [
    strings([...new Set([...A2UI_ICON_NAMES, ...Object.keys(HERO_ICON_PATHS), ...CENTRAL_ICON_NAMES, ...BRAND_ICON_NAMES])], 'Icon name.'),
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
  action: { ...common('Action'), description: 'Makes the whole Row or Column pressable, with hover and pressed feedback and a button role: a clickable card, nav item or list row that keeps the look you give it. Give it an accessibility.label.' },
  feedback: token(['opacity', 'highlight', 'none'], 'How a Row or Column with an action reacts to hover and press: opacity fades it (the default), highlight tints its background, none shows nothing.'),
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
    fontFamily: token(['sans', 'head', 'mono'], 'The Kit font family: head is the heading face used by Title.'),
    letterSpacing: dynamic('Extra space between letters in density-independent pixels, for example 1 for small uppercase titles.', { type: 'number', minimum: -2, maximum: 10 }),
    textTransform: token(['none', 'uppercase', 'lowercase', 'capitalize'], 'Change the case of the text when it is drawn.'),
  }),
  Image: inherit('Image', { radius: RADIUS, size: SPACING, width: SPACING, height: SPACING, aspectRatio: ASPECT_RATIO, background: COLOR }),
  Icon: ICON,
  Video: inherit('Video'),
  AudioPlayer: inherit('AudioPlayer'),
  Row: inherit('Row', LAYOUT_EXTRAS),
  Column: inherit('Column', LAYOUT_EXTRAS),
  List: inherit('List', {
    gap: SPACING,
    padding: PADDING,
    sortable: { ...BOOLEAN, description: 'Let the user drag the items of a templated list to reorder them, or into another sortable list of the same group.' },
    group: { type: 'string', description: 'Sortable lists with the same group exchange items.' },
    listId: { ...common('DynamicString'), description: 'Identifies this list in the move details, for example the column id.' },
    handle: { ...common('ComponentId'), description: 'The id of a component inside the item template that starts drags (a grip icon, a header). Without it the whole item drags.' },
    indicator: { ...token(['preview', 'line'], 'How a sortable list shows where a dragged item lands: preview shows the item dimmed at its new place, line draws a line there.'), default: 'preview' },
    itemKey: { type: 'string', description: 'The item field holding its stable id. Defaults to id.' },
    move: { ...common('DataBinding'), description: 'Where the renderer writes the last move: itemId, fromListId, toListId, fromIndex, toIndex, beforeId, afterId.' },
    action: common('Action'),
  }),
  Card: inherit('Card', { size: token(['sm', 'md', 'lg'], 'Card padding size.'), padding: SPACING, surface: SURFACE, background: COLOR }),
  Tabs: inherit('Tabs', { variant: token(['segmented', 'underline'], 'The tab bar style.') }),
  Modal: inherit('Modal', { title: common('DynamicString'), side: token(['center', 'bottom', 'end'], 'Where the dialog opens: centred (default), as a bottom sheet, or as a full-height side sheet at the end edge, about 640px wide, which becomes a bottom sheet on narrow screens.'), open: { ...BOOLEAN, description: 'Whether the dialog shows. Bind it to a path to open or close the dialog from the data model: the renderer writes true when the trigger is pressed and false when the dialog closes.' } }),
  Divider: inherit('Divider', { spacing: SPACING, color: COLOR }),
  Button: BUTTON,
  TextField: inherit('TextField', {
    appearance: token(['soft', 'outline', 'plain'], 'The input surface style.'),
    hint: common('DynamicString'),
    hideLabel: { ...BOOLEAN, description: 'Keep the compact field: the label is read by screen readers only.' },
    pill: { ...BOOLEAN, description: 'Fully rounded corners.' },
    action: { ...common('Action'), description: 'Runs when the user presses Enter in a single-line field, like a Button press: a submit, never on typing.' },
  }),
  CheckBox: inherit('CheckBox', {
    displayStyle: token(['checkbox', 'switch'], 'Render as a checkbox (default) or a toggle switch.'),
    action: { ...common('Action'), description: 'Runs each time the user toggles it, after the new value is written to the bound path, so the event context can read it.' },
  }),
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
  DropdownMenu: component('DropdownMenu', {
    trigger: common('ComponentId'),
    items: {
      type: 'array',
      description: 'The menu rows. Choosing one closes the menu and runs its action, evaluated in the scope of the menu, so templated menus read their row with relative paths.',
      items: {
        type: 'object',
        properties: { label: common('DynamicString'), icon: ICON_NAME, swatch: COLOR, selected: BOOLEAN, danger: BOOLEAN, action: common('Action') },
        required: ['label', 'action'],
        additionalProperties: false,
      },
    },
    align: token(['start', 'end'], 'Which edge of the trigger the menu lines up with.'),
  }, ['trigger', 'items'], 'A menu that opens below its trigger, for row actions such as Rename and Delete.'),
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
  equals: {
    type: 'object',
    description: 'Checks that two values are equal (strings, numbers, booleans, or lists and objects compared as JSON). Use it in checks, for example a Save button that stays disabled until a field differs from its saved value: wrap it in not.',
    returnType: 'boolean',
    allowedCallers: 'rendererOrAgent',
    requiresUserActivation: false,
    properties: {
      '@call': { const: 'equals' },
      args: {
        type: 'object',
        properties: { value: common('DynamicValue'), other: common('DynamicValue') },
        required: ['value', 'other'],
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

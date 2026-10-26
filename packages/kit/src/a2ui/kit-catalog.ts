import { BADGE_COLORS, BADGE_SIZES, BADGE_VARIANTS } from '../badge';
import { BRAND_ICON_NAMES } from '../brand-icons.data';
import { BUTTON_COLORS, BUTTON_FILLS, SIZES } from '../button.styles';
import { HERO_ICON_DATA as HERO_ICON_PATHS } from '../heroicons.data';
import { A2UI_ICON_NAMES } from '../icons.a2ui';
import { BOX_RADIUS_SCALE, COLOR_TOKENS, FONT_SIZE } from '../tokens';
import { A2UI_PROTOCOL_VERSION, BASIC_CATALOG_ID, entriesOf, isJsonObject, type JsonObject, type JsonValue } from './protocol';
import { BASIC_CATALOG } from './schemas';
import { KIT_CATALOG_INSTRUCTIONS } from './kit-catalog.instructions';
import { KIT_EXTRA_FUNCTIONS } from './functions.kit';

export const KIT_CATALOG_ID = 'https://kit.stage.box/a2ui/v1_0/catalog.json';

const common = (name: string): JsonObject => ({ $ref: `common_types.json#/$defs/${name}` });
const basic = (pointer: string): JsonObject => ({ $ref: `${BASIC_CATALOG_ID}#${pointer}` });
const strings = (values: readonly string[], description: string): JsonObject => ({ type: 'string', enum: [...values], description });

const COLOR: JsonObject = {
  description: `A Kit colour token (${COLOR_TOKENS.join(', ')}) or a #rrggbb hex colour.`,
  anyOf: [{ type: 'string', enum: [...COLOR_TOKENS] }, { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' }],
};
const SPACING: JsonObject = { type: 'number', minimum: 0, description: 'Spacing in density-independent pixels.' };
const RADIUS: JsonObject = strings(Object.keys(BOX_RADIUS_SCALE), 'A Kit corner radius token.');
const FONT_SIZES = strings(Object.keys(FONT_SIZE), 'A Kit font size token.');
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
  padding: SPACING,
  wrap: { type: 'boolean', description: 'Wrap children onto new lines.' },
  surface: strings(['none', 'surface', 'raised', 'sunken', 'toolbar'], 'A Kit surface background.'),
  background: COLOR,
  radius: RADIUS,
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
          ...strings(['default', 'primary', 'borderless', ...BUTTON_FILLS], 'default, primary and borderless are the basic catalog hints; solid, soft, outline and ghost pick a Kit fill used with color.'),
          default: 'default',
        },
        color: strings(BUTTON_COLORS, 'The Kit button colour.'),
        size: strings(Object.keys(SIZES), 'The Kit button size.'),
        pill: { type: 'boolean' },
        block: { type: 'boolean', description: 'Stretch to the full width.' },
        uniform: { type: 'boolean', description: 'Square button sized for a single icon.' },
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
    size: { type: 'number', minimum: 1, description: 'Icon size in pixels. Defaults to 24.' },
    color: COLOR,
    variant: strings(['outline', 'solid'], 'Outline (default) or solid HeroIcon.'),
    weight: basic('/components/Icon/properties/weight'),
  },
  required: ['component', 'name'],
};

const KIT_COMPONENTS: Record<string, JsonObject> = {
  Text: inherit('Text', {
    size: FONT_SIZES,
    fontWeight: strings(['normal', 'medium', 'semibold', 'bold'], 'The font weight.'),
    color: COLOR,
    textAlign: strings(['start', 'center', 'end'], 'Horizontal alignment.'),
    italic: { type: 'boolean' },
    lineThrough: { type: 'boolean' },
    truncate: { type: 'boolean', description: 'Clamp to one line.' },
    maxLines: { type: 'integer', minimum: 1 },
    fontFamily: strings(['sans', 'mono'], 'The Kit font family.'),
  }),
  Image: inherit('Image', { radius: RADIUS, size: SPACING, width: SPACING, height: SPACING, aspectRatio: { type: 'number', minimum: 0 }, background: COLOR }),
  Icon: ICON,
  Video: inherit('Video'),
  AudioPlayer: inherit('AudioPlayer'),
  Row: inherit('Row', LAYOUT_EXTRAS),
  Column: inherit('Column', LAYOUT_EXTRAS),
  List: inherit('List', { gap: SPACING }),
  Card: inherit('Card', { size: strings(['sm', 'md', 'lg'], 'Card padding size.'), padding: SPACING }),
  Tabs: inherit('Tabs', { variant: strings(['segmented', 'underline'], 'The tab bar style.') }),
  Modal: inherit('Modal', { title: common('DynamicString') }),
  Divider: inherit('Divider', { spacing: SPACING, color: COLOR }),
  Button: BUTTON,
  TextField: inherit('TextField', { appearance: strings(['soft', 'outline', 'plain'], 'The input surface style.'), hint: common('DynamicString') }),
  CheckBox: inherit('CheckBox', { displayStyle: strings(['checkbox', 'switch'], 'Render as a checkbox (default) or a toggle switch.') }),
  ChoicePicker: inherit('ChoicePicker'),
  Slider: inherit('Slider'),
  DateTimeInput: inherit('DateTimeInput', { placeholder: common('DynamicString') }),
  Title: component('Title', {
    text: common('DynamicString'),
    level: { type: 'integer', enum: [1, 2, 3], description: 'Heading level, 1 is largest.' },
    size: strings(['sm', 'md', 'lg'], 'Heading size.'),
    color: COLOR,
  }, ['text'], 'A heading in the Kit head font.'),
  Badge: component('Badge', {
    label: common('DynamicString'),
    color: strings(BADGE_COLORS, 'The badge colour.'),
    variant: strings(BADGE_VARIANTS, 'The badge fill.'),
    size: strings(BADGE_SIZES, 'The badge size.'),
    pill: { type: 'boolean' },
  }, ['label'], 'A small status label.'),
  ListView: component('ListView', {
    children: common('ChildList'),
    limit: { type: 'integer', minimum: 1, description: 'Show at most this many items.' },
    status: common('DynamicString'),
  }, ['children'], 'A list of ListViewItem rows separated by inset dividers.'),
  ListViewItem: component('ListViewItem', {
    children: common('ChildList'),
    action: common('Action'),
    gap: SPACING,
    align: strings(['start', 'center', 'end'], 'Cross-axis alignment of the row.'),
  }, ['children'], 'A pressable row inside a ListView.'),
  Spinner: component('Spinner', { size: SPACING, color: COLOR }, [], 'An indeterminate progress indicator.'),
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

function kitFunctions(): Record<string, JsonObject> {
  const source = isJsonObject(BASIC_CATALOG.functions) ? BASIC_CATALOG.functions : {};
  return { ...Object.fromEntries(entriesOf(source).map(([name, def]) => [name, inheritedFunction(name, def)])), ...KIT_EXTRA_FUNCTIONS };
}

function buildKitCatalog(): JsonObject {
  const functions = kitFunctions();
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: KIT_CATALOG_ID,
    protocolVersion: A2UI_PROTOCOL_VERSION,
    title: 'Stage Kit Catalog',
    description: 'The A2UI basic catalog extended with the Stage Kit design system: extra props, tokens, icons and components.',
    catalogId: KIT_CATALOG_ID,
    instructions: KIT_CATALOG_INSTRUCTIONS,
    components: KIT_COMPONENTS,
    functions,
    $defs: {
      anyComponent: { oneOf: Object.keys(KIT_COMPONENTS).map((name) => ({ $ref: `#/components/${name}` })), discriminator: { propertyName: 'component' } },
      anyFunction: { oneOf: Object.keys(functions).map((name) => ({ $ref: `#/functions/${name}` })) },
    },
  };
}

export const KIT_CATALOG: JsonObject = buildKitCatalog();

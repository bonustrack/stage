import { BADGE_COLORS, BADGE_SIZES, BADGE_VARIANTS } from '../badge';
import {
  CARD_SIZES,
  CHECK_BOX_DISPLAY_STYLES,
  LIST_INDICATORS,
  LIST_VIEW_ITEM_ALIGNS,
  MENU_ALIGNS,
  MENU_OPEN_ON,
  MODAL_SIDES,
  TABS_VARIANTS,
  TEXT_ALIGNS,
  TEXT_FIELD_APPEARANCES,
  TEXT_FONT_FAMILIES,
  TEXT_TRANSFORMS,
  TEXT_WEIGHTS,
  TITLE_LEVELS,
  TITLE_SIZES,
} from '../kit-vocabulary';
import { A2UI_PROTOCOL_VERSION, type JsonObject } from './protocol';
import { KIT_INSTRUCTIONS as INSTRUCTIONS } from './kit-catalog.instructions';
import { KIT_FUNCTIONS } from './kit-catalog.functions';
import { asNumber } from './kit-catalog.coerce';
import {
  ASPECT_RATIO,
  BOOLEAN,
  BUTTON,
  BUTTON_PROPS,
  CHART,
  CHART_PROPS,
  COLOR,
  FONT_SIZES,
  ICON,
  ICON_NAME,
  ICON_PROPS,
  LAYOUT_EXTRAS,
  MAX_LINES,
  OPACITY,
  PADDING,
  RADIUS,
  SPACING,
  SURFACE,
  common,
  component,
  described,
  dynamic,
  inherit,
  number,
  prop,
  schemaOf,
  token,
  withDefault,
} from './kit-catalog.props';

export const KIT_CATALOG_ID = 'https://kit.stage.box/a2ui/v1_0/catalog.json';

const TEXT_PROPS = {
  opacity: OPACITY,
  selectable: described(BOOLEAN, 'Let the user select and copy the text.'),
  size: FONT_SIZES,
  fontWeight: token(TEXT_WEIGHTS, 'The font weight.'),
  color: COLOR,
  textAlign: token(TEXT_ALIGNS, 'Horizontal alignment.'),
  italic: BOOLEAN,
  lineThrough: BOOLEAN,
  truncate: BOOLEAN,
  maxLines: MAX_LINES,
  fontFamily: token(TEXT_FONT_FAMILIES, 'The Kit font family: head is the heading face used by Title.'),
  letterSpacing: number('Extra space between letters in density-independent pixels, for example 1 for small uppercase titles.', {
    type: 'number',
    minimum: -2,
    maximum: 10,
  }),
  textTransform: token(TEXT_TRANSFORMS, 'Change the case of the text when it is drawn.'),
};

const IMAGE_PROPS = {
  radius: RADIUS,
  size: SPACING,
  width: SPACING,
  height: SPACING,
  aspectRatio: ASPECT_RATIO,
  background: COLOR,
  opacity: OPACITY,
};

const LIST_PROPS = {
  gap: SPACING,
  padding: PADDING,
  sortable: described(
    BOOLEAN,
    'Let the user drag the items of a templated list to reorder them, or into another sortable list of the same group.',
  ),
  group: { type: 'string', description: 'Sortable lists with the same group exchange items.' },
  listId: { ...common('DynamicString'), description: 'Identifies this list in the move details, for example the column id.' },
  handle: {
    ...common('ComponentId'),
    description:
      'The id of a component inside the item template that starts drags (a grip icon, a header). Without it the whole item drags.',
  },
  indicator: withDefault(
    token(
      LIST_INDICATORS,
      'How a sortable list shows where a dragged item lands: preview shows the item dimmed at its new place, line draws a line there.',
    ),
    'preview',
  ),
  itemKey: { type: 'string', description: 'The item field holding its stable id. Defaults to id.' },
  move: {
    ...common('DataBinding'),
    description: 'Where the renderer writes the last move: itemId, fromListId, toListId, fromIndex, toIndex, beforeId, afterId.',
  },
  action: common('Action'),
};

const CARD_PROPS = { size: token(CARD_SIZES, 'Card padding size.'), padding: SPACING, surface: SURFACE, background: COLOR };

const TABS_PROPS = { variant: token(TABS_VARIANTS, 'The tab bar style.') };

const MODAL_PROPS = {
  title: common('DynamicString'),
  side: token(
    MODAL_SIDES,
    'Where the dialog opens: centred (default), as a bottom sheet, or as a full-height side sheet at the end edge, about 640px wide, which becomes a bottom sheet on narrow screens.',
  ),
  open: described(
    BOOLEAN,
    'Whether the dialog shows. Bind it to a path to open or close the dialog from the data model: the renderer writes true when the trigger is pressed and false when the dialog closes.',
  ),
};

const DIVIDER_PROPS = { spacing: SPACING, color: COLOR };

const TEXT_FIELD_PROPS = {
  appearance: token(TEXT_FIELD_APPEARANCES, 'The input surface style.'),
  hint: common('DynamicString'),
  hideLabel: described(BOOLEAN, 'Keep the compact field: the label is read by screen readers only.'),
  pill: described(BOOLEAN, 'Fully rounded corners.'),
  action: {
    ...common('Action'),
    description: 'Runs when the user presses Enter in a single-line field, like a Button press: a submit, never on typing.',
  },
};

const CHECK_BOX_PROPS = {
  displayStyle: token(CHECK_BOX_DISPLAY_STYLES, 'Render as a checkbox (default) or a toggle switch.'),
  action: {
    ...common('Action'),
    description: 'Runs each time the user toggles it, after the new value is written to the bound path, so the event context can read it.',
  },
};

const DATE_TIME_INPUT_PROPS = { placeholder: common('DynamicString') };

const TITLE_PROPS = {
  text: common('DynamicString'),
  level: prop(dynamic('Heading level, 1 is largest.', { type: 'integer', enum: [...TITLE_LEVELS] }), (value) => {
    const level = asNumber(value);
    return TITLE_LEVELS.find((candidate) => candidate === level);
  }),
  maxLines: MAX_LINES,
  size: token(TITLE_SIZES, 'Heading size.'),
  color: COLOR,
};

const BADGE_PROPS = {
  label: common('DynamicString'),
  color: token(BADGE_COLORS, 'The badge colour.'),
  variant: token(BADGE_VARIANTS, 'The badge fill.'),
  size: token(BADGE_SIZES, 'The badge size.'),
  pill: BOOLEAN,
};

const LIST_VIEW_PROPS = {
  children: common('ChildList'),
  limit: number('Show at most this many items.', { type: 'integer', minimum: 1 }),
  status: common('DynamicString'),
};

const LIST_VIEW_ITEM_PROPS = {
  children: common('ChildList'),
  action: common('Action'),
  gap: SPACING,
  align: token(LIST_VIEW_ITEM_ALIGNS, 'Cross-axis alignment of the row.'),
};

const DROPDOWN_MENU_PROPS = {
  trigger: common('ComponentId'),
  items: {
    type: 'array',
    description:
      'The menu rows. Choosing one closes the menu and runs its action, evaluated in the scope of the menu, so templated menus read their row with relative paths.',
    items: {
      type: 'object',
      properties: {
        label: common('DynamicString'),
        icon: ICON_NAME,
        swatch: schemaOf(COLOR),
        selected: schemaOf(BOOLEAN),
        danger: schemaOf(BOOLEAN),
        action: common('Action'),
      },
      required: ['label', 'action'],
      additionalProperties: false,
    },
  },
  align: token(MENU_ALIGNS, 'Which edge of the trigger the menu lines up with.'),
  openOn: token(
    MENU_OPEN_ON,
    'press (default) opens the menu when the trigger is tapped; contextMenu opens it at the pointer on a right click, or on a long press on touch, and leaves taps to the trigger itself (a nav row that navigates on tap).',
  ),
};

const SPINNER_PROPS = { size: SPACING, color: COLOR };

const QR_CODE_PROPS = { value: common('DynamicString'), size: SPACING };

export const KIT_PROPS = {
  Text: TEXT_PROPS,
  Image: IMAGE_PROPS,
  Icon: ICON_PROPS,
  Row: LAYOUT_EXTRAS,
  Column: LAYOUT_EXTRAS,
  List: LIST_PROPS,
  Card: CARD_PROPS,
  Tabs: TABS_PROPS,
  Modal: MODAL_PROPS,
  Divider: DIVIDER_PROPS,
  Button: BUTTON_PROPS,
  TextField: TEXT_FIELD_PROPS,
  CheckBox: CHECK_BOX_PROPS,
  DateTimeInput: DATE_TIME_INPUT_PROPS,
  Title: TITLE_PROPS,
  Badge: BADGE_PROPS,
  ListView: LIST_VIEW_PROPS,
  ListViewItem: LIST_VIEW_ITEM_PROPS,
  DropdownMenu: DROPDOWN_MENU_PROPS,
  Spinner: SPINNER_PROPS,
  Chart: CHART_PROPS,
  QrCode: QR_CODE_PROPS,
};

const KIT_COMPONENTS: Record<string, JsonObject> = {
  Text: inherit('Text', TEXT_PROPS),
  Image: inherit('Image', IMAGE_PROPS),
  Icon: ICON,
  Video: inherit('Video'),
  AudioPlayer: inherit('AudioPlayer'),
  Row: inherit('Row', LAYOUT_EXTRAS),
  Column: inherit('Column', LAYOUT_EXTRAS),
  List: inherit('List', LIST_PROPS),
  Card: inherit('Card', CARD_PROPS),
  Tabs: inherit('Tabs', TABS_PROPS),
  Modal: inherit('Modal', MODAL_PROPS),
  Divider: inherit('Divider', DIVIDER_PROPS),
  Button: BUTTON,
  TextField: inherit('TextField', TEXT_FIELD_PROPS),
  CheckBox: inherit('CheckBox', CHECK_BOX_PROPS),
  ChoicePicker: inherit('ChoicePicker'),
  Slider: inherit('Slider'),
  DateTimeInput: inherit('DateTimeInput', DATE_TIME_INPUT_PROPS),
  Title: component('Title', TITLE_PROPS, ['text'], 'A heading in the Kit head font.'),
  Badge: component('Badge', BADGE_PROPS, ['label'], 'A small status label.'),
  ListView: component('ListView', LIST_VIEW_PROPS, ['children'], 'A list of ListViewItem rows separated by inset dividers.'),
  ListViewItem: component('ListViewItem', LIST_VIEW_ITEM_PROPS, ['children'], 'A pressable row inside a ListView.'),
  DropdownMenu: component(
    'DropdownMenu',
    DROPDOWN_MENU_PROPS,
    ['trigger', 'items'],
    'A menu that opens below its trigger, for row actions such as Rename and Delete.',
  ),
  Spinner: component('Spinner', SPINNER_PROPS, [], 'An indeterminate progress indicator.'),
  Chart: CHART,
  QrCode: component('QrCode', QR_CODE_PROPS, ['value'], 'A QR code for a string such as a payment link.'),
};

export interface CatalogDocument {
  id: string;
  title: string;
  description: string;
  instructions: string;
  components: JsonObject;
  functions: JsonObject;
}

export function catalogDocument({ id, title, description, instructions, components, functions }: CatalogDocument): JsonObject {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: id,
    protocolVersion: A2UI_PROTOCOL_VERSION,
    title,
    description,
    catalogId: id,
    instructions,
    components,
    functions,
    $defs: {
      anyComponent: {
        oneOf: Object.keys(components).map((name) => ({ $ref: `#/components/${name}` })),
        discriminator: { propertyName: 'component' },
      },
      anyFunction: { oneOf: Object.keys(functions).map((name) => ({ $ref: `#/functions/${name}` })) },
    },
  };
}

export const KIT_CATALOG: JsonObject = catalogDocument({
  id: KIT_CATALOG_ID,
  title: 'Stage Kit Catalog',
  description: 'The A2UI basic catalog extended with the Stage Kit design system: extra props, tokens, icons and components.',
  instructions: INSTRUCTIONS,
  components: KIT_COMPONENTS,
  functions: KIT_FUNCTIONS,
});

import { BADGE_COLORS, BADGE_SIZES, BADGE_VARIANTS } from '../badge';
import { A2UI_PROTOCOL_VERSION, type JsonObject } from './protocol';
import { KIT_INSTRUCTIONS as INSTRUCTIONS } from './kit-catalog.instructions';
import { KIT_FUNCTIONS } from './kit-catalog.functions';
import {
  ASPECT_RATIO,
  BOOLEAN,
  BUTTON,
  CHART,
  COLOR,
  FONT_SIZES,
  ICON,
  ICON_NAME,
  LAYOUT_EXTRAS,
  MAX_LINES,
  OPACITY,
  PADDING,
  RADIUS,
  SPACING,
  SURFACE,
  common,
  component,
  dynamic,
  inherit,
  token,
} from './kit-catalog.props';

export const KIT_CATALOG_ID = 'https://kit.stage.box/a2ui/v1_0/catalog.json';

const KIT_COMPONENTS: Record<string, JsonObject> = {
  Text: inherit('Text', {
    opacity: OPACITY,
    selectable: { ...BOOLEAN, description: 'Let the user select and copy the text.' },
    size: FONT_SIZES,
    fontWeight: token(['normal', 'medium', 'semibold', 'bold'], 'The font weight.'),
    color: COLOR,
    textAlign: token(['start', 'center', 'end'], 'Horizontal alignment.'),
    italic: BOOLEAN,
    lineThrough: BOOLEAN,
    truncate: BOOLEAN,
    maxLines: MAX_LINES,
    fontFamily: token(['sans', 'head', 'mono'], 'The Kit font family: head is the heading face used by Title.'),
    letterSpacing: dynamic('Extra space between letters in density-independent pixels, for example 1 for small uppercase titles.', {
      type: 'number',
      minimum: -2,
      maximum: 10,
    }),
    textTransform: token(['none', 'uppercase', 'lowercase', 'capitalize'], 'Change the case of the text when it is drawn.'),
  }),
  Image: inherit('Image', {
    radius: RADIUS,
    size: SPACING,
    width: SPACING,
    height: SPACING,
    aspectRatio: ASPECT_RATIO,
    background: COLOR,
    opacity: OPACITY,
  }),
  Icon: ICON,
  Video: inherit('Video'),
  AudioPlayer: inherit('AudioPlayer'),
  Row: inherit('Row', LAYOUT_EXTRAS),
  Column: inherit('Column', LAYOUT_EXTRAS),
  List: inherit('List', {
    gap: SPACING,
    padding: PADDING,
    sortable: {
      ...BOOLEAN,
      description: 'Let the user drag the items of a templated list to reorder them, or into another sortable list of the same group.',
    },
    group: { type: 'string', description: 'Sortable lists with the same group exchange items.' },
    listId: { ...common('DynamicString'), description: 'Identifies this list in the move details, for example the column id.' },
    handle: {
      ...common('ComponentId'),
      description:
        'The id of a component inside the item template that starts drags (a grip icon, a header). Without it the whole item drags.',
    },
    indicator: {
      ...token(
        ['preview', 'line'],
        'How a sortable list shows where a dragged item lands: preview shows the item dimmed at its new place, line draws a line there.',
      ),
      default: 'preview',
    },
    itemKey: { type: 'string', description: 'The item field holding its stable id. Defaults to id.' },
    move: {
      ...common('DataBinding'),
      description: 'Where the renderer writes the last move: itemId, fromListId, toListId, fromIndex, toIndex, beforeId, afterId.',
    },
    action: common('Action'),
  }),
  Card: inherit('Card', { size: token(['sm', 'md', 'lg'], 'Card padding size.'), padding: SPACING, surface: SURFACE, background: COLOR }),
  Tabs: inherit('Tabs', { variant: token(['segmented', 'underline'], 'The tab bar style.') }),
  Modal: inherit('Modal', {
    title: common('DynamicString'),
    side: token(
      ['center', 'bottom', 'end'],
      'Where the dialog opens: centred (default), as a bottom sheet, or as a full-height side sheet at the end edge, about 640px wide, which becomes a bottom sheet on narrow screens.',
    ),
    open: {
      ...BOOLEAN,
      description:
        'Whether the dialog shows. Bind it to a path to open or close the dialog from the data model: the renderer writes true when the trigger is pressed and false when the dialog closes.',
    },
  }),
  Divider: inherit('Divider', { spacing: SPACING, color: COLOR }),
  Button: BUTTON,
  TextField: inherit('TextField', {
    appearance: token(['soft', 'outline', 'plain'], 'The input surface style.'),
    hint: common('DynamicString'),
    hideLabel: { ...BOOLEAN, description: 'Keep the compact field: the label is read by screen readers only.' },
    pill: { ...BOOLEAN, description: 'Fully rounded corners.' },
    action: {
      ...common('Action'),
      description: 'Runs when the user presses Enter in a single-line field, like a Button press: a submit, never on typing.',
    },
  }),
  CheckBox: inherit('CheckBox', {
    displayStyle: token(['checkbox', 'switch'], 'Render as a checkbox (default) or a toggle switch.'),
    action: {
      ...common('Action'),
      description:
        'Runs each time the user toggles it, after the new value is written to the bound path, so the event context can read it.',
    },
  }),
  ChoicePicker: inherit('ChoicePicker'),
  Slider: inherit('Slider'),
  DateTimeInput: inherit('DateTimeInput', { placeholder: common('DynamicString') }),
  Title: component(
    'Title',
    {
      text: common('DynamicString'),
      level: dynamic('Heading level, 1 is largest.', { type: 'integer', enum: [1, 2, 3] }),
      maxLines: MAX_LINES,
      size: token(['sm', 'md', 'lg'], 'Heading size.'),
      color: COLOR,
    },
    ['text'],
    'A heading in the Kit head font.',
  ),
  Badge: component(
    'Badge',
    {
      label: common('DynamicString'),
      color: token(BADGE_COLORS, 'The badge colour.'),
      variant: token(BADGE_VARIANTS, 'The badge fill.'),
      size: token(BADGE_SIZES, 'The badge size.'),
      pill: BOOLEAN,
    },
    ['label'],
    'A small status label.',
  ),
  ListView: component(
    'ListView',
    {
      children: common('ChildList'),
      limit: dynamic('Show at most this many items.', { type: 'integer', minimum: 1 }),
      status: common('DynamicString'),
    },
    ['children'],
    'A list of ListViewItem rows separated by inset dividers.',
  ),
  ListViewItem: component(
    'ListViewItem',
    {
      children: common('ChildList'),
      action: common('Action'),
      gap: SPACING,
      align: token(['start', 'center', 'end'], 'Cross-axis alignment of the row.'),
    },
    ['children'],
    'A pressable row inside a ListView.',
  ),
  DropdownMenu: component(
    'DropdownMenu',
    {
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
            swatch: COLOR,
            selected: BOOLEAN,
            danger: BOOLEAN,
            action: common('Action'),
          },
          required: ['label', 'action'],
          additionalProperties: false,
        },
      },
      align: token(['start', 'end'], 'Which edge of the trigger the menu lines up with.'),
      openOn: token(
        ['press', 'contextMenu'],
        'press (default) opens the menu when the trigger is tapped; contextMenu opens it at the pointer on a right click, or on a long press on touch, and leaves taps to the trigger itself (a nav row that navigates on tap).',
      ),
    },
    ['trigger', 'items'],
    'A menu that opens below its trigger, for row actions such as Rename and Delete.',
  ),
  Spinner: component('Spinner', { size: SPACING, color: COLOR }, [], 'An indeterminate progress indicator.'),
  Chart: CHART,
  QrCode: component(
    'QrCode',
    { value: common('DynamicString'), size: SPACING },
    ['value'],
    'A QR code for a string such as a payment link.',
  ),
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
    anyComponent: {
      oneOf: Object.keys(KIT_COMPONENTS).map((name) => ({ $ref: `#/components/${name}` })),
      discriminator: { propertyName: 'component' },
    },
    anyFunction: { oneOf: Object.keys(KIT_FUNCTIONS).map((name) => ({ $ref: `#/functions/${name}` })) },
  },
};

import { BASIC_CATALOG_ID } from '../src/a2ui/protocol';
import { KIT_CATALOG_ID } from '../src/a2ui/kit-catalog';
import type { JsonObject } from '../src/a2ui/protocol';

const v = 'v1.0';

export const PAYMENT_REQUEST: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'payment_request',
      catalogId: KIT_CATALOG_ID,
      sendDataModel: true,
      dataModel: {
        merchant: 'Coffee Lab',
        amount: 4.5,
        tip: 10,
        note: '',
        split: false,
        method: ['wallet'],
        items: [{ name: 'Flat white', price: 3.9 }, { name: 'Croissant', price: 0.6 }],
      },
      components: [
        { id: 'root', component: 'Card', child: 'body' },
        { id: 'body', component: 'Column', gap: 14, children: ['header', 'lines', 'divider', 'tip', 'method', 'note', 'split', 'actions'] },
        { id: 'header', component: 'Row', align: 'center', justify: 'spaceBetween', children: ['heading', 'status'] },
        { id: 'heading', component: 'Row', align: 'center', gap: 8, children: ['heading_icon', 'heading_title'] },
        { id: 'heading_icon', component: 'Icon', name: 'wallet', size: 22 },
        { id: 'heading_title', component: 'Title', level: 3, text: { '@path': '/merchant' } },
        { id: 'status', component: 'Badge', label: 'Pending', color: 'warning', variant: 'soft', pill: true },
        { id: 'lines', component: 'List', gap: 6, children: { componentId: 'line', path: '/items' } },
        { id: 'line', component: 'Row', justify: 'spaceBetween', children: ['line_name', 'line_price'] },
        { id: 'line_name', component: 'Text', text: { '@call': 'formatString', args: { value: '${name} x${@index(offset: 1)}' } } },
        { id: 'line_price', component: 'Text', color: 'secondary', text: { '@call': 'formatCurrency', args: { value: { '@path': 'price' }, currency: 'USD' } } },
        { id: 'divider', component: 'Divider' },
        { id: 'tip', component: 'Slider', label: 'Tip (%)', min: 0, max: 25, steps: 5, value: { '@path': '/tip' } },
        { id: 'method', component: 'ChoicePicker', label: 'Pay with', displayStyle: 'chips', options: [{ label: 'Stage wallet', value: 'wallet' }, { label: 'Card', value: 'card' }], value: { '@path': '/method' } },
        { id: 'note', component: 'TextField', label: 'Note', placeholder: 'Optional', value: { '@path': '/note' }, checks: [{ condition: { '@call': 'length', args: { value: { '@path': '/note' }, max: 40 } }, message: 'Keep it under 40 characters.' }] },
        { id: 'split', component: 'CheckBox', label: 'Split with the group', displayStyle: 'switch', value: { '@path': '/split' } },
        { id: 'actions', component: 'Row', gap: 8, justify: 'end', children: ['decline', 'pay'] },
        { id: 'decline_label', component: 'Text', text: 'Decline' },
        { id: 'decline', component: 'Button', variant: 'soft', color: 'secondary', child: 'decline_label', action: { event: { name: 'decline' } } },
        { id: 'pay_label', component: 'Text', text: { '@call': 'formatString', args: { value: 'Pay ${formatCurrency(value: ${/amount}, currency: \'USD\')}' } } },
        {
          id: 'pay', component: 'Button', variant: 'primary', iconStart: 'check', child: 'pay_label',
          checks: [{ condition: { '@call': 'required', args: { value: { '@path': '/method' } } }, message: 'Pick a payment method.' }],
          action: { event: { name: 'pay', userMessage: 'Paid Coffee Lab', context: { amount: { '@path': '/amount' }, tip: { '@path': '/tip' }, method: { '@path': '/method' } } } },
        },
      ],
    },
  },
];

export const BASIC_GALLERY: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'basic_gallery',
      catalogId: BASIC_CATALOG_ID,
      dataModel: { when: '2026-10-26', volume: 40, agree: false },
      components: [
        { id: 'root', component: 'Column', children: ['title', 'tabs', 'date', 'modal'] },
        { id: 'title', component: 'Text', text: '## Basic catalog\nEvery component below is a plain **A2UI v1.0** basic catalog component.' },
        { id: 'tabs', component: 'Tabs', tabs: [{ title: 'Media', child: 'media' }, { title: 'Inputs', child: 'inputs' }] },
        { id: 'media', component: 'Row', align: 'center', children: ['avatar', 'icons'] },
        { id: 'avatar', component: 'Image', variant: 'avatar', fit: 'cover', url: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000001?s=80' },
        { id: 'icons', component: 'Row', children: ['i1', 'i2', 'i3', 'i4'] },
        { id: 'i1', component: 'Icon', name: 'favorite' },
        { id: 'i2', component: 'Icon', name: 'notificationsOff' },
        { id: 'i3', component: 'Icon', name: 'shoppingCart' },
        { id: 'i4', component: 'Icon', name: 'starHalf' },
        { id: 'inputs', component: 'Column', children: ['volume', 'agree'] },
        { id: 'volume', component: 'Slider', label: 'Volume', max: 100, value: { '@path': '/volume' } },
        { id: 'agree', component: 'CheckBox', label: 'I agree', value: { '@path': '/agree' } },
        { id: 'date', component: 'DateTimeInput', label: 'When', enableDate: true, enableTime: true, value: { '@path': '/when' } },
        { id: 'modal', component: 'Modal', trigger: 'open', content: 'modal_body' },
        { id: 'open_label', component: 'Text', text: 'Open modal' },
        { id: 'open', component: 'Button', child: 'open_label', action: { event: { name: 'noop' } } },
        { id: 'modal_body', component: 'Column', children: ['modal_text', 'modal_actions'] },
        { id: 'modal_text', component: 'Text', text: { '@call': 'formatString', args: { value: 'Volume is ${/volume}, agreed: ${/agree}' } } },
        { id: 'modal_actions', component: 'Row', justify: 'end', align: 'center', children: ['cancel', 'done'] },
        { id: 'cancel_label', component: 'Text', text: 'Cancel' },
        { id: 'cancel', component: 'Button', variant: 'borderless', child: 'cancel_label', action: { event: { name: 'cancel' } } },
        { id: 'done_label', component: 'Text', text: 'Done' },
        { id: 'done', component: 'Button', variant: 'primary', child: 'done_label', action: { event: { name: 'done' } } },
      ],
    },
  },
];

export const DATA_BLOCK: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'data_block',
      catalogId: KIT_CATALOG_ID,
      dataModel: {
        filter: { owner: ['all'], query: '' },
        metric: ['sales'],
        metricLabel: { sales: 'Sales', returns: 'Returns' },
        notes: [],
        segments: [{ share: '50%', tone: 'success' }, { share: '30%', tone: '#e25507' }, { share: '20%', tone: 'danger' }],
        trend: [{ week: 'W1', sales: 12, returns: 2 }, { week: 'W2', sales: 18, returns: 3 }, { week: 'W3', sales: 9, returns: 1 }, { week: 'W4', sales: 22, returns: 4 }],
        units: [
          { name: 'Pillar A', status: 'On track', tone: 'success', share: '72%' },
          { name: 'Pillar B', status: 'At risk', tone: '#e25507', share: '41%' },
          { name: 'Pillar C', status: 'Overdue', tone: 'danger', share: '18%' },
        ],
      },
      components: [
        { id: 'root', component: 'Column', gap: 16, children: ['header', 'search', 'metric', 'chart', 'notes', 'split', 'units', 'toolbar'] },
        { id: 'search', component: 'TextField', label: 'Search projects', hideLabel: true, pill: true, placeholder: 'Search', value: { '@path': '/filter/query' }, action: { event: { name: 'search', context: { query: { '@path': '/filter/query' } } } } },
        { id: 'metric', component: 'ChoicePicker', label: 'Metric', displayStyle: 'chips', options: [{ label: 'Sales', value: 'sales' }, { label: 'Returns', value: 'returns' }], value: { '@path': '/metric' } },
        { id: 'notes', component: 'Column', gap: 8, children: { componentId: 'note', path: '/notes' } },
        { id: 'note', component: 'Text', text: { '@path': 'text' } },
        { id: 'split', component: 'Card', surface: 'surface', child: 'split_bar' },
        { id: 'split_bar', component: 'Row', gap: 4, height: 8, children: { componentId: 'segment', path: '/segments' } },
        { id: 'segment', component: 'Column', width: { '@path': 'share' }, radius: 'full', background: { '@path': 'tone' }, children: [] },
        { id: 'header', component: 'Row', padding: { x: 4, bottom: 4 }, justify: 'spaceBetween', align: 'center', children: ['title', 'delta'] },
        { id: 'title', component: 'Title', level: 3, maxLines: 1, weight: 1, text: 'Weekly activity across every project, company and owner in the portfolio' },
        { id: 'delta', component: 'Text', size: 'sm', fontWeight: 'semibold', color: { '@path': '/units/0/tone' }, text: '+18%' },
        { id: 'chart', component: 'Chart', data: { '@path': '/trend' }, xAxis: 'week', height: 160, series: [{ type: 'bar', dataKey: { '@path': '/metric/0' }, label: { '@call': 'formatString', args: { value: '${/metric/0}' } }, color: 'blue' }] },
        { id: 'units', component: 'Column', gap: 10, children: { componentId: 'unit', path: '/units' } },
        { id: 'unit', component: 'Column', gap: 6, padding: 12, radius: 'md', border: { size: 1, color: 'border' }, children: ['unit_head', 'unit_track'] },
        { id: 'unit_head', component: 'Row', gap: 8, align: 'center', children: ['unit_dot', 'unit_name', 'unit_status'] },
        { id: 'unit_dot', component: 'Column', width: 8, height: 8, radius: 'full', background: { '@path': 'tone' }, children: [] },
        { id: 'unit_name', component: 'Text', weight: 1, truncate: true, text: { '@path': 'name' } },
        { id: 'unit_status', component: 'Text', size: 'sm', color: { '@path': 'tone' }, text: { '@path': 'status' } },
        { id: 'unit_track', component: 'Row', height: 6, radius: 'full', background: 'border', children: ['unit_fill'] },
        { id: 'unit_fill', component: 'Column', width: { '@path': 'share' }, radius: 'full', background: { '@path': 'tone' }, children: [] },
        { id: 'toolbar', component: 'Row', gap: 8, align: 'end', children: ['owner', 'apply'] },
        { id: 'owner', component: 'ChoicePicker', weight: 1, label: 'Owner', displayStyle: 'chips', options: [{ label: 'All', value: 'all' }, { label: 'Ana', value: 'ana' }, { label: 'Ben', value: 'ben' }], value: { '@path': '/filter/owner' } },
        { id: 'apply_label', component: 'Text', text: 'Apply' },
        { id: 'apply', component: 'Button', variant: 'primary', child: 'apply_label', action: { event: { name: 'filter', context: { owner: { '@path': '/filter/owner' } } } } },
      ],
    },
  },
];

export const SORTABLE_LISTS: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'sortable_lists',
      catalogId: KIT_CATALOG_ID,
      dataModel: {
        lastMove: null,
        confirm: { open: false },
        lists: [
          { id: 'a', title: 'List A', items: [{ id: 'i1', title: 'First item', owner: 'Ada', avatar: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000001?s=48' }, { id: 'i2', title: 'Second item', owner: 'Grace', avatar: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000002?s=48' }] },
          { id: 'b', title: 'List B', items: [{ id: 'i3', title: 'Third item', owner: 'Linus', avatar: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000003?s=48' }] },
          { id: 'c', title: 'List C', items: [{ id: 'i4', title: 'Fourth item', owner: 'Ada', avatar: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000001?s=48' }] },
        ],
      },
      components: [
        { id: 'root', component: 'Column', gap: 12, children: ['lists', 'confirm'] },
        { id: 'lists', component: 'Row', gap: 12, align: 'start', children: { componentId: 'list', path: '/lists' } },
        { id: 'list', component: 'Column', width: 200, gap: 8, padding: 8, radius: 'md', surface: 'sunken', children: ['list_head', 'items'] },
        { id: 'list_head', component: 'Row', align: 'center', children: ['list_title', 'list_menu'] },
        { id: 'list_title', component: 'Text', weight: 1, fontWeight: 'semibold', text: { '@path': 'title' } },
        {
          id: 'list_menu', component: 'DropdownMenu', align: 'end', trigger: 'list_more', accessibility: { label: 'List menu' },
          items: [
            { label: 'Rename', icon: 'edit', action: { event: { name: 'renameList', context: { id: { '@path': 'id' } } } } },
            { label: 'Delete', icon: 'delete', danger: true, action: { event: { name: 'deleteList', context: { id: { '@path': 'id' } } } } },
          ],
        },
        { id: 'list_more', component: 'Icon', name: 'moreHoriz', size: 20 },
        { id: 'confirm', component: 'Modal', title: 'Delete a list', trigger: 'confirm_open', content: 'confirm_body', open: { '@path': '/confirm/open' } },
        { id: 'confirm_open', component: 'Button', variant: 'borderless', child: 'confirm_open_label', action: { event: { name: 'noop' } } },
        { id: 'confirm_open_label', component: 'Text', text: 'Delete a list' },
        { id: 'confirm_body', component: 'Column', gap: 12, children: ['confirm_text', 'confirm_actions'] },
        { id: 'confirm_text', component: 'Text', text: 'Its items move to List A.' },
        { id: 'confirm_actions', component: 'Row', justify: 'end', align: 'center', gap: 12, children: ['confirm_cancel', 'confirm_delete'] },
        { id: 'confirm_cancel', component: 'Button', variant: 'borderless', child: 'confirm_cancel_label', action: { event: { name: 'cancelDelete' } } },
        { id: 'confirm_cancel_label', component: 'Text', text: 'Cancel' },
        { id: 'confirm_delete', component: 'Button', variant: 'solid', color: 'danger', child: 'confirm_delete_label', action: { event: { name: 'confirmDelete' } } },
        { id: 'confirm_delete_label', component: 'Text', text: 'Delete' },
        {
          id: 'items', component: 'List', gap: 8, sortable: true, group: 'lists', listId: { '@path': 'id' },
          children: { componentId: 'item', path: 'items' }, move: { '@path': '/lastMove' },
          accessibility: { label: { '@path': 'title' } },
          action: { event: { name: 'moveItem', context: { move: { '@path': '/lastMove' } } } },
        },
        { id: 'item', component: 'Modal', title: { '@path': 'title' }, trigger: 'item_face', content: 'item_detail' },
        { id: 'item_face', component: 'Card', size: 'sm', child: 'item_row' },
        { id: 'item_row', component: 'Row', align: 'center', gap: 8, children: ['item_title', 'item_owner'] },
        { id: 'item_title', component: 'Text', weight: 1, text: { '@path': 'title' } },
        { id: 'item_owner', component: 'Image', url: { '@path': 'avatar' }, size: 24, radius: 'full', accessibility: { label: { '@path': 'owner' } } },
        { id: 'item_detail', component: 'Text', text: { '@call': 'formatString', args: { value: 'Owner: ${owner}' } } },
      ],
    },
  },
];

export const CLICKABLE_CARDS: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'clickable_cards',
      catalogId: KIT_CATALOG_ID,
      dataModel: {
        options: [
          { id: 'a', name: 'Option A', swatch: '#ffffff' },
          { id: 'b', name: 'Option B', swatch: '#111111' },
          { id: 'c', name: 'Option C', swatch: '#e8dcc4' },
        ],
      },
      components: [
        { id: 'root', component: 'Column', gap: 16, children: ['header', 'grid', 'nav', 'tools'] },
        { id: 'header', component: 'Row', gap: 8, align: 'center', children: ['header_icon', 'title', 'count'] },
        { id: 'header_icon', component: 'Icon', name: 'sparkle', size: 22 },
        { id: 'title', component: 'Title', level: 3, text: 'Options' },
        { id: 'count', component: 'Column', background: 'text', radius: 9, padding: { x: 8, y: 2 }, children: ['count_text'] },
        { id: 'count_text', component: 'Text', size: '3xs', fontWeight: 'semibold', color: 'surface', text: '3' },
        { id: 'tools', component: 'Row', gap: 12, align: 'center', children: ['color_menu', 'details'] },
        {
          id: 'color_menu', component: 'DropdownMenu', trigger: 'color_button',
          items: [
            { label: 'Orange', swatch: '#e25507', selected: true, action: { event: { name: 'setColor', context: { color: 'orange' } } } },
            { label: 'Green', swatch: '#2f9e44', action: { event: { name: 'setColor', context: { color: 'green' } } } },
            { label: 'Settings', icon: 'settingsGear1', action: { event: { name: 'openSettings' } } },
          ],
        },
        { id: 'color_button', component: 'Button', variant: 'outline', color: 'secondary', iconEnd: 'chevronDownSmall', child: 'color_label', action: { event: { name: 'noop' } } },
        { id: 'color_label', component: 'Text', text: 'Colour' },
        { id: 'details', component: 'Modal', side: 'end', title: 'Details', trigger: 'details_button', content: 'details_body' },
        { id: 'details_button', component: 'Button', variant: 'borderless', iconStart: 'sidebar', child: 'details_label', action: { event: { name: 'noop' } } },
        { id: 'details_label', component: 'Text', text: 'Details' },
        { id: 'details_body', component: 'Text', text: 'A side sheet at the end edge.' },
        { id: 'grid', component: 'Row', gap: 12, wrap: true, children: { componentId: 'option', path: '/options' } },
        {
          id: 'option', component: 'Column', width: 160, gap: 8, padding: 8, radius: 14, feedback: 'highlight', border: { size: 1, color: 'border' },
          accessibility: { label: { '@path': 'name' } }, children: ['option_swatch', 'option_name'],
          action: { event: { name: 'pickOption', context: { id: { '@path': 'id' } } } },
        },
        { id: 'option_swatch', component: 'Column', height: 96, radius: 'sm', background: { '@path': 'swatch' }, border: { size: 1, color: 'border' }, children: [] },
        { id: 'option_name', component: 'Text', fontWeight: 'semibold', text: { '@path': 'name' } },
        { id: 'nav', component: 'Row', gap: 12, wrap: true, children: { componentId: 'nav_item', path: '/options' } },
        { id: 'nav_item', component: 'Button', variant: 'borderless', child: 'nav_box', action: { event: { name: 'openOption', context: { id: { '@path': 'id' } } } } },
        { id: 'nav_box', component: 'Column', width: 120, height: 120, padding: 8, radius: 'md', surface: 'sunken', children: ['nav_name'] },
        { id: 'nav_name', component: 'Text', text: { '@path': 'name' } },
      ],
    },
  },
];

export const HANDLE_AND_MENU: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'handle_and_menu',
      catalogId: KIT_CATALOG_ID,
      dataModel: {
        rows: [
          { id: 'one', name: 'First row', shown: true },
          { id: 'two', name: 'Second row', shown: false },
          { id: 'three', name: 'Third row', shown: true },
        ],
      },
      components: [
        { id: 'root', component: 'Column', gap: 12, width: 360, children: ['panel_title', 'rows_list'] },
        { id: 'panel_title', component: 'Text', size: '3xs', fontWeight: 'semibold', color: 'secondary', letterSpacing: 1, textTransform: 'uppercase', text: 'Rows' },
        {
          id: 'rows_list', component: 'List', gap: 4, sortable: true, listId: 'rows', handle: 'row_grip',
          children: { componentId: 'row_menu', path: '/rows' },
          action: { event: { name: 'moveRow', context: { order: { '@path': '/rows' } } } },
        },
        {
          id: 'row_menu', component: 'DropdownMenu', openOn: 'contextMenu', trigger: 'row',
          items: [
            { label: 'Rename', icon: 'pencil', action: { event: { name: 'renameRow', context: { id: { '@path': 'id' } } } } },
            { label: 'Delete', icon: 'delete', danger: true, action: { event: { name: 'deleteRow', context: { id: { '@path': 'id' } } } } },
          ],
        },
        { id: 'row', component: 'Row', gap: 8, align: 'center', padding: { x: 8, y: 6 }, radius: 8, surface: 'sunken', children: ['row_grip', 'row_name', 'row_shown'] },
        { id: 'row_grip', component: 'Icon', name: 'dotGrid2x3', size: 18, accessibility: { label: 'Drag to reorder' } },
        { id: 'row_name', component: 'Text', weight: 1, text: { '@path': 'name' } },
        {
          id: 'row_shown', component: 'CheckBox', displayStyle: 'switch', label: 'Visible', value: { '@path': 'shown' },
          action: { event: { name: 'toggleRow', context: { id: { '@path': 'id' }, shown: { '@path': 'shown' } } } },
        },
      ],
    },
  },
];

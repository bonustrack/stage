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

export const DASHBOARD_BLOCK: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'dashboard_block',
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

export const KANBAN: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'kanban',
      catalogId: KIT_CATALOG_ID,
      dataModel: {
        lastMove: null,
        confirm: { open: false },
        columns: [
          { id: 'todo', title: 'To do', cards: [{ id: 'c1', title: 'Write the spec', owner: 'Ada', avatar: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000001?s=48' }, { id: 'c2', title: 'Design the board', owner: 'Grace', avatar: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000002?s=48' }] },
          { id: 'doing', title: 'Doing', cards: [{ id: 'c3', title: 'Build sortable lists', owner: 'Linus', avatar: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000003?s=48' }] },
          { id: 'done', title: 'Done', cards: [{ id: 'c4', title: 'Kickoff', owner: 'Ada', avatar: 'https://cdn.stamp.fyi/avatar/eth:0x0000000000000000000000000000000000000001?s=48' }] },
        ],
      },
      components: [
        { id: 'root', component: 'Column', gap: 12, children: ['board', 'confirm'] },
        { id: 'board', component: 'Row', gap: 12, align: 'start', children: { componentId: 'column', path: '/columns' } },
        { id: 'column', component: 'Column', width: 200, gap: 8, padding: 8, radius: 'md', surface: 'sunken', children: ['column_head', 'cards'] },
        { id: 'column_head', component: 'Row', align: 'center', children: ['column_title', 'column_menu'] },
        { id: 'column_title', component: 'Text', weight: 1, fontWeight: 'semibold', text: { '@path': 'title' } },
        {
          id: 'column_menu', component: 'DropdownMenu', align: 'end', trigger: 'column_more', accessibility: { label: 'Column menu' },
          items: [
            { label: 'Rename', icon: 'edit', action: { event: { name: 'renameColumn', context: { id: { '@path': 'id' } } } } },
            { label: 'Delete', icon: 'delete', danger: true, action: { event: { name: 'deleteColumn', context: { id: { '@path': 'id' } } } } },
          ],
        },
        { id: 'column_more', component: 'Icon', name: 'moreHoriz', size: 20 },
        { id: 'confirm', component: 'Modal', title: 'Delete a column', trigger: 'confirm_open', content: 'confirm_body', open: { '@path': '/confirm/open' } },
        { id: 'confirm_open', component: 'Button', variant: 'borderless', child: 'confirm_open_label', action: { event: { name: 'noop' } } },
        { id: 'confirm_open_label', component: 'Text', text: 'Delete a column' },
        { id: 'confirm_body', component: 'Column', gap: 12, children: ['confirm_text', 'confirm_actions'] },
        { id: 'confirm_text', component: 'Text', text: 'The cards move to To do.' },
        { id: 'confirm_actions', component: 'Row', justify: 'end', align: 'center', gap: 12, children: ['confirm_cancel', 'confirm_delete'] },
        { id: 'confirm_cancel', component: 'Button', variant: 'borderless', child: 'confirm_cancel_label', action: { event: { name: 'cancelDelete' } } },
        { id: 'confirm_cancel_label', component: 'Text', text: 'Cancel' },
        { id: 'confirm_delete', component: 'Button', variant: 'solid', color: 'danger', child: 'confirm_delete_label', action: { event: { name: 'confirmDelete' } } },
        { id: 'confirm_delete_label', component: 'Text', text: 'Delete' },
        {
          id: 'cards', component: 'List', gap: 8, sortable: true, group: 'board', listId: { '@path': 'id' },
          children: { componentId: 'card', path: 'cards' }, move: { '@path': '/lastMove' },
          accessibility: { label: { '@path': 'title' } },
          action: { event: { name: 'moveCard', context: { move: { '@path': '/lastMove' } } } },
        },
        { id: 'card', component: 'Modal', title: { '@path': 'title' }, trigger: 'card_face', content: 'card_detail' },
        { id: 'card_face', component: 'Card', size: 'sm', child: 'card_row' },
        { id: 'card_row', component: 'Row', align: 'center', gap: 8, children: ['card_title', 'card_owner'] },
        { id: 'card_title', component: 'Text', weight: 1, text: { '@path': 'title' } },
        { id: 'card_owner', component: 'Image', url: { '@path': 'avatar' }, size: 24, radius: 'full', accessibility: { label: { '@path': 'owner' } } },
        { id: 'card_detail', component: 'Text', text: { '@call': 'formatString', args: { value: 'Owner: ${owner}' } } },
      ],
    },
  },
];

export const THEME_PICKER: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'theme_picker',
      catalogId: KIT_CATALOG_ID,
      dataModel: {
        themes: [
          { id: 'light', name: 'Light', swatch: '#ffffff' },
          { id: 'dark', name: 'Dark', swatch: '#111111' },
          { id: 'sand', name: 'Sand', swatch: '#e8dcc4' },
        ],
      },
      components: [
        { id: 'root', component: 'Column', gap: 16, children: ['header', 'grid', 'nav', 'tools'] },
        { id: 'header', component: 'Row', gap: 8, align: 'center', children: ['header_icon', 'title', 'count'] },
        { id: 'header_icon', component: 'Icon', name: 'brush', size: 22 },
        { id: 'title', component: 'Title', level: 3, text: 'Theme' },
        { id: 'count', component: 'Column', background: 'text', radius: 9, padding: { x: 8, y: 2 }, children: ['count_text'] },
        { id: 'count_text', component: 'Text', size: '3xs', fontWeight: 'semibold', color: 'surface', text: '3' },
        { id: 'tools', component: 'Row', gap: 12, align: 'center', children: ['color_menu', 'member'] },
        {
          id: 'color_menu', component: 'DropdownMenu', trigger: 'color_button',
          items: [
            { label: 'Orange', swatch: '#e25507', selected: true, action: { event: { name: 'setColor', context: { color: 'orange' } } } },
            { label: 'Green', swatch: '#2f9e44', action: { event: { name: 'setColor', context: { color: 'green' } } } },
            { label: 'Settings', icon: 'settingsGear1', action: { event: { name: 'openSettings' } } },
          ],
        },
        { id: 'color_button', component: 'Button', variant: 'outline', color: 'secondary', iconEnd: 'chevronDownSmall', child: 'color_label', action: { event: { name: 'noop' } } },
        { id: 'color_label', component: 'Text', text: 'Role colour' },
        { id: 'member', component: 'Modal', side: 'end', title: 'Edit member', trigger: 'member_button', content: 'member_body' },
        { id: 'member_button', component: 'Button', variant: 'borderless', iconStart: 'people', child: 'member_label', action: { event: { name: 'noop' } } },
        { id: 'member_label', component: 'Text', text: 'Edit member' },
        { id: 'member_body', component: 'Text', text: 'A side sheet at the end edge.' },
        { id: 'grid', component: 'Row', gap: 12, wrap: true, children: { componentId: 'theme', path: '/themes' } },
        {
          id: 'theme', component: 'Column', width: 160, gap: 8, padding: 8, radius: 14, feedback: 'highlight', border: { size: 1, color: 'border' },
          accessibility: { label: { '@path': 'name' } }, children: ['theme_swatch', 'theme_name'],
          action: { event: { name: 'pickTheme', context: { id: { '@path': 'id' } } } },
        },
        { id: 'theme_swatch', component: 'Column', height: 96, radius: 'sm', background: { '@path': 'swatch' }, border: { size: 1, color: 'border' }, children: [] },
        { id: 'theme_name', component: 'Text', fontWeight: 'semibold', text: { '@path': 'name' } },
        { id: 'nav', component: 'Row', gap: 12, wrap: true, children: { componentId: 'nav_item', path: '/themes' } },
        { id: 'nav_item', component: 'Button', variant: 'borderless', child: 'nav_box', action: { event: { name: 'openTheme', context: { id: { '@path': 'id' } } } } },
        { id: 'nav_box', component: 'Column', width: 120, height: 120, padding: 8, radius: 'md', surface: 'sunken', children: ['nav_name'] },
        { id: 'nav_name', component: 'Text', text: { '@path': 'name' } },
      ],
    },
  },
];

export const PAGES: JsonObject[] = [
  {
    version: v,
    createSurface: {
      surfaceId: 'pages',
      catalogId: KIT_CATALOG_ID,
      dataModel: {
        pages: [
          { id: 'home', name: 'Home', shown: true },
          { id: 'docs', name: 'Docs', shown: false },
          { id: 'blog', name: 'Blog', shown: true },
        ],
      },
      components: [
        { id: 'root', component: 'Column', gap: 12, width: 360, children: ['panel_title', 'pages_list'] },
        { id: 'panel_title', component: 'Text', size: '3xs', fontWeight: 'semibold', color: 'secondary', letterSpacing: 1, textTransform: 'uppercase', text: 'Pages' },
        {
          id: 'pages_list', component: 'List', gap: 4, sortable: true, listId: 'pages', handle: 'page_grip',
          children: { componentId: 'page_menu', path: '/pages' },
          action: { event: { name: 'movePage', context: { order: { '@path': '/pages' } } } },
        },
        {
          id: 'page_menu', component: 'DropdownMenu', openOn: 'contextMenu', trigger: 'page_row',
          items: [
            { label: 'Rename', icon: 'pencil', action: { event: { name: 'renamePage', context: { id: { '@path': 'id' } } } } },
            { label: 'Delete', icon: 'delete', danger: true, action: { event: { name: 'deletePage', context: { id: { '@path': 'id' } } } } },
          ],
        },
        { id: 'page_row', component: 'Row', gap: 8, align: 'center', padding: { x: 8, y: 6 }, radius: 8, surface: 'sunken', children: ['page_grip', 'page_name', 'page_shown'] },
        { id: 'page_grip', component: 'Icon', name: 'dotGrid2x3', size: 18, accessibility: { label: 'Drag to reorder' } },
        { id: 'page_name', component: 'Text', weight: 1, text: { '@path': 'name' } },
        {
          id: 'page_shown', component: 'CheckBox', displayStyle: 'switch', label: 'In sidebar', value: { '@path': 'shown' },
          action: { event: { name: 'toggleSidebar', context: { id: { '@path': 'id' }, shown: { '@path': 'shown' } } } },
        },
      ],
    },
  },
];

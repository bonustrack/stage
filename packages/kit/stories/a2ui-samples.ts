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
        { id: 'modal_body', component: 'Text', text: { '@call': 'formatString', args: { value: 'Volume is ${/volume}, agreed: ${/agree}' } } },
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
        filter: { owner: ['all'] },
        trend: [{ week: 'W1', sales: 12, returns: 2 }, { week: 'W2', sales: 18, returns: 3 }, { week: 'W3', sales: 9, returns: 1 }, { week: 'W4', sales: 22, returns: 4 }],
        units: [
          { name: 'Pillar A', status: 'On track', tone: 'success', share: '72%' },
          { name: 'Pillar B', status: 'At risk', tone: '#e25507', share: '41%' },
          { name: 'Pillar C', status: 'Overdue', tone: 'danger', share: '18%' },
        ],
      },
      components: [
        { id: 'root', component: 'Column', gap: 16, children: ['header', 'chart', 'units', 'toolbar'] },
        { id: 'header', component: 'Row', padding: { x: 4, bottom: 4 }, justify: 'spaceBetween', align: 'center', children: ['title', 'delta'] },
        { id: 'title', component: 'Title', level: 3, text: 'Weekly activity' },
        { id: 'delta', component: 'Text', size: 'sm', fontWeight: 'semibold', color: { '@path': '/units/0/tone' }, text: '+18%' },
        { id: 'chart', component: 'Chart', data: { '@path': '/trend' }, xAxis: 'week', height: 160, series: [{ type: 'bar', dataKey: 'sales', label: 'Sales', color: 'blue' }, { type: 'line', dataKey: 'returns', label: 'Returns', color: 'orange' }] },
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

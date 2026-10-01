import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Frame, type FrameAction } from '../src/react-native/frame';
import { Box } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, select, useDark } from './_controls';

export default { title: 'Frame' };

const FRAME_SAMPLES = {
  report: {
    type: 'Card',
    size: 'md',
    status: { text: 'Shared by Emma' },
    children: [
      {
        type: 'Row',
        children: [
          { type: 'Icon', name: 'analytics', size: 'lg' },
          { type: 'Title', value: 'Weekly report', size: 'md' },
          { type: 'Spacer' },
          { type: 'Badge', label: 'On track', color: 'success', variant: 'soft', pill: true },
        ],
      },
      { type: 'Caption', value: 'Sep 22 to Sep 28' },
      { type: 'Divider', flush: true },
      { type: 'Markdown', value: 'Sales are **up 12%**. Two invoices are still open, see [the dashboard](https://stage.box).' },
      {
        type: 'Row',
        gap: 2,
        children: [
          { type: 'Button', label: 'Approve', iconStart: 'check', onClickAction: { type: 'report.approve', payload: { week: 39 } } },
          { type: 'Button', label: 'Ask a question', color: 'secondary', onClickAction: { type: 'report.question', payload: { week: 39 } } },
        ],
      },
    ],
  },
  answer: {
    type: 'Basic',
    gap: 3,
    children: [
      { type: 'Markdown', value: 'Paris is the capital of France. It sits on the **Seine** and has about 2.1 million people.' },
      {
        type: 'Row',
        gap: 1,
        children: ['copy', 'thumbs-up', 'thumbs-down', 'share'].map((icon) => ({
          type: 'Button', iconStart: icon, variant: 'ghost', color: 'secondary', size: 'sm', uniform: true,
          onClickAction: { type: `answer.${icon}` },
        })),
      },
      {
        type: 'Row',
        gap: 2,
        padding: { x: 4, y: 2 },
        radius: 'full',
        background: 'surface-secondary',
        children: [
          { type: 'Text', value: 'Ask anything', color: 'secondary' },
          { type: 'Spacer' },
          { type: 'Button', iconStart: 'mic', variant: 'ghost', color: 'secondary', uniform: true, pill: true, onClickAction: { type: 'composer.mic' } },
          { type: 'Button', iconStart: 'arrow-up', uniform: true, pill: true, onClickAction: { type: 'composer.send' } },
        ],
      },
    ],
  },
  form: {
    type: 'Card',
    asForm: true,
    children: [
      { type: 'Title', value: 'Book a call', size: 'sm' },
      { type: 'Text', value: 'Pick a slot and Emma confirms it.', color: 'secondary', size: 'sm' },
      { type: 'Label', value: 'Name', fieldName: 'name' },
      { type: 'Input', name: 'name', placeholder: 'Ada Lovelace', required: true },
      { type: 'Label', value: 'Topic', fieldName: 'topic' },
      {
        type: 'Select', name: 'topic', placeholder: 'Choose a topic',
        options: [{ label: 'Billing', value: 'billing' }, { label: 'Product', value: 'product' }],
      },
      { type: 'Checkbox', name: 'reminder', label: 'Send me a reminder', defaultChecked: true },
    ],
    confirm: { label: 'Book', action: { type: 'call.book' } },
    cancel: { label: 'Not now', action: { type: 'call.cancel' } },
  },
  list: {
    type: 'ListView',
    limit: 3,
    status: { text: 'Open invoices' },
    children: ['Acme', 'Globex', 'Initech', 'Umbrella'].map((name, i) => ({
      type: 'ListViewItem',
      onClickAction: { type: 'invoice.open', payload: { id: i + 1 } },
      children: [
        { type: 'Image', src: `https://picsum.photos/seed/${name}/88`, size: 36, radius: 'full' },
        {
          type: 'Col',
          gap: 0.5,
          children: [{ type: 'Text', value: name, weight: 'semibold' }, { type: 'Caption', value: `Invoice #${1040 + i}` }],
        },
        { type: 'Spacer' },
        { type: 'Text', value: `CHF ${(i + 1) * 420}`, color: 'secondary' },
      ],
    })),
  },
  chart: {
    type: 'Card',
    children: [
      { type: 'Title', value: 'Signups', size: 'sm' },
      {
        type: 'Chart',
        xAxis: 'day',
        series: [{ type: 'bar', dataKey: 'web', label: 'Web' }, { type: 'bar', dataKey: 'mobile', label: 'Mobile' }],
        data: [{ day: 'Mon', web: 12, mobile: 30 }, { day: 'Tue', web: 18, mobile: 26 }, { day: 'Wed', web: 9, mobile: 41 }],
      },
    ],
  },
  fallbacks: {
    type: 'Card',
    children: [
      { type: 'Text', value: 'Unknown nodes and unsafe values render a small notice or nothing.' },
      { type: 'Iframe', src: 'https://example.com' },
      { type: 'Image', src: 'http://example.com/not-https.png' },
      { type: 'Text', value: 'Unsafe color dropped', color: 'url(https://example.com/x.png)' },
    ],
  },
  screens: {
    start: 'home',
    screens: {
      home: {
        type: 'ListView',
        children: ['Acme', 'Globex'].map((name) => ({
          type: 'ListViewItem',
          onClickAction: { type: 'frame.open', payload: { screen: name } },
          children: [{ type: 'Text', value: name, weight: 'semibold' }, { type: 'Spacer' }, { type: 'Icon', name: 'chevron-right' }],
        })),
      },
      ...Object.fromEntries(['Acme', 'Globex'].map((name) => [name, {
        title: name,
        widget: {
          type: 'Card',
          children: [
            { type: 'Title', value: name, size: 'sm' },
            { type: 'Text', value: 'A second screen, opened with frame.open and no message to the agent.' },
            { type: 'Row', gap: 2, children: [
              { type: 'Button', label: 'Back', color: 'secondary', onClickAction: { type: 'frame.back' } },
              { type: 'Button', label: 'Approve', onClickAction: { type: 'customer.approve', payload: { name } } },
            ] },
          ],
        },
      }])),
    },
  },
  invalid: 'This is not a widget',
} as const;

type FrameSampleName = keyof typeof FRAME_SAMPLES;

const FRAME_SAMPLE_NAMES = Object.keys(FRAME_SAMPLES) as FrameSampleName[];

interface FrameStoryArgs {
  sample: FrameSampleName;
  disabled: boolean;
  showJson: boolean;
}

function lastActionText(action: FrameAction | null, label: string | undefined): string {
  if (action === null) return 'Tap a button or a row to see the action it sends.';
  return `${label === undefined ? '' : `${label}: `}${JSON.stringify(action)}`;
}

export const Controls: Story<FrameStoryArgs> = ({ sample, disabled, showJson }) => {
  const dark = useDark();
  const [last, setLast] = useState<{ action: FrameAction; label?: string } | null>(null);
  const widget = FRAME_SAMPLES[sample];
  return (
    <Box gap={16}>
      <Frame widget={widget} dark={dark} disabled={disabled}
        onAction={(action, source) => { setLast({ action, label: source.label }); }} />
      <Text variant="mono" size="xs" role="secondary" value={lastActionText(last?.action ?? null, last?.label)} />
      {showJson ? <Text variant="mono" size="xs" role="secondary" value={JSON.stringify(widget, null, 2)} /> : null}
    </Box>
  );
};
Controls.args = { sample: 'report', disabled: false, showJson: false };
Controls.argTypes = { sample: select(FRAME_SAMPLE_NAMES), disabled: bool, showJson: bool };

export const Samples: Story = () => {
  const dark = useDark();
  return (
    <Box gap={24}>
      {FRAME_SAMPLE_NAMES.map((name) => <Frame key={name} widget={FRAME_SAMPLES[name]} dark={dark} />)}
    </Box>
  );
};

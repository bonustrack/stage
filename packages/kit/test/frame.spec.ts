import { describe, expect, test } from 'bun:test';
import {
  FRAME_LIMITS, frameFillPadding, frameSummary, missingRequired, parseFrame, resolveFrameColor, withFormValues,
  type FrameNode,
} from '../src/frame';
import { kitPalette } from '../src/tokens';

function root(widget: unknown): FrameNode {
  const parsed = parseFrame(widget);
  if (!parsed.ok) throw new Error(`parse failed: ${parsed.error}`);
  return parsed.root;
}

function only(node: Record<string, unknown>): FrameNode {
  const card = root({ type: 'Card', children: [node] });
  const child = card.children[0];
  if (child === undefined) throw new Error('no child');
  return child;
}

describe('parseFrame: roots', () => {
  test('Card keeps its props and children', () => {
    const card = root({
      type: 'Card', size: 'lg', padding: 2, background: 'surface-secondary', status: { text: 'Live', favicon: 'https://x.y/f.png' },
      confirm: { label: 'OK', action: { type: 'ok', payload: { id: 1 } } }, asForm: true, theme: 'dark',
      children: [{ type: 'Text', value: 'Hi' }],
    });
    expect(card.type).toBe('Card');
    expect(card.props).toEqual({
      size: 'lg', padding: { top: 8, right: 8, bottom: 8, left: 8 }, background: { palette: 'inputBg' },
      status: 'Live', confirm: { label: 'OK', action: { type: 'ok', payload: { id: 1 } } }, asForm: true, theme: 'dark',
    });
    expect(card.children).toHaveLength(1);
  });

  test('ListView with ListViewItems and a limit', () => {
    const list = root({
      type: 'ListView', limit: 2,
      children: [1, 2, 3].map((n) => ({ type: 'ListViewItem', onClickAction: { type: 'pick', payload: { n } }, children: [{ type: 'Text', value: `#${n}` }] })),
    });
    expect(list.props).toEqual({ limit: 2 });
    expect(list.children.map((c) => c.type)).toEqual(['ListViewItem', 'ListViewItem', 'ListViewItem']);
    expect(list.children[0]?.props).toEqual({ onClickAction: { type: 'pick', payload: { n: 1 } } });
  });

  test('Basic root', () => {
    expect(root({ type: 'Basic', direction: 'row', gap: 3, children: [] }).props).toEqual({ direction: 'row', gap: 12 });
  });

  test('Basic root keeps a background and a zero padding', () => {
    expect(root({ type: 'Basic', background: '#1d4ed8', padding: 0, children: [] }).props).toEqual({
      background: { fixed: '#1d4ed8' }, padding: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  });

  test('a bare component works as a root too', () => {
    expect(root({ type: 'Text', value: 'solo' }).type).toBe('Text');
  });
});

describe('parseFrame: layout nodes', () => {
  test('Box, Row and Col map spacing units to px and keep CSS px strings', () => {
    const box = only({ type: 'Box', direction: 'row', gap: 2, padding: { x: 1, top: '6px' }, align: 'center', justify: 'between', wrap: 'wrap', flex: 1 });
    expect(box.props).toEqual({
      direction: 'row', gap: 8, padding: { top: 6, right: 4, bottom: undefined, left: 4 },
      align: 'center', justify: 'between', wrap: 'wrap', flex: 1,
    });
    expect(only({ type: 'Row', width: 120, height: '50%', radius: 'lg' }).props).toEqual({ width: 120, height: '50%', radius: 'lg' });
    expect(only({ type: 'Col', border: 1 }).props).toEqual({
      border: { top: { width: 1 }, right: { width: 1 }, bottom: { width: 1 }, left: { width: 1 } },
    });
  });

  test('Form keeps its submit action', () => {
    expect(only({ type: 'Form', onSubmitAction: { type: 'save', handler: 'client', loadingBehavior: 'self' } }).props)
      .toEqual({ onSubmitAction: { type: 'save' } });
  });

  test('Spacer, Divider and Transition', () => {
    expect(only({ type: 'Spacer', minSize: 12 }).props).toEqual({ minSize: 12 });
    expect(only({ type: 'Divider', spacing: 2, size: 2, flush: true }).props).toEqual({ spacing: 8, size: 2, flush: true });
    const t = only({ type: 'Transition', children: { type: 'Text', value: 'x' } });
    expect(t.children.map((c) => c.type)).toEqual(['Text']);
  });

  test('Table rows and cells', () => {
    const table = only({
      type: 'Table',
      children: [{ type: 'Table.Row', header: true, children: [{ type: 'Table.Cell', align: 'end', colSpan: 2, children: [{ type: 'Text', value: 'A' }] }] }],
    });
    expect(table.children[0]?.props).toEqual({ header: true });
    expect(table.children[0]?.children[0]?.props).toEqual({ align: 'end', colSpan: 2 });
  });

  test('Chart becomes a table of its data', () => {
    const chart = only({
      type: 'Chart', xAxis: { dataKey: 'day', labels: { mon: 'Monday' } },
      series: [{ type: 'bar', dataKey: 'sales', label: 'Sales' }, { type: 'line', dataKey: 'refunds' }],
      data: [{ day: 'mon', sales: 10, refunds: 1 }, { day: 'tue', sales: 7 }],
    });
    expect(chart).toEqual({
      type: 'Chart', children: [],
      props: { header: ['day', 'Sales', 'refunds'], rows: [['Monday', '10', '1'], ['tue', '7', '']] },
    });
    expect(only({ type: 'Chart', data: [] }).type).toBe('Unsupported');
  });
});

describe('parseFrame: text and content nodes', () => {
  test('Text, Title, Caption, Label and Markdown', () => {
    expect(only({ type: 'Text', value: 'Hi', size: 'lg', weight: 'bold', color: 'secondary', italic: true, maxLines: 2 }).props)
      .toEqual({ value: 'Hi', size: 'lg', weight: 'bold', color: { palette: 'sub' }, italic: true, maxLines: 2 });
    expect(only({ type: 'Text', value: 'x', editable: { name: 'title', required: true } }).props.editable)
      .toEqual({ name: 'title', placeholder: undefined, required: true });
    expect(only({ type: 'Title', value: 'T', size: '3xl' }).props).toEqual({ value: 'T', size: '3xl' });
    expect(only({ type: 'Caption', value: 'c', size: 'sm' }).props).toEqual({ value: 'c', size: 'sm' });
    expect(only({ type: 'Label', value: 'Name', fieldName: 'name' }).props).toEqual({ value: 'Name', fieldName: 'name' });
    expect(only({ type: 'Markdown', value: '**b**' }).props).toEqual({ value: '**b**' });
  });

  test('a required prop missing makes the node unsupported', () => {
    expect(only({ type: 'Text' })).toEqual({ type: 'Unsupported', props: { name: 'Text' }, children: [] });
    expect(only({ type: 'Badge' }).type).toBe('Unsupported');
    expect(only({ type: 'Select', name: 'x' }).type).toBe('Unsupported');
  });

  test('Badge, Icon and Button', () => {
    expect(only({ type: 'Badge', label: 'New', color: 'success', variant: 'soft', pill: true }).props)
      .toEqual({ label: 'New', color: 'success', variant: 'soft', pill: true });
    expect(only({ type: 'Icon', name: 'sparkle', size: 'lg' }).props).toEqual({ name: 'sparkle', size: 'lg' });
    expect(only({ type: 'Icon', name: 'not-an-icon' }).type).toBe('Unsupported');
    expect(only({ type: 'Button', label: 'Go', onClickAction: { type: 'go' }, iconStart: 'bolt', style: 'secondary', size: '3xl', block: true }).props)
      .toEqual({ label: 'Go', onClickAction: { type: 'go' }, iconStart: 'bolt', style: 'secondary', size: '3xl', block: true });
  });

  test('Image only takes https sources', () => {
    expect(only({ type: 'Image', src: 'https://example.com/a.png', size: 44, alt: 'a' }).props)
      .toEqual({ src: 'https://example.com/a.png', size: 44, alt: 'a' });
    for (const src of ['http://example.com/a.png', 'javascript:alert(1)', 'data:image/png;base64,AA', 'https://', '//x.y/a.png']) {
      expect(only({ type: 'Image', src }).type).toBe('Unsupported');
    }
  });
});

describe('parseFrame: form controls', () => {
  test('Input, Textarea, Select, DatePicker, Checkbox and RadioGroup', () => {
    expect(only({ type: 'Input', name: 'email', inputType: 'email', required: true, size: 'lg' }).props)
      .toEqual({ name: 'email', inputType: 'email', required: true, size: 'lg' });
    expect(only({ type: 'Textarea', name: 'note', rows: 4 }).props).toEqual({ name: 'note', rows: 4 });
    expect(only({ type: 'Select', name: 'size', options: [{ label: 'S', value: 's' }, { value: 'm' }, 'bad'] }).props.options)
      .toEqual([{ label: 'S', value: 's' }, { label: 'm', value: 'm' }]);
    expect(only({ type: 'DatePicker', name: 'when', min: '2026-01-01', onChangeAction: { type: 'date' } }).props)
      .toEqual({ name: 'when', min: '2026-01-01', onChangeAction: { type: 'date' } });
    expect(only({ type: 'Checkbox', name: 'agree', label: 'I agree', defaultChecked: true }).props)
      .toEqual({ name: 'agree', label: 'I agree', defaultChecked: true });
    expect(only({ type: 'RadioGroup', name: 'r', options: [{ label: 'A', value: 'a', disabled: true }], direction: 'row' }).props)
      .toEqual({ name: 'r', options: [{ label: 'A', value: 'a', disabled: true }], direction: 'row' });
  });
});

describe('parseFrame: safety', () => {
  test('invalid input never throws', () => {
    for (const bad of [null, undefined, 'x', 42, [], { type: 1 }]) {
      const parsed = parseFrame(bad);
      if (parsed.ok) expect(parsed.root.type).toBe('Unsupported');
      else expect(parsed.error).toBe('invalid');
    }
    const cyclic: Record<string, unknown> = { type: 'Card' };
    cyclic.children = [cyclic];
    expect(parseFrame(cyclic)).toEqual({ ok: false, error: 'invalid' });
  });

  test('unknown node types become a small unsupported node', () => {
    const card = root({ type: 'Card', children: [{ type: 'Iframe', src: 'https://evil.example' }, { foo: 1 }] });
    expect(card.children).toEqual([
      { type: 'Unsupported', props: { name: 'Iframe' }, children: [] },
      { type: 'Unsupported', props: { name: '' }, children: [] },
    ]);
  });

  test('unknown props are dropped and unsafe values are refused', () => {
    const text = only({ type: 'Text', value: 'x', onPress: 'alert(1)', style: { color: 'red' }, color: 'url(https://t.example/p.png)' });
    expect(text.props).toEqual({ value: 'x' });
    expect(only({ type: 'Box', background: 'expression(alert(1))' }).props).toEqual({});
  });

  test('size, depth and node limits', () => {
    expect(parseFrame({ type: 'Card', children: [{ type: 'Text', value: 'x'.repeat(FRAME_LIMITS.maxChars) }] }))
      .toEqual({ ok: false, error: 'too-large' });
    let deep: Record<string, unknown> = { type: 'Text', value: 'leaf' };
    for (let i = 0; i < FRAME_LIMITS.maxDepth + 2; i += 1) deep = { type: 'Col', children: [deep] };
    expect(parseFrame(deep)).toEqual({ ok: false, error: 'too-deep' });
    const wide = Array.from({ length: 3 }, () => ({ type: 'Col', children: Array.from({ length: 199 }, () => ({ type: 'Spacer' })) }));
    expect(parseFrame({ type: 'Card', children: wide })).toEqual({ ok: false, error: 'too-many-nodes' });
  });

  test('long strings are cut', () => {
    const value = only({ type: 'Badge', label: 'b'.repeat(500) }).props;
    expect('label' in value ? value.label?.length : 0).toBe(200);
  });
});

describe('frame colors', () => {
  test('tokens, hex, functional and theme-aware colors resolve', () => {
    const dark = kitPalette('dark');
    const light = kitPalette('light');
    const color = (c: unknown): unknown => only({ type: 'Text', value: 'x', color: c }).props;
    expect(color('#ff0000')).toEqual({ value: 'x', color: { fixed: '#ff0000' } });
    expect(color('rgba(0, 0, 0, 0.5)')).toEqual({ value: 'x', color: { fixed: 'rgba(0, 0, 0, 0.5)' } });
    expect(color({ light: '#000', dark: '#fff' })).toEqual({ value: 'x', color: { light: '#000', dark: '#fff' } });
    expect(color('red-100')).toEqual({ value: 'x' });
    expect(resolveFrameColor({ palette: 'sub' }, 'dark', dark)).toBe(dark.sub);
    expect(resolveFrameColor({ light: '#000', dark: '#fff' }, 'light', light)).toBe('#000');
    expect(resolveFrameColor(undefined, 'light', light)).toBeUndefined();
  });
});

describe('frameFillPadding', () => {
  test('a root without padding gets the fill padding, and the bottom inset is added', () => {
    expect(frameFillPadding(undefined, { padding: 18, insetBottom: 20 })).toEqual({ top: 18, right: 18, bottom: 38, left: 18 });
  });

  test('a root padding wins, so padding 0 leaves no spacing', () => {
    expect(frameFillPadding({ top: 0, right: 0, bottom: 0, left: 0 }, { padding: 18 })).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(frameFillPadding({ top: 8, left: 4 }, { padding: 18, insetBottom: 10 })).toEqual({ top: 8, left: 4, bottom: 10 });
  });
});

describe('frameSummary', () => {
  test('takes the first Title and the first text', () => {
    expect(frameSummary(root({
      type: 'Card',
      children: [{ type: 'Row', children: [{ type: 'Title', value: 'Weekly **report**' }] }, { type: 'Markdown', value: 'Sales [up](https://x.y) 12%' }],
    }))).toEqual({ title: 'Weekly report', description: 'Sales up 12%' });
  });

  test('reads in document order', () => {
    expect(frameSummary(root({
      type: 'ListViewItem',
      children: [
        { type: 'Col', children: [{ type: 'Text', value: 'Globex' }, { type: 'Caption', value: 'Invoice #1041' }] },
        { type: 'Text', value: 'CHF 840' },
      ],
    }))).toEqual({ title: 'Globex', description: 'Invoice #1041' });
  });

  test('long or hostile text stays fast and short', () => {
    const value = '['.repeat(7900);
    const started = performance.now();
    const summary = frameSummary(root({ type: 'Card', children: Array.from({ length: 7 }, () => ({ type: 'Text', value })) }));
    expect(performance.now() - started).toBeLessThan(50);
    expect(summary.title?.length).toBeLessThanOrEqual(400);
  });

  test('falls back to text when there is no Title', () => {
    expect(frameSummary(root({ type: 'Card', children: [{ type: 'Text', value: 'One' }, { type: 'Caption', value: 'Two' }] })))
      .toEqual({ title: 'One', description: 'Two' });
    expect(frameSummary(root({ type: 'Card', children: [] }))).toEqual({ title: undefined, description: undefined });
  });
});

describe('form values', () => {
  test('values merge into the payload, nested by dots, without overriding', () => {
    expect(withFormValues({ type: 'save', payload: { id: 7, title: 'keep' } }, { title: 'new', 'todo.done': true, note: 'n' }))
      .toEqual({ type: 'save', payload: { id: 7, title: 'keep', todo: { done: true }, note: 'n' } });
    expect(withFormValues({ type: 'a' }, {})).toEqual({ type: 'a' });
  });

  test('prototype keys are ignored', () => {
    const out = withFormValues({ type: 'a' }, { '__proto__.polluted': 1, 'constructor.x': 2 });
    expect(out.payload).toEqual({});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test('missingRequired', () => {
    expect(missingRequired(['a', 'b', 'c', 'd'], { a: 'x', b: '', c: false })).toEqual(['b', 'c', 'd']);
  });
});

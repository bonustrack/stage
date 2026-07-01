import { describe, expect, test } from 'bun:test';
import {
  badge,
  basicRoot,
  button,
  caption,
  card,
  col,
  icon,
  image,
  markdown,
  row,
  text,
  title,
} from '../src/primitives';
import { snap } from './helpers';

describe('basicRoot', () => {
  test('minimal', () => {
    const root = basicRoot();
    expect(root).toEqual({ type: 'Basic', children: [] });
    snap(root);
  });

  test('full', () => {
    const root = basicRoot(text('hello'), caption('world'));
    expect(root.type).toBe('Basic');
    expect(root.children).toHaveLength(2);
    snap(root);
  });
});

describe('row', () => {
  test('minimal', () => {
    snap(row([]));
  });

  test('full', () => {
    snap(row([text('a'), text('b')], { align: 'center', gap: 8, padding: { x: 12, y: 4 }, flex: 1 }));
  });
});

describe('col', () => {
  test('minimal', () => {
    snap(col([]));
  });

  test('full', () => {
    snap(col([text('a')], { align: 'start', gap: 6, flex: 1 }));
  });
});

describe('card', () => {
  test('minimal', () => {
    snap(card([]));
  });

  test('full', () => {
    snap(card([text('inside')], { padding: 16 }));
  });
});

describe('text', () => {
  test('minimal', () => {
    snap(text('hello'));
  });

  test('full', () => {
    snap(text('hello', { size: 'md', weight: 'semibold', color: 'secondary', truncate: true }));
  });
});

describe('title', () => {
  test('minimal', () => {
    snap(title('Heading'));
  });

  test('full', () => {
    snap(title('Heading', { size: 'lg', weight: 'semibold', color: 'link' }));
  });
});

describe('caption', () => {
  test('minimal', () => {
    snap(caption('small print'));
  });

  test('full', () => {
    snap(caption('small print', { color: 'secondary', size: 'sm', weight: 'semibold' }));
  });
});

describe('markdown', () => {
  test('minimal', () => {
    snap(markdown('**bold** and _italic_'));
  });
});

describe('badge', () => {
  test('minimal', () => {
    snap(badge('NEW'));
  });

  test('full', () => {
    snap(badge('NEW', { color: 'info', variant: 'soft', size: 'sm', pill: true }));
  });
});

describe('image', () => {
  test('minimal', () => {
    snap(image('https://img.example/pic.png'));
  });

  test('full', () => {
    snap(image('https://img.example/pic.png', { size: 40, radius: 'full', fit: 'cover' }));
  });
});

describe('icon', () => {
  test('minimal', () => {
    snap(icon('check'));
  });

  test('full', () => {
    snap(icon('check', { size: 'lg', color: 'link' }));
  });
});

describe('button', () => {
  test('minimal', () => {
    snap(button());
  });

  test('full', () => {
    snap(
      button({
        label: 'Send',
        variant: 'solid',
        size: 'sm',
        disabled: true,
        onClickAction: { type: 'test.press', payload: { id: 'b1' } },
      }),
    );
  });
});

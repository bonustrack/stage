import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNativeWeb from 'react-native-web';

mock.module('react-native', () => ReactNativeWeb);
mock.module('react-native-svg', () => import('react-native-svg/lib/module/elements.web.js'));
mock.module('../src/react-native/dialog', () => ({ Dialog: () => null }));
mock.module('../src/react-native/modal', () => ({ MODAL: { maxWidth: 480, backdrop: 'transparent', maxHeight: '88%' } }));

const { DropdownMenuItem } = await import('../src/react-native/menu');

const noop = (): void => undefined;

describe('DropdownMenuItem', () => {
  test('a plain row is a menu item named by its label', () => {
    const html = renderToStaticMarkup(<DropdownMenuItem label="Reply" onPress={noop} />);
    expect(html).toContain('role="menuitem"');
    expect(html).toContain('aria-label="Reply"');
    expect(html).toContain('padding-top:6px');
    expect(html).toContain('gap:8px');
  });

  test('a host row keeps its own role, state, gap, height and slots', () => {
    const html = renderToStaticMarkup(
      <DropdownMenuItem
        label="Archived (2)"
        accessibilityRole="checkbox"
        aria-checked
        disabled
        gap={12}
        minHeight={40}
        style={{ paddingVertical: 2 }}
        leading={<span>lead</span>}
        trailing={<span>tail</span>}
        selected
        onPress={noop}
      />,
    );
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain('gap:12px');
    expect(html).toContain('min-height:40px');
    expect(html).toContain('opacity:0.5');
    expect(html).toContain('padding-top:2px');
    expect(html).toContain('<span>lead</span>');
    expect(html).toContain('<span>tail</span>');
  });
});

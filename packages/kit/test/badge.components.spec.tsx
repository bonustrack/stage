import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNativeWeb from 'react-native-web';
import { FONT_SIZE } from '../src/tokens';
import { TEXT_FONTS } from '../src/text.styles';

mock.module('react-native', () => ReactNativeWeb);

const { Badge } = await import('../src/react-native/badge');

describe('Badge', () => {
  test('is fully rounded by default and keeps the sm radius with pill false', () => {
    expect(renderToStaticMarkup(<Badge label="New" />)).toContain('border-top-left-radius:999px');
    expect(renderToStaticMarkup(<Badge label="New" pill={false} />)).toContain('border-top-left-radius:8px');
  });

  test('takes a custom fill, text colour, text size, weight and style', () => {
    const html = renderToStaticMarkup(
      <Badge label="Label" color="#111111" background="#eeeeee" textSize="xs" weight="normal" style={{ height: 26, paddingLeft: 9 }} />,
    );
    expect(html).toContain('background-color:rgba(238,238,238,1.00)');
    expect(html).toContain('color:rgba(17,17,17,1.00)');
    expect(html).toContain(`font-size:${FONT_SIZE.xs}px`);
    expect(html).toContain(`font-family:${TEXT_FONTS.normal}`);
    expect(html).toContain('height:26px;padding-left:9px');
  });

  test('renders children in place of the label text', () => {
    const html = renderToStaticMarkup(<Badge label="Label"><ReactNativeWeb.Text>Custom</ReactNativeWeb.Text></Badge>);
    expect(html).toContain('Custom');
    expect(html).not.toContain('>Label<');
  });
});

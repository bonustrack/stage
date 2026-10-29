import { describe, expect, mock, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import * as ReactNativeWeb from 'react-native-web';
import { kitPalette } from '../src/tokens';

mock.module('react-native', () => ReactNativeWeb);
mock.module('react-native-svg', () => import('react-native-svg/lib/module/elements.web.js'));

const { Chart } = await import('../src/react-native/chart');

const DATA = [
  { day: 'Mon', web: 12, mobile: 30 },
  { day: 'Tue', web: 18, mobile: 26 },
  { day: 'Wed', web: 9, mobile: 41 },
];

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe('Chart', () => {
  test('draws a bar per value, the axis labels and the legend, with no tab stops or buttons', () => {
    const html = renderToStaticMarkup(
      <Chart
        width={320}
        height={240}
        xAxis="day"
        data={DATA}
        series={[
          { type: 'bar', dataKey: 'web', label: 'Web' },
          { type: 'bar', dataKey: 'mobile', label: 'Mobile' },
        ]}
      />,
    );
    expect(count(html, '<path d="M')).toBe(6);
    for (const text of ['>Mon<', '>Tue<', '>Wed<', '>Web<', '>Mobile<']) expect(html).toContain(text);
    expect(html).not.toContain('tabindex');
    expect(html).not.toContain('role="button"');
  });

  test('follows dark, hides the legend and draws lines', () => {
    const html = renderToStaticMarkup(
      <Chart
        width={320}
        height={240}
        xAxis="day"
        data={DATA}
        dark
        showLegend={false}
        series={[{ type: 'line', dataKey: 'web', label: 'Web', color: 'green' }]}
      />,
    );
    expect(html).toContain(`stroke="${kitPalette('dark').border}"`);
    expect(html).toContain('stroke="#00a240"');
    expect(html).not.toContain('>Web<');
  });

  test('passes the official y axis domain to the plotted line', () => {
    const html = renderToStaticMarkup(
      <Chart
        width={320}
        height={114}
        xAxis="x"
        showYAxis
        showLegend={false}
        yAxis={{ domain: ['dataMin', 'dataMax'] }}
        data={[
          { x: 'a', v: 2490 },
          { x: 'b', v: 2505 },
        ]}
        series={[{ type: 'line', dataKey: 'v', label: 'USD', curveType: 'linear' }]}
      />,
    );
    expect(html).toContain('>2490<');
    expect(html).toContain('>2505<');
    expect(html).not.toContain('>0<');
    expect(html).toContain('L315,5');
  });
});

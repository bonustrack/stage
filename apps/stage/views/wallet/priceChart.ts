import type { ChartNode, Color } from '@stage-labs/kit/kit';

export interface PricePoint {
  t: string | number;
  price: number;
}

export interface PriceChartParams {
  points: PricePoint[];
  color?: Color;
  height?: number;
  area?: boolean;
}

export function priceChart(params: PriceChartParams): ChartNode {
  return {
    type: 'Chart',
    height: params.height ?? 160,
    showYAxis: false,
    showLegend: false,
    xAxis: { dataKey: 't', hide: true },
    series: [
      {
        type: params.area === true ? 'area' : 'line',
        dataKey: 'price',
        color: params.color ?? 'link',
      },
    ],
    data: params.points.map((point) => ({ t: point.t, price: point.price })),
  };
}

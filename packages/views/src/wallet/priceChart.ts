import type { ChartNode, Color } from '@stage-labs/kit/kit';
import view from './priceChart.json';
import { buildView } from '../buildView';

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
  return buildView(view, {
    points: params.points,
    seriesType: params.area === true ? 'area' : 'line',
    color: params.color ?? 'link',
    height: params.height ?? 160,
  }) as ChartNode;
}

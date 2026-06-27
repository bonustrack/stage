
import type {
  ChartDataRow,
  ChartSeries,
  Dimension,
  NodeBase,
  XAxisConfig,
} from './node-fields';

export interface ChartNode extends NodeBase {
  type: 'Chart';
  data: ChartDataRow[];
  series: ChartSeries[];
  xAxis: string | XAxisConfig;
  showYAxis?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  barGap?: number;
  barCategoryGap?: number;
  flex?: Dimension;
  width?: Dimension;
  height?: Dimension;
  size?: Dimension;
  minWidth?: Dimension;
  minHeight?: Dimension;
  minSize?: Dimension;
  maxWidth?: Dimension;
  maxHeight?: Dimension;
  maxSize?: Dimension;
  aspectRatio?: Dimension;
}

import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { CHART_LABEL_SIZE, CHART_TICK_SIZE, type ChartGeometry, type ChartSeries } from '../chart';
import { fontName, type KitPalette } from '../tokens';

export interface ChartPlotProps {
  geometry: ChartGeometry;
  series: readonly ChartSeries[];
  colors: readonly string[];
  barColor: (seriesIndex: number, index: number) => string;
  perBar: boolean;
  palette: KitPalette;
  width: number;
  height: number;
  showYAxis: boolean;
  active?: number;
  uid: string;
}

type MarkProps = Pick<ChartPlotProps, 'geometry' | 'series' | 'colors' | 'barColor' | 'perBar' | 'active' | 'uid'>;

const DASH = '3 3';
const LINE_WIDTH = 2;
const DOT_RADIUS = 3;
const ACTIVE_BAR_OPACITY = 0.8;
const Y_LABEL_MARGIN = 2;
const BASELINE_SHIFT = 0.35;

function crisp(value: number): number {
  return Math.round(value) + 0.5;
}

function Gradients({ series, colors, uid }: Pick<ChartPlotProps, 'series' | 'colors' | 'uid'>): React.ReactElement {
  return (
    <Defs>
      {series.map((s, i) => {
        const color = colors[i] ?? '#000000';
        if (s.type === 'line') return null;
        const [top, bottom, end] = s.type === 'area' ? [0.9, 0.6, '0.95'] : [1, 0.9, '1'];
        return (
          <LinearGradient key={i} id={`${uid}${s.type}${i}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={top} />
            <Stop offset={end} stopColor={color} stopOpacity={bottom} />
          </LinearGradient>
        );
      })}
    </Defs>
  );
}

function Grid({ geometry, palette, showYAxis }: Pick<ChartPlotProps, 'geometry' | 'palette' | 'showYAxis'>): React.ReactElement {
  const { plot, ticks } = geometry;
  const last = ticks.length - 1;
  return (
    <G>
      {ticks.map((tick, k) => (k === 0 || (k === last && !showYAxis) ? null : (
        <Line key={k} x1={plot.left} x2={plot.right} y1={crisp(tick.y)} y2={crisp(tick.y)}
          stroke={palette.border} strokeWidth={1} strokeDasharray={DASH} />
      )))}
      <Line x1={plot.left} x2={plot.right} y1={crisp(plot.bottom)} y2={crisp(plot.bottom)} stroke={palette.border} strokeWidth={1} />
    </G>
  );
}

function Label({ x, y, anchor, palette, children }: { x: number; y: number; anchor: 'middle' | 'end'; palette: KitPalette; children: string }): React.ReactElement {
  return (
    <SvgText x={x} y={y} textAnchor={anchor} fill={palette.sub} fontSize={CHART_LABEL_SIZE} fontFamily={fontName.sans}>
      {children}
    </SvgText>
  );
}

function Axes({ geometry, palette, showYAxis }: Pick<ChartPlotProps, 'geometry' | 'palette' | 'showYAxis'>): React.ReactElement {
  const { plot, ticks, labels, labelY } = geometry;
  const left = crisp(plot.left);
  return (
    <G>
      {showYAxis ? (
        <G>
          <Line x1={left} x2={left} y1={plot.top} y2={plot.bottom} stroke={palette.border} strokeWidth={1} />
          {ticks.map((tick, k) => (
            <G key={k}>
              <Line x1={plot.left - CHART_TICK_SIZE} x2={plot.left} y1={crisp(tick.y)} y2={crisp(tick.y)} stroke={palette.border} strokeWidth={1} />
              <Label x={plot.left - CHART_TICK_SIZE - Y_LABEL_MARGIN} y={tick.y + CHART_LABEL_SIZE * BASELINE_SHIFT} anchor="end" palette={palette}>
                {tick.label}
              </Label>
            </G>
          ))}
        </G>
      ) : null}
      {labels.map((label) => <Label key={label.index} x={label.x} y={labelY} anchor="middle" palette={palette}>{label.text}</Label>)}
    </G>
  );
}

function Bars({ geometry, barColor, perBar, active, uid, index }: MarkProps & { index: number }): React.ReactElement {
  return (
    <G>
      {geometry.bars.filter((bar) => bar.series === index).map((bar) => {
        const color = barColor(index, bar.index);
        return (
          <Path key={bar.index} d={bar.path} fill={perBar ? color : `url(#${uid}bar${index})`}
            stroke={color} strokeWidth={1} fillOpacity={active === bar.index ? ACTIVE_BAR_OPACITY : 1} />
        );
      })}
    </G>
  );
}

function Curve({ geometry, colors, uid, index }: MarkProps & { index: number }): React.ReactElement | null {
  const shape = geometry.shapes.find((s) => s.series === index);
  const color = colors[index] ?? '#000000';
  if (shape === undefined) return null;
  return (
    <G>
      {shape.area === undefined ? null : <Path d={shape.area} fill={`url(#${uid}area${index})`} stroke="none" />}
      <Path d={shape.line} fill="none" stroke={color} strokeWidth={LINE_WIDTH} strokeLinejoin="round" strokeLinecap="round" />
      {shape.dots.map((dot, i) => <Circle key={i} cx={dot[0]} cy={dot[1]} r={LINE_WIDTH} fill={color} />)}
    </G>
  );
}

function ActiveDots({ geometry, colors, active }: Pick<ChartPlotProps, 'geometry' | 'colors' | 'active'>): React.ReactElement | null {
  if (active === undefined) return null;
  return (
    <G>
      {geometry.shapes.map((shape) => {
        const point = shape.points[active];
        return point === undefined ? null : (
          <Circle key={shape.series} cx={point[0]} cy={point[1]} r={DOT_RADIUS} fill={colors[shape.series] ?? '#000000'} />
        );
      })}
    </G>
  );
}

function Cursor({ geometry, palette, active }: Pick<ChartPlotProps, 'geometry' | 'palette' | 'active'>): React.ReactElement | null {
  const category = active === undefined ? undefined : geometry.categories[active];
  if (category === undefined) return null;
  const x = crisp(category.x);
  return <Line x1={x} x2={x} y1={geometry.plot.top} y2={geometry.plot.bottom} stroke={palette.border} strokeWidth={1} />;
}

export function ChartPlot(props: ChartPlotProps): React.ReactElement {
  const { series, width, height } = props;
  return (
    <Svg width={width} height={height}>
      <Gradients series={series} colors={props.colors} uid={props.uid} />
      <Grid geometry={props.geometry} palette={props.palette} showYAxis={props.showYAxis} />
      <Cursor geometry={props.geometry} palette={props.palette} active={props.active} />
      {series.map((s, i) => (s.type === 'bar' ? <Bars key={i} {...props} index={i} /> : <Curve key={i} {...props} index={i} />))}
      <ActiveDots geometry={props.geometry} colors={props.colors} active={props.active} />
      <Axes geometry={props.geometry} palette={props.palette} showYAxis={props.showYAxis} />
    </Svg>
  );
}

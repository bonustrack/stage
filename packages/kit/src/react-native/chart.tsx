import { useId, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Platform, Pressable, View, type DimensionValue, type LayoutChangeEvent, type TextStyle, type ViewStyle } from 'react-native';
import {
  CHART_DEFAULTS, CHART_MARGIN, chartAspectRatio, chartBarColor, chartGeometry, chartSeriesColors, chartTooltipRows,
  chartXLabel, type ChartCategory, type ChartDatum, type ChartSeries, type ChartXAxis,
} from '../chart';
import { OVERLAY_SHADOW } from '../overlay.styles';
import { kitPalette, type KitPalette, type Scheme } from '../tokens';
import { Row } from './box';
import { ChartPlot } from './chart.plot';
import { Text } from './text';
import { useKitPalette, useKitScheme } from './theme-context';
import { TOOLTIP } from './tooltip';

export type {
  ChartAreaSeries, ChartBarSeries, ChartColor, ChartCurveType, ChartDatum, ChartLineSeries, ChartSeries, ChartValue,
  ChartXAxis, ChartXAxisConfig,
} from '../chart';

type Length = number | string;

export interface ChartProps {
  data: readonly ChartDatum[];
  series: readonly ChartSeries[];
  xAxis: ChartXAxis;
  showYAxis?: boolean;
  showLegend?: boolean;
  showTooltip?: boolean;
  barGap?: number;
  barCategoryGap?: number;
  flex?: number;
  height?: Length;
  width?: Length;
  size?: Length;
  minHeight?: Length;
  minWidth?: Length;
  minSize?: Length;
  maxHeight?: Length;
  maxWidth?: Length;
  maxSize?: Length;
  aspectRatio?: number | string;
  dark?: boolean;
  style?: ViewStyle;
}

interface Size {
  width: number;
  height: number;
}

const IS_WEB = Platform.OS === 'web';
const LEGEND_PAD_TOP = 12;
const LEGEND_LINE = 20;
const LEGEND_GAP = 16;
const LEGEND_HEIGHT = LEGEND_PAD_TOP + LEGEND_LINE + CHART_MARGIN;
const KEY_GAP = 6;
const LEGEND_SWATCH = 8;
const TOOLTIP_SWATCH = 10;
const SWATCH_RADIUS = 2;
const TIP_OFFSET = 12;
const TIP_PAD_X = 10;
const TIP_PAD_Y = 6;
const TIP_ROW_GAP = 6;
const TIP_NAME_GAP = 12;
const TABULAR: TextStyle = { fontVariant: ['tabular-nums'] };

function useChartTheme(dark: boolean | undefined): { scheme: Scheme; palette: KitPalette } {
  const contextScheme = useKitScheme();
  const contextPalette = useKitPalette();
  if (dark === undefined || (dark ? 'dark' : 'light') === contextScheme) return { scheme: contextScheme, palette: contextPalette };
  const scheme = dark ? 'dark' : 'light';
  return { scheme, palette: kitPalette(scheme) };
}

function boxStyle(props: ChartProps): ViewStyle {
  const height = props.height ?? props.size;
  return {
    width: (props.width ?? props.size ?? '100%') as DimensionValue,
    height: height as DimensionValue | undefined,
    aspectRatio: height === undefined ? chartAspectRatio(props.aspectRatio) : undefined,
    minWidth: (props.minWidth ?? props.minSize) as DimensionValue | undefined,
    minHeight: (props.minHeight ?? props.minSize) as DimensionValue | undefined,
    maxWidth: (props.maxWidth ?? props.maxSize) as DimensionValue | undefined,
    maxHeight: (props.maxHeight ?? props.maxSize) as DimensionValue | undefined,
    flex: props.flex,
  };
}

function initialSize(props: ChartProps, legend: boolean): Size | undefined {
  const width = props.width ?? props.size;
  const height = props.height ?? props.size;
  if (typeof width !== 'number') return undefined;
  const total = height ?? width / chartAspectRatio(props.aspectRatio);
  return typeof total === 'number' ? { width, height: Math.max(0, total - (legend ? LEGEND_HEIGHT : 0)) } : undefined;
}

function Swatch({ color, size }: { color: string; size: number }): React.ReactElement {
  return <View style={{ width: size, height: size, borderRadius: SWATCH_RADIUS, backgroundColor: color }} />;
}

function Legend({ series, colors, palette }: { series: readonly ChartSeries[]; colors: readonly string[]; palette: KitPalette }): React.ReactElement {
  return (
    <Row wrap justify="center" gap={LEGEND_GAP} padding={{ top: LEGEND_PAD_TOP, bottom: CHART_MARGIN }}>
      {series.map((s, i) => (s.label === undefined || s.label === '' ? null : (
        <Row key={i} gap={KEY_GAP} align="center">
          <Swatch color={colors[i] ?? palette.link} size={LEGEND_SWATCH} />
          <Text size="2xs" color={palette.link} value={s.label} style={{ lineHeight: LEGEND_LINE }} />
        </Row>
      )))}
    </Row>
  );
}

interface TooltipProps {
  props: ChartProps;
  colors: readonly string[];
  palette: KitPalette;
  category: ChartCategory;
  index: number;
  width: number;
  top: number;
}

function ChartTooltip({ props, colors, palette, category, index, width, top }: TooltipProps): React.ReactElement | null {
  const row = props.data[index];
  const rows = chartTooltipRows(props.series, row);
  const title = chartXLabel(props.xAxis, row);
  if (rows.length === 0 && title === '') return null;
  const side: ViewStyle = category.x <= width / 2 ? { left: category.x + TIP_OFFSET } : { right: width - category.x + TIP_OFFSET };
  return (
    <View style={{
      position: 'absolute', top, ...side, maxWidth: Math.max(TIP_OFFSET, width / 2 - TIP_OFFSET), pointerEvents: 'none',
      backgroundColor: palette.border, borderRadius: TOOLTIP.radius, paddingHorizontal: TIP_PAD_X, paddingVertical: TIP_PAD_Y,
      gap: TIP_ROW_GAP, ...OVERLAY_SHADOW,
    }}>
      {title === '' ? null : <Text size="3xs" weight="semibold" color={palette.sub} value={title} />}
      {rows.map((r) => (
        <Row key={r.series} gap={KEY_GAP} align="center">
          {props.series.length > 1 ? <Swatch color={colors[r.series] ?? palette.link} size={TOOLTIP_SWATCH} /> : null}
          {r.name === undefined ? null : <Text size="3xs" color={palette.sub} value={r.name} style={{ flexShrink: 1 }} />}
          <Text size="3xs" color={palette.link} value={r.value} style={{ ...TABULAR, marginLeft: r.name === undefined ? 0 : TIP_NAME_GAP }} />
        </Row>
      ))}
    </View>
  );
}

function HoverBands({ categories, height, setActive }: { categories: readonly ChartCategory[]; height: number; setActive: Dispatch<SetStateAction<number | undefined>> }): React.ReactElement {
  return (
    <>
      {categories.map((c, i) => (
        <Pressable key={i} accessible={false} tabIndex={-1}
          style={{ position: 'absolute', top: 0, left: c.start, width: Math.max(1, c.end - c.start), height, cursor: 'auto' }}
          onHoverIn={() => { setActive(i); }}
          onHoverOut={() => { setActive((current) => (current === i ? undefined : current)); }}
          onPress={() => { setActive((current) => (IS_WEB || current !== i ? i : undefined)); }} />
      ))}
    </>
  );
}

interface ChartModel {
  colors: string[];
  legend: boolean;
  showYAxis: boolean;
  showTooltip: boolean;
  perBar: boolean;
}

function useChartModel(props: ChartProps, scheme: Scheme): ChartModel {
  const { series } = props;
  const colors = useMemo(() => chartSeriesColors(series.map((s) => s.color), scheme), [series, scheme]);
  const only = series.length === 1 ? series[0] : undefined;
  return {
    colors,
    legend: (props.showLegend ?? CHART_DEFAULTS.showLegend) && series.some((s) => s.label !== undefined && s.label !== ''),
    showYAxis: props.showYAxis ?? CHART_DEFAULTS.showYAxis,
    showTooltip: props.showTooltip ?? CHART_DEFAULTS.showTooltip,
    perBar: only?.type === 'bar' && only.color === undefined,
  };
}

interface BodyProps {
  props: ChartProps;
  model: ChartModel;
  palette: KitPalette;
  size: Size;
}

function ChartBody({ props, model, palette, size }: BodyProps): React.ReactElement {
  const { data, series, xAxis, barGap, barCategoryGap } = props;
  const { colors, legend, showYAxis, showTooltip, perBar } = model;
  const [active, setActive] = useState<number | undefined>();
  const uid = `chart${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const geometry = useMemo(() => chartGeometry({
    data, series, xAxis, width: size.width, height: size.height, showYAxis, legend, barGap, barCategoryGap,
  }), [data, series, xAxis, size, showYAxis, legend, barGap, barCategoryGap]);
  const shown = showTooltip && active !== undefined ? geometry.categories[active] : undefined;
  return (
    <>
      <ChartPlot geometry={geometry} series={series} colors={colors} perBar={perBar} palette={palette}
        barColor={(seriesIndex, index) => chartBarColor(series, colors, seriesIndex, index)}
        width={size.width} height={size.height} showYAxis={showYAxis} active={shown === undefined ? undefined : active} uid={uid} />
      {showTooltip ? <HoverBands categories={geometry.categories} height={size.height} setActive={setActive} /> : null}
      {shown === undefined || active === undefined ? null : (
        <ChartTooltip props={props} colors={colors} palette={palette} category={shown} index={active} width={size.width} top={geometry.plot.top} />
      )}
    </>
  );
}

export function Chart(props: ChartProps): React.ReactElement {
  const { scheme, palette } = useChartTheme(props.dark);
  const model = useChartModel(props, scheme);
  const [size, setSize] = useState<Size | undefined>(() => initialSize(props, model.legend));
  const onLayout = (e: LayoutChangeEvent): void => {
    const { width, height } = e.nativeEvent.layout;
    setSize((current) => (current?.width === width && current.height === height ? current : { width, height }));
  };
  return (
    <View style={[boxStyle(props), props.style]}>
      <View style={{ flex: 1 }} onLayout={onLayout}>
        {size === undefined ? null : <ChartBody props={props} model={model} palette={palette} size={size} />}
      </View>
      {model.legend ? <Legend series={props.series} colors={model.colors} palette={palette} /> : null}
    </View>
  );
}

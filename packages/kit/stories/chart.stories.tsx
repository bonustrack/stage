import type { Story } from '../gallery/story';
import { CHART_COLORS, CHART_CURVE_TYPES, type ChartCurveType } from '../src/chart';
import { Chart, type ChartDatum, type ChartSeries } from '../src/react-native/chart';
import { Col, Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, number, select, text } from './_controls';

export default { title: 'Chart' };

const MONTHS: ChartDatum[] = [
  { month: 'Jan', web: 186, mobile: 80, desktop: 42 },
  { month: 'Feb', web: 305, mobile: 200, desktop: 61 },
  { month: 'Mar', web: 237, mobile: 120, desktop: 55 },
  { month: 'Apr', web: 73, mobile: 190, desktop: 38 },
  { month: 'May', web: 209, mobile: 130, desktop: 70 },
  { month: 'Jun', web: 214, mobile: 140, desktop: 66 },
];

const DAYS: ChartDatum[] = [
  { day: 'mon', visits: 32 }, { day: 'tue', visits: 48 }, { day: 'wed', visits: 41 }, { day: 'thu', visits: 63 },
  { day: 'fri', visits: 58 }, { day: 'sat', visits: 24 }, { day: 'sun', visits: 19 },
];

const DAY_LABELS = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };

const BALANCE: ChartDatum[] = [
  { quarter: 'Q1', profit: 42 }, { quarter: 'Q2', profit: -18 }, { quarter: 'Q3', profit: 27 }, { quarter: 'Q4', profit: -6 },
];

type SeriesType = ChartSeries['type'];

interface ChartStoryArgs {
  type: SeriesType;
  stacked: boolean;
  seriesCount: number;
  curveType: ChartCurveType;
  showYAxis: boolean;
  showLegend: boolean;
  showTooltip: boolean;
  hideXAxis: boolean;
  barGap: number;
  barCategoryGap: number;
  aspectRatio: string;
  height: number;
}

const KEYS = [['web', 'Web'], ['mobile', 'Mobile'], ['desktop', 'Desktop']] as const;

function seriesOf(type: SeriesType, count: number, stacked: boolean, curveType: ChartCurveType): ChartSeries[] {
  return KEYS.slice(0, Math.max(1, Math.min(KEYS.length, count))).map(([dataKey, label]): ChartSeries => {
    const stack = stacked ? 'total' : undefined;
    if (type === 'line') return { type, dataKey, label, curveType };
    if (type === 'area') return { type, dataKey, label, curveType, stack };
    return { type, dataKey, label, stack };
  });
}

export const Controls: Story<ChartStoryArgs> = (args) => (
  <Col maxWidth={560}>
    <Chart
      data={MONTHS}
      series={seriesOf(args.type, args.seriesCount, args.stacked, args.curveType)}
      xAxis={{ dataKey: 'month', hide: args.hideXAxis }}
      showYAxis={args.showYAxis} showLegend={args.showLegend} showTooltip={args.showTooltip}
      barGap={args.barGap} barCategoryGap={args.barCategoryGap > 0 ? args.barCategoryGap : undefined}
      aspectRatio={args.aspectRatio} height={args.height > 0 ? args.height : undefined}
    />
  </Col>
);
Controls.args = {
  type: 'bar', stacked: false, seriesCount: 2, curveType: 'natural', showYAxis: false, showLegend: true, showTooltip: true,
  hideXAxis: false, barGap: 3, barCategoryGap: 0, aspectRatio: '4/3', height: 0,
};
Controls.argTypes = {
  type: select(['bar', 'line', 'area']), stacked: bool, seriesCount: select([1, 2, 3]), curveType: select(CHART_CURVE_TYPES),
  showYAxis: bool, showLegend: bool, showTooltip: bool, hideXAxis: bool, barGap: number, barCategoryGap: number,
  aspectRatio: text, height: number,
};

function Sample({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <Col gap={8} width={360}>
      <Text size="xs" weight="semibold" value={title} />
      {children}
    </Col>
  );
}

export const Types: Story = () => (
  <Row gap={24} wrap>
    <Sample title="Bar">
      <Chart data={MONTHS} xAxis="month" series={[{ type: 'bar', dataKey: 'web', label: 'Web' }, { type: 'bar', dataKey: 'mobile', label: 'Mobile' }]} />
    </Sample>
    <Sample title="Line">
      <Chart data={MONTHS} xAxis="month" series={[{ type: 'line', dataKey: 'web', label: 'Web' }, { type: 'line', dataKey: 'mobile', label: 'Mobile' }]} />
    </Sample>
    <Sample title="Area">
      <Chart data={MONTHS} xAxis="month" series={[{ type: 'area', dataKey: 'web', label: 'Web' }]} />
    </Sample>
    <Sample title="Bar and line">
      <Chart data={MONTHS} xAxis="month" showYAxis
        series={[{ type: 'bar', dataKey: 'web', label: 'Web' }, { type: 'line', dataKey: 'mobile', label: 'Mobile', color: 'orange' }]} />
    </Sample>
  </Row>
);

export const Stacked: Story = () => (
  <Row gap={24} wrap>
    <Sample title="Stacked bars">
      <Chart data={MONTHS} xAxis="month" showYAxis series={KEYS.map(([dataKey, label]): ChartSeries => ({ type: 'bar', dataKey, label, stack: 'all' }))} />
    </Sample>
    <Sample title="Stacked areas">
      <Chart data={MONTHS} xAxis="month" series={KEYS.map(([dataKey, label]): ChartSeries => ({ type: 'area', dataKey, label, stack: 'all' }))} />
    </Sample>
  </Row>
);

export const Axes: Story = () => (
  <Row gap={24} wrap>
    <Sample title="One series, colour per bar, labels map">
      <Chart data={DAYS} xAxis={{ dataKey: 'day', labels: DAY_LABELS }} series={[{ type: 'bar', dataKey: 'visits' }]} />
    </Sample>
    <Sample title="Hidden x axis, y axis, no legend">
      <Chart data={DAYS} xAxis={{ dataKey: 'day', hide: true }} showYAxis showLegend={false}
        series={[{ type: 'area', dataKey: 'visits', label: 'Visits', color: 'green', curveType: 'monotone' }]} />
    </Sample>
    <Sample title="Negative values">
      <Chart data={BALANCE} xAxis="quarter" showYAxis series={[{ type: 'bar', dataKey: 'profit', label: 'Profit', color: 'purple' }]} />
    </Sample>
    <Sample title="Fixed height">
      <Chart data={MONTHS} xAxis="month" height={180} series={[{ type: 'line', dataKey: 'desktop', label: 'Desktop', color: { light: 'blue-600', dark: 'blue-300' } }]} />
    </Sample>
  </Row>
);

export const Colors: Story = () => (
  <Col gap={8} maxWidth={560}>
    <Chart
      data={MONTHS} xAxis="month" aspectRatio="16/9"
      series={CHART_COLORS.map((color): ChartSeries => ({ type: 'bar', dataKey: 'web', label: color, color }))}
    />
  </Col>
);

export const Curves: Story = () => (
  <Row gap={16} wrap>
    {CHART_CURVE_TYPES.map((curveType) => (
      <Sample key={curveType} title={curveType}>
        <Chart data={MONTHS} xAxis="month" showLegend={false} aspectRatio={2}
          series={[{ type: 'area', dataKey: 'mobile', curveType }, { type: 'line', dataKey: 'web', curveType }]} />
      </Sample>
    ))}
  </Row>
);


import { useState } from 'react';
import type { ReactElement } from 'react';
import { Text as RNText, View, type LayoutChangeEvent } from 'react-native';
import { G, Line, Path, Rect, Svg, Text as SvgText } from 'react-native-svg';
import type { ChartNode } from '../kit';
import {
  areaPathD,
  chartAxisColor,
  chartBars,
  chartGeometry,
  chartLegend,
  chartLines,
  chartTextColor,
  chartXTickLabels,
  formatTick,
  linePathD,
  CHART_DEFAULT_HEIGHT,
} from '../kit';
import type { RenderCtx } from './kit-render-shared';

function chartHeight(node: ChartNode): number {
  return typeof node.height === 'number' ? node.height : CHART_DEFAULT_HEIGHT;
}

export function KitChart({
  node,
  ctx,
}: {
  node: ChartNode;
  ctx: RenderCtx;
}): ReactElement {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent): void => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };
  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {width > 0 ? (
        <>
          <ChartSvg node={node} ctx={ctx} width={width} />
          {node.showLegend === true ? (
            <ChartLegend node={node} ctx={ctx} />
          ) : null}
        </>
      ) : (
        <View style={{ height: chartHeight(node) }} />
      )}
    </View>
  );
}

function ChartSvg({
  node,
  ctx,
  width,
}: {
  node: ChartNode;
  ctx: RenderCtx;
  width: number;
}): ReactElement {
  const g = chartGeometry(node, width);
  const axis = chartAxisColor(ctx.scheme);
  const textColor = chartTextColor(ctx.scheme);
  const bars = chartBars(node, g, ctx.scheme);
  const areas = chartLines(node, g, ctx.scheme, 'area');
  const lines = chartLines(node, g, ctx.scheme, 'line');
  const xTicks = chartXTickLabels(node);
  const baseY = g.plotTop + g.plotHeight;
  return (
    <Svg width={width} height={g.height}>
      {g.showYAxis
        ? g.yTicks.map((t, i) => (
            <G key={`y${i}`}>
              <Line
                x1={g.plotLeft}
                y1={t.y}
                x2={g.plotLeft + g.plotWidth}
                y2={t.y}
                stroke={axis}
                strokeWidth={1}
                opacity={0.5}
              />
              <SvgText
                x={g.plotLeft - 6}
                y={t.y + 3}
                fontSize={10}
                fill={textColor}
                textAnchor="end"
              >
                {formatTick(t.value)}
              </SvgText>
            </G>
          ))
        : null}
      <Line
        x1={g.plotLeft}
        y1={baseY}
        x2={g.plotLeft + g.plotWidth}
        y2={baseY}
        stroke={axis}
        strokeWidth={1}
      />
      {areas.map((a, i) => (
        <Path
          key={`a${i}`}
          d={areaPathD(a.points, a.baseY)}
          fill={a.color}
          opacity={0.25}
        />
      ))}
      {bars.map((b, i) => (
        <Rect
          key={`b${i}`}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          fill={b.color}
          rx={2}
        />
      ))}
      {lines.concat(areas).map((l, i) => (
        <Path
          key={`l${i}`}
          d={linePathD(l.points)}
          stroke={l.color}
          strokeWidth={2}
          fill="none"
        />
      ))}
      {xTicks?.map((t, i) => (
        <SvgText
          key={`x${i}`}
          x={g.plotLeft + t.x * g.bandWidth + g.bandWidth / 2}
          y={g.height - 10}
          fontSize={10}
          fill={textColor}
          textAnchor="middle"
        >
          {t.label}
        </SvgText>
      ))}
    </Svg>
  );
}

function ChartLegend({
  node,
  ctx,
}: {
  node: ChartNode;
  ctx: RenderCtx;
}): ReactElement {
  const items = chartLegend(node, ctx.scheme);
  const textColor = chartTextColor(ctx.scheme);
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 8,
        justifyContent: 'center',
      }}
    >
      {items.map((item, i) => (
        <View
          key={i}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: item.color,
            }}
          />
          <RNText style={{ color: textColor, fontSize: 12 }}>{item.label}</RNText>
        </View>
      ))}
    </View>
  );
}

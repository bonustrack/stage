/** Activity chart — 24-hour rolling bar histogram of visible events. */

import { useMemo } from 'react';
import { View, useColorScheme } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { bucketByHour, type BucketEvent } from '../../_shared/charts/activity-buckets';
import { getStationIcon } from '../../_shared/icons/stations';

const HEIGHT = 48;
const GAP = 1;
const HOURS = 24;

export function ActivityChart({ events }: { events: ReadonlyArray<BucketEvent> }): React.ReactElement | null {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const buckets = useMemo(() => bucketByHour(events, HOURS), [events]);
  const peak = useMemo(() => buckets.reduce((m, b) => Math.max(m, b.count), 0), [buckets]);
  if (peak === 0) return null;

  /** Mirror Tailwind palette: metro-hover-dark / metro-hover-light + metro-border-*. */
  const surface = dark ? '#1d2230' : '#eef1f7';
  const border = dark ? '#262c38' : '#e3e7ef';

  return (
    <View
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        backgroundColor: dark ? '#0f1115' : '#ffffff',
        borderBottomWidth: 1,
        borderBottomColor: border,
      }}
    >
      <View
        style={{
          width: '100%',
          height: HEIGHT,
          backgroundColor: surface,
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${HOURS * 10} ${HEIGHT}`} preserveAspectRatio="none">
          {buckets.map((b, i) => {
            const h = Math.max(2, Math.round((b.count / peak) * (HEIGHT - 4)));
            const x = i * 10 + GAP;
            const w = 10 - GAP * 2;
            const y = HEIGHT - h - 2;
            const fill = b.count === 0
              ? (dark ? '#262c38' : '#dfe4ee')
              : getStationIcon(b.dominantStation).color;
            return <Rect key={i} x={x} y={y} width={w} height={h} rx={1.5} fill={fill} />;
          })}
        </Svg>
      </View>
    </View>
  );
}

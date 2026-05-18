import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { getStationIcon } from '../../_shared/icons/stations';

/** Brand-coloured 24x24 SVG marker. Visual parity with apps/ui Vue version. */
export function StationIcon({ station, withLabel = false, size = 18 }: {
  station: string; withLabel?: boolean; size?: number;
}): React.ReactElement {
  const def = getStationIcon(station);
  const padding = size <= 18 ? 3 : 4;
  const tile = (
    <View
      style={{
        width: size + padding * 2, height: size + padding * 2,
        backgroundColor: def.color, borderRadius: (size + padding * 2) / 4,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {def.path === null
          ? <Circle cx="12" cy="12" r="6" fill="#0f1115" />
          : <Path d={def.path} fill="#ffffff" />}
      </Svg>
    </View>
  );
  if (!withLabel) return tile;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {tile}
      <Text style={{ fontSize: 13, fontWeight: '600' }}>{def.label}</Text>
    </View>
  );
}

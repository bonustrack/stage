import { Text, View } from 'react-native';
import { getStationIcon } from '../../_shared/icons/stations';

const GLYPHS: Record<string, string> = {
  discord: 'DC',
  telegram: 'TG',
  webhook: 'WH',
  claude: 'CL',
  codex: 'CX',
};

/** Brand-coloured pill used as a station marker. */
/** Pulls colour from apps/_shared/icons; falls back to a generic gray pill. */
export function StationIcon({ station, withLabel = false }: {
  station: string; withLabel?: boolean;
}): React.ReactElement {
  const def = getStationIcon(station);
  const glyph = GLYPHS[station] ?? station.slice(0, 2).toUpperCase();
  if (!withLabel) {
    return (
      <Text
        style={{
          fontSize: 10, fontWeight: '700', color: def.fg, backgroundColor: def.color,
          paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
        }}
      >
        {glyph}
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text
        style={{
          fontSize: 10, fontWeight: '700', color: def.fg, backgroundColor: def.color,
          paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden',
        }}
      >
        {glyph}
      </Text>
      <Text style={{ fontSize: 13, fontWeight: '600' }}>{def.label}</Text>
    </View>
  );
}

import { Text } from 'react-native';
import type { KnownStation } from '../lib/types';

const GLYPH: Record<KnownStation, string> = {
  discord: 'DC',
  telegram: 'TG',
  webhook: 'WH',
  claude: 'CL',
  codex: 'CX',
};

/** Two-letter pill used as a station marker in the activity feed. */
export function StationIcon({ station }: { station: string }): React.ReactElement {
  const label = GLYPH[station as KnownStation] ?? station.slice(0, 2).toUpperCase();
  return (
    <Text
      style={{
        fontSize: 10,
        fontWeight: '700',
        color: '#0f1115',
        backgroundColor: '#a3b8d8',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {label}
    </Text>
  );
}

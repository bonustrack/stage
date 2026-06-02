/** Status-log rendering for the Node bridge ping probe.
 *
 *  Renders the ordered lifecycle lines the bridge emits via the diagnostics
 *  sink (starting Node runtime…, Node booted ✓, request sent →, reply ← pong,
 *  rx event: <name>, timed out / error ✗) as a compact monospace list so the
 *  whole boot→reply sequence fits in one on-device screenshot. */
import { Text } from '@metro-labs/kit/text';
import { Col } from '../layout';

/** One timestamped status line: ms elapsed since the run started + the text. */
export interface LogLine { ms: number; line: string }

function tone(line: string, sub: string): string {
  if (line.includes('✗')) return '#ff5c5c';
  if (line.includes('✓') || line.startsWith('reply ← pong')) return '#3fb950';
  return sub;
}

export function PingLog({ lines, sub }: {
  lines: LogLine[]; sub: string;
}): React.ReactElement | null {
  if (lines.length === 0) return null;
  return (
    <Col gap={2} mt={4}>
      {lines.map((l, i) => (
        <Text
          key={`${i}-${l.ms}`}
          style={{
            color: tone(l.line, sub),
            fontSize: 11,
            fontFamily: 'Calibre-Medium',
          }}
        >
          {`+${l.ms}ms  ${l.line}`}
        </Text>
      ))}
    </Col>
  );
}

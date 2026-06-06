/** Status-log rendering for the Node bridge ping probe.
 *
 *  Renders the ordered lifecycle lines the bridge emits via the diagnostics
 *  sink (starting Node runtime…, Node booted ✓, request sent →, reply ← pong,
 *  rx event: <name>, timed out / error ✗) as a compact monospace list so the
 *  whole boot→reply sequence fits in one on-device screenshot. */
import { FlatList, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@metro-labs/kit/text';
import { Col, Row } from '../layout';
import { DANGER, SUCCESS } from '../../lib/theme';
import { flash } from '../../lib/toast';

/** One timestamped status line: ms elapsed since the run started + the text. */
export interface LogLine { ms: number; line: string }

/** Render a single log line to the plain text used for selection + clipboard. */
function fmtLine(l: LogLine): string { return `+${l.ms}ms  ${l.line}`; }

function tone(line: string, sub: string): string {
  if (line.includes('✗')) return DANGER;
  if (line.includes('✓') || line.startsWith('reply ← pong')) return SUCCESS;
  return sub;
}

/** Copy all log lines to the clipboard as plain text + flash a confirmation. */
function copyAll(lines: LogLine[]): void {
  void Clipboard.setStringAsync(lines.map(fmtLine).join('\n'));
  flash('Logs copied');
}

export function PingLog({ lines, sub, head, border }: {
  lines: LogLine[]; sub: string; head?: string; border?: string;
}): React.ReactElement | null {
  if (lines.length === 0) return null;
  return (
    <Col gap={2} mt={4}>
      <Row mt={2} mb={2} style={{ justifyContent: 'flex-end' }}>
        <Pressable
          onPress={() => copyAll(lines)}
          hitSlop={8}
          accessibilityLabel="Copy scan logs"
          style={{
            paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8,
            borderWidth: 1, borderColor: border ?? sub,
          }}
        >
          <Text style={{ color: head ?? sub, fontSize: 12, fontFamily: 'Calibre-Semibold' }}>
            Copy
          </Text>
        </Pressable>
      </Row>
      <FlatList
        data={lines}
        keyExtractor={(l, i) => `${i}-${l.ms}`}
        style={{ maxHeight: 280 }}
        initialNumToRender={20}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item }) => (
          <Text
            selectable
            style={{
              color: tone(item.line, sub),
              fontSize: 11,
              fontFamily: 'Calibre-Medium',
            }}
          >
            {fmtLine(item)}
          </Text>
        )}
      />
    </Col>
  );
}

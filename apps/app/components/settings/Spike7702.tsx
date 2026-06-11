/** DEV-ONLY screen for the EIP-7702 + Kernel v3 de-risk spike. Reached via
 *  Settings -> Experimental -> "7702 spike". Runs lib/smartAccount.spike.runSpike
 *  and streams each StepResult on-screen (also logged to console). Nothing here
 *  ships into a production path - it is a manual proof harness on Sepolia. */

import { useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Box, Col, Row } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { useBlockRadius, useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { SystemHeader } from '../system/SystemHeader';
import { runSpike, SPIKE_META, type StepResult } from '../../lib/smartAccount.spike';

const STATUS_GLYPH: Record<StepResult['status'], string> = {
  pass: 'PASS', fail: 'FAIL', skip: 'SKIP',
};

export function Spike7702(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, border } = usePalette();
  const sub = fg;
  const insets = useSafeAreaInsets();
  const radius = useBlockRadius();
  const [results, setResults] = useState<StepResult[]>([]);
  const [running, setRunning] = useState(false);

  const onRun = (): void => {
    setResults([]);
    setRunning(true);
    void runSpike((r) => setResults((prev) => [...prev, r]))
      .finally(() => setRunning(false));
  };

  return (
    <Col surface="surface" flex={1}>
      <SystemHeader title="7702 spike" dark={dark} fg={fg} head={head} border={border}/>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
        <Text size="xs" role="secondary" style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          {`SEPOLIA - STAGE ${SPIKE_META.stageToken.slice(0, 8)}... - ${SPIKE_META.hasRpc ? 'ZeroDev RPC set' : `set ${SPIKE_META.rpcEnvVar} for on-chain steps`}`}
        </Text>

        <Box radius={radius} surface="raised" padding={14} margin={{ x: 16, top: 8 }}
          style={{ borderWidth: 1, borderColor: border }}
>
          <Pressable onPress={onRun} disabled={running}>
            <Row align="center" gap={10}>
              {running ? <ActivityIndicator/> : null}
              <Text weight="semibold" size="md" color={head}>
                {running ? 'Running spike...' : 'Run 7702 spike'}
              </Text>
            </Row>
          </Pressable>
          <Text size="xs" role="secondary" style={{ marginTop: 4 }}>
            Proves: 7702 authorization signing, Kernel v3.3 delegation, session key, recovery, XMTP identity intact. Uses a fresh test-mnemonic account + sponsored paymaster (no real funds).
          </Text>
        </Box>

        {results.map((r) => (
          <Box key={r.step} radius={radius} surface="raised" padding={14} margin={{ x: 16, top: 8 }}
            style={{ borderWidth: 1, borderColor: border }}
>
            <Row align="center" gap={8}>
              <Text weight="semibold" size="sm" color={r.status === 'fail' ? '#e5484d' : r.status === 'skip' ? sub : head}>
                {STATUS_GLYPH[r.status]}
              </Text>
              <Text weight="semibold" size="md" color={head} style={{ flex: 1 }}>
                {`${r.step}. ${r.name}`}
              </Text>
            </Row>
            <Text size="xs" role="secondary" style={{ marginTop: 4 }}>{r.detail}</Text>
            {r.data ? Object.entries(r.data).map(([k, v]) => (
              <Text key={k} size="xs" role="secondary" style={{ marginTop: 2 }}>{`${k}: ${v}`}</Text>
            )) : null}
          </Box>
        ))}
      </ScrollView>
    </Col>
  );
}

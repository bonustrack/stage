import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from '../layout';
import { usePalette, withAlpha } from '../../lib/theme';

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatLocal(iso: string): string {
  if (iso.length === 0) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resolveBuildInfo(): { hash: string; time: string; channel: string | null } {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const rawHash = typeof extra.gitHash === 'string' && extra.gitHash.length > 0 ? extra.gitHash : 'dev';
  const rawTime = typeof extra.commitTime === 'string' ? extra.commitTime : '';
  return {
    hash: rawHash === 'dev' ? 'dev' : rawHash.slice(0, 7),
    time: formatLocal(rawTime),
    channel: typeof Updates.channel === 'string' && Updates.channel.length > 0 ? Updates.channel : null,
  };
}

export function BuildInfoDot(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { text, bg, border } = usePalette();
  const insets = useSafeAreaInsets();
  const { hash, time, channel } = resolveBuildInfo();
  const head = time.length > 0 ? `${hash} · ${time}` : hash;

  return (
    <Box pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => { setOpen(false); }} /> : null}
      <Box pointerEvents="box-none" style={{ position: 'absolute', left: 10, bottom: insets.bottom + 10 }}>
        {open ? (
          <Box
            background={withAlpha(bg, 0.96)}
            margin={{ bottom: 8 }}
            padding={{ x: 10, y: 7 }}
            style={{
              maxWidth: 260,
              borderColor: border,
              borderWidth: StyleSheet.hairlineWidth,
              borderRadius: 8,
            }}
>
            <Text size="xs" weight="medium">{head}</Text>
            {channel !== null ? (
              <Text size="xs" variant="secondary" style={{ marginTop: 2 }}>{`channel: ${channel}`}</Text>
            ) : null}
          </Box>
        ) : null}
        <Pressable
          hitSlop={12}
          onPress={() => { setOpen((v) => !v); }}
          style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: withAlpha(text, open ? 0.6 : 0.32) }}
        />
      </Box>
    </Box>
  );
}

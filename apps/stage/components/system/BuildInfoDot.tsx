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

function formatRelative(iso: string, now: number): string {
  if (iso.length === 0) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function resolveBuildInfo(now: number): { hash: string; time: string; relative: string; channel: string | null } {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const rawHash = typeof extra.gitHash === 'string' && extra.gitHash.length > 0 ? extra.gitHash : 'dev';
  const rawTime = typeof extra.commitTime === 'string' ? extra.commitTime : '';
  return {
    hash: rawHash === 'dev' ? 'dev' : rawHash.slice(0, 7),
    time: formatLocal(rawTime),
    relative: formatRelative(rawTime, now),
    channel: typeof Updates.channel === 'string' && Updates.channel.length > 0 ? Updates.channel : null,
  };
}

export function BuildInfoDot(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { text, bg, border } = usePalette();
  const insets = useSafeAreaInsets();
  const { hash, time, relative, channel } = resolveBuildInfo(Date.now());
  const head = relative.length > 0 ? `${hash} · ${relative}` : hash;

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
            {time.length > 0 ? (
              <Text size="xs" variant="secondary" style={{ marginTop: 2 }}>{time}</Text>
            ) : null}
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

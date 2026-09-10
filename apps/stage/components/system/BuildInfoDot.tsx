import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@stage-labs/kit/react-native/text';
import { Box } from '../layout';
import { usePalette, withAlpha } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { commitUrl } from '../../lib/githubRepo';

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

const FRESH_BUILD_MS = 30 * 60 * 1000;

function isFresh(iso: string, now: number): boolean {
  if (iso.length === 0) return false;
  const then = new Date(iso).getTime();
  return !Number.isNaN(then) && now - then < FRESH_BUILD_MS;
}

interface BuildInfo {
  hash: string; time: string; relative: string; channel: string | null; href: string | undefined; fresh: boolean;
}

function resolveBuildInfo(now: number): BuildInfo {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const rawHash = typeof extra.gitHash === 'string' && extra.gitHash.length > 0 ? extra.gitHash : 'dev';
  const rawTime = typeof extra.commitTime === 'string' ? extra.commitTime : '';
  return {
    hash: rawHash === 'dev' ? 'dev' : rawHash.slice(0, 7),
    href: commitUrl(rawHash),
    time: formatLocal(rawTime),
    relative: formatRelative(rawTime, now),
    fresh: isFresh(rawTime, now),
    channel: typeof Updates.channel === 'string' && Updates.channel.length > 0 ? Updates.channel : null,
  };
}

const ABOVE_ALL_CHROME = 100;

export function BuildInfoDot(): React.ReactElement {
  const [open, setOpen] = useState(false);
  const { text, bg, border, primary } = usePalette();
  const insets = useSafeAreaInsets();
  const { hash, time, relative, channel, href, fresh } = resolveBuildInfo(Date.now());
  const dotColor = fresh ? primary : withAlpha(text, open ? 0.6 : 0.32);
  const head = relative.length > 0 ? `${hash} · ${relative}` : hash;
  const openCommit = href === undefined ? undefined : (): void => { setOpen(false); capabilities.openUrl(href); };

  return (
    <Box pointerEvents="box-none" style={{ ...StyleSheet.absoluteFillObject, zIndex: ABOVE_ALL_CHROME }}>
      {open ? <Pressable style={StyleSheet.absoluteFill} onPress={() => { setOpen(false); }} /> : null}
      <Box pointerEvents="box-none" style={{ position: 'absolute', left: 10, bottom: insets.bottom + 10 }}>
        {open ? (
          <Pressable
            onPress={openCommit}
            disabled={openCommit === undefined}
            style={{
              maxWidth: 260,
              marginBottom: 8,
              paddingHorizontal: 10,
              paddingVertical: 7,
              backgroundColor: withAlpha(bg, 0.96),
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
          </Pressable>
        ) : null}
        <Pressable
          hitSlop={12}
          onPress={() => { setOpen((v) => !v); }}
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dotColor }}
        />
      </Box>
    </Box>
  );
}

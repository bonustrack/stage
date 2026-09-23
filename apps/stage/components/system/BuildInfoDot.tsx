import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Box, viewportFill } from '../layout';
import { usePalette, withAlpha } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { buildMeta, commitUrl } from '../../lib/githubRepo';
import { RailTooltip } from '../tabs/RailTooltip';

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
  hash: string; relative: string; channel: string | null; href: string | undefined; fresh: boolean;
}

function resolveBuildInfo(now: number): BuildInfo {
  const { gitHash: rawHash, commitTime: rawTime } = buildMeta();
  return {
    hash: rawHash === 'dev' ? 'dev' : rawHash.slice(0, 7),
    href: commitUrl(rawHash),
    relative: formatRelative(rawTime, now),
    fresh: isFresh(rawTime, now),
    channel: typeof Updates.channel === 'string' && Updates.channel.length > 0 ? Updates.channel : null,
  };
}

const ABOVE_ALL_CHROME = 100;
const DOT = 8;

function buildLabel(info: BuildInfo): string {
  return [info.hash, info.relative, info.channel === null ? '' : `channel ${info.channel}`]
    .filter((part) => part.length > 0)
    .join(' · ');
}

export function BuildInfoDot(): React.ReactElement {
  const { text, primary } = usePalette();
  const insets = useSafeAreaInsets();
  const info = resolveBuildInfo(Date.now());
  const dotColor = info.fresh ? primary : withAlpha(text, 0.32);
  const openCommit = (): void => { if (info.href !== undefined) capabilities.openUrl(info.href); };

  return (
    <Box pointerEvents="box-none" style={viewportFill(ABOVE_ALL_CHROME)}>
      <Box pointerEvents="box-none" style={{ position: 'absolute', left: 10, bottom: insets.bottom + 10 }}>
        <RailTooltip label={buildLabel(info)} placement="beside" onPress={openCommit} style={{ padding: 6 }}>
          <Box size={DOT} radius="full" background={dotColor} />
        </RailTooltip>
      </Box>
    </Box>
  );
}

/** Rich preview card for a github.com repo / PR / issue link found in a message
 *  body. Rendered as a bordered, transparent container (matching the metro://
 *  channel card look - 1px theme border, rounded, no background fill), with the
 *  real GitHub mark via `GithubLogo`.
 *
 *  Metadata is fetched (unauthenticated) through `useGithubMeta`; while it's
 *  loading OR on any failure (private 404, rate-limit 403, network) the hook
 *  returns null and we render NOTHING - the plain text link stays as-is, never a
 *  broken/empty card. Detection is done by the caller via `githubLinkOf`. */

import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from './layout';
import { GithubLogo } from './GithubLogo';
import { githubLinkOf } from '../lib/githubDetect';
import { useGithubMeta } from '../lib/useGithubMeta';
import { DANGER, SUCCESS, usePalette, useBlockRadius } from '../lib/theme';

/** state → dot color (open green, merged purple, closed red). */
const DOT: Record<string, string> = {
  open: SUCCESS, merged: '#a371f7', closed: DANGER,
};

const fmt = (n: number): string => n.toLocaleString('en-US');

export function GitHubLinkCard({ url }: {
  /** `dark` is accepted for call-site symmetry but no longer needed - all colors
   *  now come from the live palette tokens. */
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const ref = githubLinkOf(url);
  const meta = useGithubMeta(ref);
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  if (!ref || !meta) return null;

  const fg = pal.link; // #ffffff / #000000
  // muted metadata text; no `muted` token yet → map to `text`. TODO: muted token.
  const subColor = pal.text;
  const border = pal.border; // #282a2d / #e4e4e5
  const dot = DOT[meta.state];
  const numLabel = meta.number != null ? `#${meta.number}` : null;
  const showLoc = meta.kind === 'pull'
    && (meta.additions != null || meta.deletions != null);

  return (
    <Pressable onPress={() => void Linking.openURL(url)}>
      <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, backgroundColor: 'transparent', paddingHorizontal: 12, paddingVertical: 10 }}>
        <Row align="center" justify="start" style={{ marginBottom: 4 }}>
          <GithubLogo size={16} color={fg} />
          <Text size="xs" style={{ color: subColor, marginLeft: 6 }}>
            {meta.repo}{numLabel ? ` · ${numLabel}` : ''}
          </Text>
        </Row>
        <Text weight="semibold" size="xl"
          style={{ color: fg }}
          numberOfLines={2}
        >
          {meta.title}
        </Text>
        {meta.description ? (
          <Text size="md"
            style={{ color: subColor, lineHeight: 21, marginTop: 3 }}
            numberOfLines={2}
          >
            {meta.description}
          </Text>
        ) : null}
        <Row align="center" justify="start" style={{ marginTop: 6 }}>
          {dot ? (
            <Box style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: dot, marginRight: 6 }} />
          ) : null}
          {meta.state ? (
            <Text size="xs" style={{ color: subColor, textTransform: 'capitalize' }}>
              {meta.state}
            </Text>
          ) : null}
          {meta.kind === 'repo' && meta.stars != null ? (
            <Text size="xs" style={{ color: subColor }}>
              ★ {meta.stars}
            </Text>
          ) : null}
          {meta.author ? (
            <Text size="xs" style={{ color: subColor, marginLeft: meta.state ? 8 : 0 }}>
              {meta.author}
            </Text>
          ) : null}
          {showLoc && meta.additions != null ? (
            <Text weight="semibold" size="xs" style={{ color: SUCCESS, marginLeft: 8 }}>
              +{fmt(meta.additions)}
            </Text>
          ) : null}
          {showLoc && meta.deletions != null ? (
            <Text weight="semibold" size="xs" style={{ color: DANGER, marginLeft: 6 }}>
              −{fmt(meta.deletions)}
            </Text>
          ) : null}
        </Row>
      </Box>
    </Pressable>
  );
}

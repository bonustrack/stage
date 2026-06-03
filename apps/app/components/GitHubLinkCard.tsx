/** Rich preview card for a github.com repo / PR / issue link found in a message
 *  body. Reuses the shared `MediaCard` frame for visual consistency with the
 *  YouTube / location embeds, and shows the real GitHub mark via `GithubLogo`.
 *
 *  Metadata is fetched (unauthenticated) through `useGithubMeta`; while it's
 *  loading OR on any failure (private 404, rate-limit 403, network) the hook
 *  returns null and we render NOTHING — the plain text link stays as-is, never a
 *  broken/empty card. Detection is done by the caller via `githubLinkOf`. */

import { Linking } from 'react-native';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from './layout';
import { MediaCard } from './MediaCard';
import { GithubLogo } from './GithubLogo';
import { githubLinkOf } from '../lib/githubDetect';
import { useGithubMeta } from '../lib/useGithubMeta';

/** state → dot color (open green, merged purple, closed red). */
const DOT: Record<string, string> = {
  open: '#3fb950', merged: '#a371f7', closed: '#f85149',
};

export function GitHubLinkCard({ url, dark }: {
  url: string; dark: boolean;
}): React.ReactElement | null {
  const ref = githubLinkOf(url);
  const meta = useGithubMeta(ref);
  if (!ref || !meta) return null;

  const fg = dark ? '#ffffff' : '#000000';
  const subColor = dark ? '#7a7a7e' : '#8a929d';
  const dot = DOT[meta.state];
  const numLabel = meta.number != null ? `#${meta.number}` : null;

  return (
    <MediaCard dark={dark} onPress={() => void Linking.openURL(url)}>
      <Box style={{ paddingHorizontal: 12, paddingVertical: 10 }}>
        <Row align="center" justify="start" style={{ marginBottom: 4 }}>
          <GithubLogo size={16} color={fg} />
          <Text style={{ color: subColor, fontSize: 11, fontFamily: 'Calibre-Medium', marginLeft: 6 }}>
            {meta.repo}{numLabel ? ` · ${numLabel}` : ''}
          </Text>
        </Row>
        <Text
          style={{ color: fg, fontSize: 15, fontFamily: 'Calibre-Semibold', lineHeight: 19 }}
          numberOfLines={2}
        >
          {meta.title}
        </Text>
        {meta.description ? (
          <Text
            style={{ color: subColor, fontSize: 12, fontFamily: 'Calibre-Medium', marginTop: 3 }}
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
            <Text style={{ color: subColor, fontSize: 11, fontFamily: 'Calibre-Medium', textTransform: 'capitalize' }}>
              {meta.state}
            </Text>
          ) : null}
          {meta.kind === 'repo' && meta.stars != null ? (
            <Text style={{ color: subColor, fontSize: 11, fontFamily: 'Calibre-Medium' }}>
              ★ {meta.stars}
            </Text>
          ) : null}
          {meta.author ? (
            <Text style={{ color: subColor, fontSize: 11, fontFamily: 'Calibre-Medium', marginLeft: meta.state ? 8 : 0 }}>
              {meta.author}
            </Text>
          ) : null}
        </Row>
      </Box>
    </MediaCard>
  );
}

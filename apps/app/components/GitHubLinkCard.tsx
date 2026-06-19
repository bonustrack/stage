/**
 * @file Rich preview card for a github.com repo/PR/issue link in a message body:
 *  bordered transparent container with the GitHub mark and metadata from
 *  useGithubMeta, rendering nothing while loading or on any fetch failure.
 */

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

/** Fmt helper. */
const fmt = (n: number): string => n.toLocaleString('en-US');

/** Renders a rich preview card for a GitHub repo/PR/issue link, or nothing while loading or on failure. */
export function GitHubLinkCard({ url }: {
  /** `dark` is accepted for call-site symmetry but no longer needed - all colors now come from the live palette tokens. */
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
      <Box background={'transparent'} padding={{ x: 12, y: 10 }} radius={blockRadius} style={{ borderWidth: 1, borderColor: border }}>
        <Row margin={{ bottom: 4 }} align="center" justify="start">
          <GithubLogo size={16} color={fg}/>
          <Text size="3xs" color={subColor} style={{ marginLeft: 6 }}>
            {meta.repo}{numLabel ? ` · ${numLabel}` : ''}
          </Text>
        </Row>
        <Text weight="semibold" size="4xl"
          numberOfLines={2}>
          {meta.title}
        </Text>
        {meta.description ? (
          <Text size="md" color={subColor} style={{ lineHeight: 21, marginTop: 3 }}
            numberOfLines={2}>
            {meta.description}
          </Text>
        ) : null}
        <Row margin={{ top: 6 }} align="center" justify="start">
          {dot ? (
            <Box width={8} height={8} radius="full" background={dot} margin={{ right: 6 }}/>
          ) : null}
          {meta.state ? (
            <Text size="3xs" color={subColor} style={{ textTransform: 'capitalize' }}>
              {meta.state}
            </Text>
          ) : null}
          {meta.kind === 'repo' && meta.stars != null ? (
            <Text size="3xs" color={subColor}>
              ★ {meta.stars}
            </Text>
          ) : null}
          {meta.author ? (
            <Text size="3xs" color={subColor} style={{ marginLeft: meta.state ? 8 : 0 }}>
              {meta.author}
            </Text>
          ) : null}
          {showLoc && meta.additions != null ? (
            <Text weight="semibold" size="3xs" color={SUCCESS} style={{ marginLeft: 8 }}>
              +{fmt(meta.additions)}
            </Text>
          ) : null}
          {showLoc && meta.deletions != null ? (
            <Text weight="semibold" size="3xs" color={DANGER} style={{ marginLeft: 6 }}>
              −{fmt(meta.deletions)}
            </Text>
          ) : null}
        </Row>
      </Box>
    </Pressable>
  );
}

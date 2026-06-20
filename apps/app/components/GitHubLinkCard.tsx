
import { Linking } from 'react-native';

import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Box, Row } from './layout';
import { GithubLogo } from './GithubLogo';
import { githubLinkOf } from '../lib/githubDetect';
import { useGithubMeta } from '../lib/useGithubMeta';
import { DANGER, SUCCESS, usePalette, useBlockRadius } from '../lib/theme';

const DOT: Record<string, string> = {
  open: SUCCESS, merged: '#a371f7', closed: DANGER,
};

const fmt = (n: number): string => n.toLocaleString('en-US');

type GithubMeta = NonNullable<ReturnType<typeof useGithubMeta>>;

function GithubDiffStats({ meta }: { meta: GithubMeta }): React.ReactElement | null {
  if (meta.kind !== 'pull' || (meta.additions == null && meta.deletions == null)) return null;
  return (
    <>
      {meta.additions != null ? (
        <Text weight="semibold" size="3xs" color={SUCCESS} style={{ marginLeft: 8 }}>+{fmt(meta.additions)}</Text>
      ) : null}
      {meta.deletions != null ? (
        <Text weight="semibold" size="3xs" color={DANGER} style={{ marginLeft: 6 }}>−{fmt(meta.deletions)}</Text>
      ) : null}
    </>
  );
}

function GithubFooter({ meta, subColor }: { meta: GithubMeta; subColor: string }): React.ReactElement {
  const dot = DOT[meta.state];
  return (
    <Row margin={{ top: 6 }} align="center" justify="start">
      {dot ? (
        <Box width={8} height={8} radius="full" background={dot} margin={{ right: 6 }}/>
      ) : null}
      {meta.state ? (
        <Text size="3xs" color={subColor} style={{ textTransform: 'capitalize' }}>{meta.state}</Text>
      ) : null}
      {meta.kind === 'repo' && meta.stars != null ? (
        <Text size="3xs" color={subColor}>★ {meta.stars}</Text>
      ) : null}
      {meta.author ? (
        <Text size="3xs" color={subColor} style={{ marginLeft: meta.state ? 8 : 0 }}>{meta.author}</Text>
      ) : null}
      <GithubDiffStats meta={meta} />
    </Row>
  );
}

export function GitHubLinkCard({ url }: {
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const ref = githubLinkOf(url);
  const meta = useGithubMeta(ref);
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  if (!ref || !meta) return null;

  const subColor = pal.text;
  const numLabel = meta.number != null ? `#${meta.number}` : null;

  return (
    <Pressable onPress={() => void Linking.openURL(url)}>
      <Box background={'transparent'} padding={{ x: 12, y: 10 }} radius={blockRadius} style={{ borderWidth: 1, borderColor: pal.border }}>
        <Row margin={{ bottom: 4 }} align="center" justify="start">
          <GithubLogo size={16} color={pal.link}/>
          <Text size="3xs" color={subColor} style={{ marginLeft: 6 }}>
            {meta.repo}{numLabel ? ` · ${numLabel}` : ''}
          </Text>
        </Row>
        <Text weight="semibold" size="4xl" numberOfLines={2}>
          {meta.title}
        </Text>
        {meta.description ? (
          <Text size="md" color={subColor} style={{ lineHeight: 21, marginTop: 3 }} numberOfLines={2}>
            {meta.description}
          </Text>
        ) : null}
        <GithubFooter meta={meta} subColor={subColor} />
      </Box>
    </Pressable>
  );
}

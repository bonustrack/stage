
import { Text } from '@stage-labs/kit/react-native/text';
import { Box, Row } from './layout';
import { GithubLogo } from './GithubLogo';
import { githubLinkOf } from '@stage-labs/client/api/github';
import { useGithubMeta } from '../lib/useGithubMeta';
import { DANGER, SUCCESS, usePalette } from '../lib/theme';
import { OutlinedLinkCard } from './LinkPreviewCard';
import { TEXT_11PX } from './smallText';

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
        <Text weight="semibold" color={SUCCESS} style={[TEXT_11PX, { marginLeft: 8 }]}>+{fmt(meta.additions)}</Text>
      ) : null}
      {meta.deletions != null ? (
        <Text weight="semibold" color={DANGER} style={[TEXT_11PX, { marginLeft: 6 }]}>−{fmt(meta.deletions)}</Text>
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
        <Text color={subColor} style={[TEXT_11PX, { textTransform: 'capitalize' }]}>{meta.state}</Text>
      ) : null}
      {meta.kind === 'repo' && meta.stars != null ? (
        <Text color={subColor} style={TEXT_11PX}>★ {meta.stars}</Text>
      ) : null}
      {meta.author ? (
        <Text color={subColor} style={[TEXT_11PX, { marginLeft: meta.state ? 8 : 0 }]}>{meta.author}</Text>
      ) : null}
      <GithubDiffStats meta={meta} />
    </Row>
  );
}

export function GitHubLinkCard({ url }: { url: string }): React.ReactElement | null {
  const ref = githubLinkOf(url);
  const meta = useGithubMeta(ref);
  const pal = usePalette();
  if (!ref || !meta) return null;

  const subColor = pal.text;
  const numLabel = meta.number != null ? `#${meta.number}` : null;

  return (
    <OutlinedLinkCard url={url} padding={{ x: 12, y: 10 }}>
      <Row margin={{ bottom: 4 }} align="center" justify="start">
        <GithubLogo size={16} color={pal.link}/>
        <Text color={subColor} style={[TEXT_11PX, { marginLeft: 6 }]}>
          {meta.repo}{numLabel ? ` · ${numLabel}` : ''}
        </Text>
      </Row>
      <Text weight="semibold" size="3xl" numberOfLines={2}>
        {meta.title}
      </Text>
      {meta.description ? (
        <Text size="sm" color={subColor} style={{ lineHeight: 21, marginTop: 3 }} numberOfLines={2}>
          {meta.description}
        </Text>
      ) : null}
      <GithubFooter meta={meta} subColor={subColor} />
    </OutlinedLinkCard>
  );
}

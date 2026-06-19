/** @file In-app GitHub PR diff viewer that parses a channel's linked GitHub URL, fetches the per-file diff, and renders it GitHub-style. */

import { ActivityIndicator, Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { ListView } from '@metro-labs/kit/list-view';
import { Box, Row, Col } from '../components/layout';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { openInBubbleLink } from '../lib/safeOpenLink';
import { githubLinkOf } from '../lib/githubDetect';
import { useGithubDiff } from '../lib/useGithubDiff';
import { FileDiff } from '../components/FileDiff';
import Markdown from 'react-native-markdown-display';
import { mdParser } from '../lib/mdParser';
import { diffMarkdownStyles } from '../lib/diffMarkdownStyles';
import type { GithubDiff } from '../lib/useGithubDiff';
import type { GithubRef } from '../lib/githubDetect';
import type { Palette } from '../lib/theme';

interface MdProps {
  markdownit: typeof mdParser;
  style: ReturnType<typeof diffMarkdownStyles>;
  onLinkPress: (href: string) => boolean;
}

/** Body of the diff scroll view: dispatches loading/error/empty/diff states. */
function DiffBody({ ref, diff, isLoading, isError, p, dark, mdProps }: {
  ref: GithubRef | null; diff: GithubDiff | null; isLoading: boolean; isError: boolean;
  p: Palette; dark: boolean; mdProps: MdProps;
}): React.ReactElement {
  if (!ref) return <Text color={p.text} style={{ opacity: 0.7, paddingHorizontal: 12 }}>No GitHub link is set for this channel.</Text>;
  if (isLoading) return <Box padding={{ y: 40 }} align="center"><ActivityIndicator color={p.link} /></Box>;
  if (isError) return <Text color={p.text} style={{ opacity: 0.7, paddingHorizontal: 12 }}>Could not load the diff (private repo or GitHub rate limit). Open it on GitHub from the link icon above.</Text>;
  if (diff?.kind === 'no-pr') return <DiffNoPr diff={diff} p={p} mdProps={mdProps}/>;
  if (diff?.files.length === 0) return <Text color={p.text} style={{ opacity: 0.7, paddingHorizontal: 12 }}>No file changes in this pull request.</Text>;
  return <DiffFiles diff={diff} p={p} dark={dark} mdProps={mdProps}/>;
}

/** Issue-with-no-linked-PR view: title, body and an explanatory note. */
function DiffNoPr({ diff, p, mdProps }: { diff: GithubDiff; p: Palette; mdProps: MdProps }): React.ReactElement {
  const body = diff.body?.trim();
  return (
    <Box padding={{ x: 12 }}>
      {diff.title ? (
        <Text weight="semibold" size="5xl" color={p.text} style={{ lineHeight: 32, marginBottom: body ? 10 : 10 }}>
          {diff.title}
        </Text>
      ) : null}
      {body ? (
        <Box margin={{ bottom: 10 }}>
          <Markdown {...mdProps}>{body}</Markdown>
        </Box>
      ) : null}
      <Text color={p.text} style={{ opacity: 0.7 }}>This link points to an issue with no linked pull request yet.</Text>
    </Box>
  );
}

/** Pull the header-relevant fields off a (possibly null) diff. */
function headerFields(diff: GithubDiff | null): {
  title: string; body: string; fileCount: number; additions: number; deletions: number;
} {
  if (!diff) return { title: '', body: '', fileCount: 0, additions: 0, deletions: 0 };
  return {
    title: diff.title ?? '',
    body: diff.body?.trim() ?? '',
    fileCount: diff.files.length,
    additions: diff.additions,
    deletions: diff.deletions,
  };
}

/** PR header: title, body and the change summary row. */
function DiffFilesHeader({ diff, p, mdProps }: { diff: GithubDiff | null; p: Palette; mdProps: MdProps }): React.ReactElement {
  const { title, body, fileCount, additions, deletions } = headerFields(diff);
  return (
    <Box padding={{ x: 12 }}>
      {title ? (
        <Text weight="semibold" size="5xl" color={p.text} style={{ lineHeight: 32, marginBottom: body ? 10 : 12 }}>
          {title}
        </Text>
      ) : null}
      {body ? (
        <Box margin={{ bottom: 12 }}>
          <Markdown {...mdProps}>{body}</Markdown>
        </Box>
      ) : null}
      <Row padding={{ x: 2 }} margin={{ bottom: 12 }} align="center" gap={12}>
        <Text size="xs" color={p.text} style={{ opacity: 0.6 }}>
          {fileCount} {fileCount === 1 ? 'file' : 'files'} changed
        </Text>
        <Text weight="semibold" size="md" role="success">+{additions}</Text>
        <Text weight="semibold" size="md" role="danger">-{deletions}</Text>
      </Row>
    </Box>
  );
}

/** PR view: title, body, change summary and the per-file diff list. */
function DiffFiles({ diff, p, dark, mdProps }: { diff: GithubDiff | null; p: Palette; dark: boolean; mdProps: MdProps }): React.ReactElement {
  return (
    <>
      <DiffFilesHeader diff={diff} p={p} mdProps={mdProps}/>
      <ListView dark={dark} style={{ borderTopWidth: 1, borderTopColor: p.border }}>
        {(diff?.files ?? []).map(f => <FileDiff key={f.filename} file={f} p={p} dark={dark} />)}
      </ListView>
    </>
  );
}

/** Screen rendering a markdown diff view of pending changes. */
export default function Diff(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { url } = useLocalSearchParams<{ url?: string }>();

  /**
   * Disable the app's full-width swipe-back (the JS card stack's interactive
   *  horizontal pan, armed from anywhere via gestureResponseDistance:9999 in
   *  _layout). On this page it captured vertical pans and starved the diff
   *  ScrollView, so the page wouldn't scroll. The header back arrow still pops
   *  the route, so losing the gesture here is fine.
   */
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
  }, [navigation]);

  const ref = githubLinkOf(url);
  const { diff, isLoading, isError } = useGithubDiff(ref);
  const mdStyle = diffMarkdownStyles(p, dark);
  const mdProps = {
    markdownit: mdParser,
    style: mdStyle,
    onLinkPress: (href: string) => openInBubbleLink(href),
  };
  const prUrl = diff?.kind === 'ok' && diff.prNumber
    ? `https://github.com/${diff.owner}/${diff.repo}/pull/${diff.prNumber}`
    : (url ?? '');

  return (
    <Col surface="surface" flex={1}>
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: p.border }}>
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={p.text}/>
        </Pressable>
        <Title size="sm" style={{ flex: 1 }} numberOfLines={1}>
          Changes
        </Title>
        {prUrl ? (
          <Pressable onPress={() => { void Linking.openURL(prUrl); }} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="link" size={20} color={p.link}/>
          </Pressable>
        ) : null}
      </Row>

      <ScrollView contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 + insets.bottom }}>
        <DiffBody ref={ref} diff={diff} isLoading={isLoading} isError={isError} p={p} dark={dark} mdProps={mdProps}/>
      </ScrollView>
    </Col>
  );
}

/** In-app PR diff viewer - opened by tapping a channel topnav's GitHub icon.
 *  Receives the channel's linked GitHub URL (`url` param), parses it to an
 *  owner/repo + PR (or issue -> linked PR) ref, fetches the per-file diff from
 *  the GitHub REST API and renders it GitHub-style via FileDiff. A link icon in
 *  the top-right of the topnav opens the PR on GitHub. Issues with no linked PR
 *  show a graceful message. All text uses the Calibre font family. */

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

export default function Diff(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { url } = useLocalSearchParams<{ url?: string }>();

  /** Disable the app's full-width swipe-back (the JS card stack's interactive
   *  horizontal pan, armed from anywhere via gestureResponseDistance:9999 in
   *  _layout). On this page it captured vertical pans and starved the diff
   *  ScrollView, so the page wouldn't scroll. The header back arrow still pops
   *  the route, so losing the gesture here is fine. */
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
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
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
        {!ref ? (
          <Text color={p.text} style={{ opacity: 0.7, paddingHorizontal: 12 }}>No GitHub link is set for this channel.</Text>
        ) : isLoading ? (
          <Box padding={{ y: 40 }} align="center"><ActivityIndicator color={p.link} /></Box>
        ) : isError ? (
          <Text color={p.text} style={{ opacity: 0.7, paddingHorizontal: 12 }}>Could not load the diff (private repo or GitHub rate limit). Open it on GitHub from the link icon above.</Text>
        ) : diff?.kind === 'no-pr' ? (
          <Box padding={{ x: 12 }}>
            {diff.title ? (
              <Text weight="semibold" size="5xl" color={p.text} style={{ lineHeight: 32, marginBottom: diff.body?.trim() ? 10 : 10 }}>
                {diff.title}
              </Text>
            ) : null}
            {diff.body?.trim() ? (
              <Box margin={{ bottom: 10 }}>
                <Markdown {...mdProps}>{diff.body.trim()}</Markdown>
              </Box>
            ) : null}
            <Text color={p.text} style={{ opacity: 0.7 }}>This link points to an issue with no linked pull request yet.</Text>
          </Box>
        ) : diff && diff.files.length === 0 ? (
          <Text color={p.text} style={{ opacity: 0.7, paddingHorizontal: 12 }}>No file changes in this pull request.</Text>
        ) : (
          <>
            <Box padding={{ x: 12 }}>
              {diff?.title ? (
                <Text weight="semibold" size="5xl" color={p.text} style={{ lineHeight: 32, marginBottom: diff?.body?.trim() ? 10 : 12 }}>
                  {diff.title}
                </Text>
              ) : null}
              {diff?.body?.trim() ? (
                <Box margin={{ bottom: 12 }}>
                  <Markdown {...mdProps}>{diff.body.trim()}</Markdown>
                </Box>
              ) : null}
              <Row padding={{ x: 2 }} margin={{ bottom: 12 }} align="center" gap={12}>
                <Text size="xs" color={p.text} style={{ opacity: 0.6 }}>
                  {diff?.files.length} {diff?.files.length === 1 ? 'file' : 'files'} changed
                </Text>
                <Text weight="semibold" size="md" role="success">+{diff?.additions ?? 0}</Text>
                <Text weight="semibold" size="md" role="danger">-{diff?.deletions ?? 0}</Text>
              </Row>
            </Box>
            <ListView dark={dark} style={{ borderTopWidth: 1, borderTopColor: p.border }}>
              {(diff?.files ?? []).map(f => <FileDiff key={f.filename} file={f} p={p} dark={dark} />)}
            </ListView>
          </>
        )}
      </ScrollView>
    </Col>
  );
}

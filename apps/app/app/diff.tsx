/** In-app PR diff viewer - opened by tapping a channel topnav's GitHub icon.
 *  Receives the channel's linked GitHub URL (`url` param), parses it to an
 *  owner/repo + PR (or issue -> linked PR) ref, fetches the per-file diff from
 *  the GitHub REST API and renders it GitHub-style via FileDiff. A link icon in
 *  the top-right of the topnav opens the PR on GitHub. Issues with no linked PR
 *  show a graceful message. All text uses the Calibre font family. */

import { ActivityIndicator, Linking, Pressable, ScrollView } from 'react-native';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { Icon } from '@metro-labs/kit/icon';
import { Box } from '../components/layout';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { useLayoutEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { githubLinkOf } from '../lib/githubDetect';
import { useGithubDiff } from '../lib/useGithubDiff';
import { FileDiff } from '../components/FileDiff';

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
  const prUrl = diff?.kind === 'ok' && diff.prNumber
    ? `https://github.com/${diff.owner}/${diff.repo}/pull/${diff.prNumber}`
    : (url ?? '');

  return (
    <Box style={{ flex: 1, backgroundColor: p.bg }}>
      <Box style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingTop: 8 + insets.top, paddingBottom: 10,
        borderBottomWidth: 1, borderBottomColor: p.border,
        backgroundColor: p.toolbarBg,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={p.text} />
        </Pressable>
        <Title dark={dark} style={{ color: p.link, fontSize: 20, flex: 1 }} numberOfLines={1}>
          Changes
        </Title>
        {prUrl ? (
          <Pressable onPress={() => { void Linking.openURL(prUrl); }} hitSlop={8} style={{ padding: 4 }}>
            <Icon name="link" size={20} color={p.link} />
          </Pressable>
        ) : null}
      </Box>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 + insets.bottom }}>
        {!ref ? (
          <Text style={{ color: p.text, opacity: 0.7, fontFamily: 'Calibre-Medium' }}>No GitHub link is set for this channel.</Text>
        ) : isLoading ? (
          <Box style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={p.link} /></Box>
        ) : isError ? (
          <Text style={{ color: p.text, opacity: 0.7, fontFamily: 'Calibre-Medium' }}>Could not load the diff (private repo or GitHub rate limit). Open it on GitHub from the link icon above.</Text>
        ) : diff?.kind === 'no-pr' ? (
          <>
            {diff.title ? (
              <Text style={{ color: p.text, fontFamily: 'Calibre-Semibold', fontSize: 22, lineHeight: 27, marginBottom: diff.body?.trim() ? 8 : 10 }}>
                {diff.title}
              </Text>
            ) : null}
            {diff.body?.trim() ? (
              <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginBottom: 10, fontFamily: 'Calibre-Medium' }}>{diff.body.trim()}</Text>
            ) : null}
            <Text style={{ color: p.text, opacity: 0.7, fontFamily: 'Calibre-Medium' }}>This link points to an issue with no linked pull request yet.</Text>
          </>
        ) : diff && diff.files.length === 0 ? (
          <Text style={{ color: p.text, opacity: 0.7, fontFamily: 'Calibre-Medium' }}>No file changes in this pull request.</Text>
        ) : (
          <>
            {diff?.title ? (
              <Text style={{ color: p.text, fontFamily: 'Calibre-Semibold', fontSize: 22, lineHeight: 27, marginBottom: diff?.body?.trim() ? 8 : 12 }}>
                {diff.title}
              </Text>
            ) : null}
            {diff?.body?.trim() ? (
              <Text style={{ color: p.text, fontSize: 14, lineHeight: 20, marginBottom: 12, fontFamily: 'Calibre-Medium' }}>
                {diff.body.trim()}
              </Text>
            ) : null}
            <Box style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, paddingHorizontal: 2 }}>
              <Text style={{ color: p.text, opacity: 0.6, fontSize: 13, fontFamily: 'Calibre-Medium' }}>
                {diff?.files.length} {diff?.files.length === 1 ? 'file' : 'files'} changed
              </Text>
              <Text style={{ color: p.success, fontFamily: 'Calibre-Semibold', fontSize: 14 }}>+{diff?.additions ?? 0}</Text>
              <Text style={{ color: p.danger, fontFamily: 'Calibre-Semibold', fontSize: 14 }}>-{diff?.deletions ?? 0}</Text>
            </Box>
            {diff?.files.map(f => <FileDiff key={f.filename} file={f} p={p} dark={dark} />)}
          </>
        )}
      </ScrollView>
    </Box>
  );
}

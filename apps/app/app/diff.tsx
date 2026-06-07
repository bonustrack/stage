/** In-app PR diff viewer - opened by tapping a channel topnav's GitHub icon.
 *  Receives the channel's linked GitHub URL (`url` param), parses it to an
 *  owner/repo + PR (or issue -> linked PR) ref, fetches the per-file diff from
 *  the GitHub REST API and renders it GitHub-style via FileDiff. A footer links
 *  out to the PR on GitHub. Issues with no linked PR show a graceful message. */

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
          {diff?.title ?? 'Changes'}
        </Title>
      </Box>

      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 24 + insets.bottom }}>
        {!ref ? (
          <Text style={{ color: p.text, opacity: 0.7 }}>No GitHub link is set for this channel.</Text>
        ) : isLoading ? (
          <Box style={{ paddingVertical: 40, alignItems: 'center' }}><ActivityIndicator color={p.link} /></Box>
        ) : isError ? (
          <Text style={{ color: p.text, opacity: 0.7 }}>Could not load the diff (private repo or GitHub rate limit). Open it on GitHub below.</Text>
        ) : diff?.kind === 'no-pr' ? (
          <Text style={{ color: p.text, opacity: 0.7 }}>This link points to an issue with no linked pull request yet.</Text>
        ) : diff && diff.files.length === 0 ? (
          <Text style={{ color: p.text, opacity: 0.7 }}>No file changes in this pull request.</Text>
        ) : (
          diff?.files.map(f => <FileDiff key={f.filename} file={f} p={p} dark={dark} />)
        )}
      </ScrollView>

      {prUrl ? (
        <Pressable
          onPress={() => { void Linking.openURL(prUrl); }}
          style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
            paddingVertical: 14, paddingBottom: 14 + insets.bottom,
            borderTopWidth: 1, borderTopColor: p.border,
          }}
        >
          <Icon name="link" size={18} color={p.link} />
          <Text style={{ color: p.link, fontFamily: 'Calibre-Semibold', fontSize: 15 }}>View on GitHub</Text>
        </Pressable>
      ) : null}
    </Box>
  );
}

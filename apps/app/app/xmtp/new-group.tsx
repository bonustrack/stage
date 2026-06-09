/** Create-group screen — a pushed (non-tab) route reached from the "+" button
 *  in the Channels topnav. Lets the user name the group (optional) and add
 *  members by Ethereum address or .eth name, then creates the XMTP group and
 *  opens it.
 *
 *  - Members are entered one at a time via the shared MemberPicker; .eth names
 *    are resolved via the same resolveEnsName path the Search screen uses.
 *    Resolved members render as removable chips.
 *  - Create is disabled until at least one valid member is staged. It calls
 *    createGroup(members, name) → router.replace into the new conversation.
 *  - Errors (invalid entry, address not on XMTP, create failure) flash a toast.
 */

import { useCallback, useState } from 'react';
import { fontSize } from '@metro-labs/kit/tokens';
import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Input } from '@metro-labs/kit/input';
import { Image } from '@metro-labs/kit/image';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@metro-labs/kit/text';
import { Title } from '@metro-labs/kit/title';
import { Icon } from '@metro-labs/kit/icon';
import { Button } from '@metro-labs/kit/button';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGroup } from '../../modules/messaging';
import { uploadAvatar } from '../../lib/profile';
import { flash } from '../../lib/toast';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Box, Col, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { MemberPicker, useMemberPicker } from './MemberPicker';

/** Locally-picked group image, held until create-time. We upload on submit
 *  (not on pick) so a cancelled create costs no blob; `uri` is the on-device
 *  asset uri used only for the preview. */
interface PickedImage { uri: string; mime: string; name: string }

export default function NewGroup(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border, primary, inputBg, toolbarBg } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const picker = useMemberPicker();
  const { members } = picker;
  const [creating, setCreating] = useState(false);
  const [image, setImage] = useState<PickedImage | null>(null);

  /** Same square-crop image-pick flow the group-detail editor uses; we only
   *  stage the asset here and upload it on create. */
  const pickImage = useCallback(async (): Promise<void> => {
    if (creating) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: false,
      allowsEditing: true, aspect: [1, 1],
    });
    if (r.canceled || !r.assets?.length) return;
    const a = r.assets[0]!;
    setImage({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'group-avatar' });
  }, [creating]);

  const onCreate = useCallback(async (): Promise<void> => {
    if (members.length === 0 || creating) return;
    setCreating(true);
    /** Upload first (so the url can be set in CreateGroupOptions). A failed
     *  upload doesn't block creation — we create imageless + warn. */
    let imageUrl: string | undefined;
    if (image) {
      try {
        imageUrl = await uploadAvatar(image.uri, image.mime, image.name);
      } catch {
        flash("Couldn't upload the group image — creating without it.");
      }
    }
    try {
      const { id } = await createGroup(members.map(m => m.address), name, imageUrl);
      router.replace({ pathname: '/xmtp/[convId]', params: { convId: id } });
    } catch (err) {
      flash((err as Error)?.message ?? "Couldn't create the group");
      setCreating(false);
    }
  }, [members, name, image, creating, router]);

  return (
    <Col flex={1} style={{ backgroundColor: bg }}>
      {/* Header — back button + title, consistent with other pushed screens. */}
      <Row padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border, backgroundColor: toolbarBg }}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg} />
        </Pressable>
        <Title size="sm" dark={dark} color={head}>
          New group
        </Title>
      </Row>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Group image (optional) — tap to pick, square preview. */}
        <Box align="center" gap={8}>
          <Pressable onPress={() => { void pickImage(); }} disabled={creating} hitSlop={8}>
            {image ? (
              <Image
                src={image.uri}
                style={{
                  width: 88, height: 88, borderRadius: Math.round(88 * 0.12),
                  backgroundColor: rowBg, opacity: creating ? 0.5 : 1,
                }}
              />
            ) : (
              <Box align="center" justify="center" style={{ width: 88, height: 88, borderRadius: Math.round(88 * 0.12), backgroundColor: rowBg, borderWidth: 1, borderColor: border }}>
                <Text size="6xl" color={sub}>＋</Text>
              </Box>
            )}
            {creating && image ? (
              <Box align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
                <Spinner size={20} color={fg} />
              </Box>
            ) : null}
          </Pressable>
          <Text size="xs" color={sub}>
            {image ? 'Tap to change image' : 'Tap to add a group image'}
          </Text>
        </Box>

        {/* Group name (optional) */}
        <Col gap={6}>
          <Text size="xs" color={sub}>
            Group name (optional)
          </Text>
          <Input
            value={name}
            onChangeText={setName}
            placeholder="e.g. Metro builders"
            placeholderTextColor={sub}
            dark={dark}
            style={{
              color: head, fontSize: fontSize('md'), fontFamily: 'Calibre-Medium',
              backgroundColor: inputBg, borderRadius: 12, paddingHorizontal: 14,
              paddingVertical: 12, borderWidth: 1, borderColor: border, minHeight: 0,
            }}
          />
        </Col>

        <MemberPicker state={picker} dark={dark} />
      </ScrollView>

      {/* Create */}
      <Box padding={{ top: 16, right: 16, bottom: 16 + insets.bottom, left: 16 }} style={{ borderTopWidth: 1, borderTopColor: border }}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          pill
          dark={dark}
          loading={creating}
          disabled={members.length === 0}
          onPress={() => { void onCreate(); }}
          tintBg={primary}
          tintFg={bg}
          label={members.length> 0 ? `Create group (${members.length})` : 'Create group'}
        />
      </Box>
    </Col>
  );
}

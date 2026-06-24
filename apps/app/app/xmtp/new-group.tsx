
import { useCallback, useState } from 'react';
import { fontSize } from '@stage-labs/kit/tokens';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Input } from '@stage-labs/kit/react-native/input';
import { Image } from '@stage-labs/kit/react-native/image';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Button } from '@stage-labs/kit/react-native/button';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createGroup } from '../../modules/messaging';
import { uploadAvatar } from '../../lib/profile';
import { flash } from '../../lib/toast';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { Box, Col, Row } from '../../components/layout';
import { Spinner } from '../../components/Spinner';
import { MemberPicker, useMemberPicker } from './MemberPicker';

interface PickedImage { uri: string; mime: string; name: string }

function GroupImageField({ image, creating, fg, border, rowBg, onPick }: {
  image: PickedImage | null; creating: boolean;
  fg: string; border: string; rowBg: string; onPick: () => void;
}): React.ReactElement {
  return (
    <Box align="center" gap={8}>
      <Pressable onPress={onPick} disabled={creating} hitSlop={8}>
        {image ? (
          <Image
            src={image.uri}
            style={{
              width: 88, height: 88, borderRadius: Math.round(88 * 0.12),
              backgroundColor: rowBg, opacity: creating ? 0.5 : 1,
            }}
/>
        ) : (
          <Box width={88} height={88} radius={Math.round(88 * 0.12)} surface="raised" align="center" justify="center" style={{ borderWidth: 1, borderColor: border }}>
            <Text size="6xl" role="secondary">＋</Text>
          </Box>
        )}
        {creating && image ? (
          <Box align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
            <Spinner size={20} color={fg}/>
          </Box>
        ) : null}
      </Pressable>
      <Text size="xs" role="secondary">
        {image ? 'Tap to change image' : 'Tap to add a group image'}
      </Text>
    </Box>
  );
}

export default function NewGroup(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const { text: fg, link: head, bg, border, primary, inputBg } = usePalette();
  const sub = fg;
  const rowBg = border;
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const picker = useMemberPicker();
  const { members } = picker;
  const [creating, setCreating] = useState(false);
  const [image, setImage] = useState<PickedImage | null>(null);

  const pickImage = useCallback(async (): Promise<void> => {
    if (creating) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', quality: 0.85, allowsMultipleSelection: false,
      allowsEditing: true, aspect: [1, 1],
    });
    const a = r.canceled ? undefined : r.assets[0];
    if (a === undefined) return;
    setImage({ uri: a.uri, mime: a.mimeType ?? 'image/jpeg', name: a.fileName ?? 'group-avatar' });
  }, [creating]);

  const onCreate = useCallback(async (): Promise<void> => {
    if (members.length === 0 || creating) return;
    setCreating(true);
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
    <Col surface="surface" flex={1}>
      {}
      <Row surface="toolbar" padding={{ x: 12, top: 8 + insets.top, bottom: 10 }} align="center" gap={8} style={{ borderBottomWidth: 1, borderBottomColor: border }}>
        <Pressable onPress={() => { router.back(); }} hitSlop={8} style={{ padding: 4 }}>
          <Icon name="arrowLeft" size={22} color={fg}/>
        </Pressable>
        <Title size="sm" color={head}>
          New group
        </Title>
      </Row>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
>
        {}
        <GroupImageField image={image} creating={creating} fg={fg} border={border} rowBg={rowBg}
          onPick={() => { void pickImage(); }}/>

        {}
        <Col gap={6}>
          <Text size="xs" role="secondary">
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

        <MemberPicker state={picker} dark={dark}/>
      </ScrollView>

      {}
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

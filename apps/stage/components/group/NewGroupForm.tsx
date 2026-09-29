import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Text } from '@stage-labs/kit/react-native/text';
import { createGroup } from '../../modules/messaging';
import { uploadAvatar } from '../../lib/profile';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { GroupImagePicker } from '../GroupImagePicker';
import { Box, Col } from '../layout';
import { FormField } from '../FormField';
import { Spinner } from '../Spinner';

export interface PickedImage { uri: string; mime: string; name: string }

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

export function GroupNameField({ name, setName }: { name: string; setName: (s: string) => void }): React.ReactElement {
  return <FormField label="Group name (optional)" placeholder="e.g. Stage builders" value={name} onChangeText={setName} />;
}

async function uploadGroupImage(image: PickedImage | null): Promise<string | undefined> {
  if (image === null) return undefined;
  try {
    return await uploadAvatar(image.uri, image.mime, image.name);
  } catch {
    capabilities.toast("Couldn't upload the group image. Creating without it.");
    return undefined;
  }
}

export async function createGroupLine(addresses: string[], name: string, image: PickedImage | null): Promise<string> {
  return (await createGroup(addresses, name, await uploadGroupImage(image))).line;
}

export function NewGroupDetails({ name, setName, image, setImage, creating }: {
  name: string; setName: (name: string) => void;
  image: PickedImage | null; setImage: (image: PickedImage) => void; creating: boolean;
}): React.ReactElement {
  const { text: fg, border } = usePalette();
  const [pickNonce, setPickNonce] = useState(0);
  return (
    <Col gap={16}>
      <GroupImageField image={image} creating={creating} fg={fg} border={border} rowBg={border}
        onPick={() => { if (!creating) setPickNonce(n => n + 1); }}/>
      <GroupImagePicker
        openNonce={pickNonce}
        onPick={(file) => { setImage({ uri: file.uri, mime: file.mime, name: file.name ?? 'group-avatar' }); }}
      />
      <GroupNameField name={name} setName={setName} />
    </Col>
  );
}

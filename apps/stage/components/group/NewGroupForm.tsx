import { useState } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Image } from '@stage-labs/kit/react-native/image';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { createGroup } from '../../modules/messaging';
import { uploadAvatar } from '../../lib/profile';
import { capabilities } from '../../lib/capabilities';
import { usePalette } from '../../lib/theme';
import { GroupImagePicker } from '../GroupImagePicker';
import { Box, Row } from '../layout';
import { FORM_FIELD_RADIUS, FormField, useFieldColors } from '../FormField';
import { Spinner } from '../Spinner';
import { IconImages1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconImages1';

export interface PickedImage { uri: string; mime: string; name: string }

const IMAGE_TILE = 65;

function GroupImageField({ image, creating, onPick }: {
  image: PickedImage | null; creating: boolean; onPick: () => void;
}): React.ReactElement {
  const { text: fg, sub } = usePalette();
  const { background } = useFieldColors();
  return (
    <Pressable onPress={onPick} disabled={creating} accessibilityRole="button"
      accessibilityLabel={image ? 'Change group image' : 'Add a group image'}
      style={{ width: IMAGE_TILE, borderRadius: FORM_FIELD_RADIUS, overflow: 'hidden', backgroundColor: background }}>
      {image ? (
        <Image src={image.uri} style={{ width: '100%', height: '100%', opacity: creating ? 0.5 : 1 }} />
      ) : (
        <Box flex={1} align="center" justify="center"><Glyph icon={IconImages1} size={24} color={sub} /></Box>
      )}
      {creating && image ? (
        <Box align="center" justify="center" style={{ position: 'absolute', inset: 0 }}>
          <Spinner size={20} color={fg}/>
        </Box>
      ) : null}
    </Pressable>
  );
}

function GroupNameField({ name, setName }: { name: string; setName: (s: string) => void }): React.ReactElement {
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
  const [pickNonce, setPickNonce] = useState(0);
  return (
    <Row gap={8}>
      <GroupImageField image={image} creating={creating} onPick={() => { if (!creating) setPickNonce(n => n + 1); }}/>
      <GroupImagePicker
        openNonce={pickNonce}
        onPick={(file) => { setImage({ uri: file.uri, mime: file.mime, name: file.name ?? 'group-avatar' }); }}
      />
      <Box flex={1}><GroupNameField name={name} setName={setName} /></Box>
    </Row>
  );
}

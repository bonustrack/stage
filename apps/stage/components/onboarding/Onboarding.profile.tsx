import { useState } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Image } from '@stage-labs/kit/react-native/image';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import type { PickedFile } from '@stage-labs/kit/react-native/file-picker';
import { Col } from '../layout';
import { FormField } from '../FormField';
import { OnboardingCard, PROFILE_AVATAR_SIZE } from './OnboardingCard';
import { usePalette } from '../../lib/theme';
import { GroupImagePicker } from '../GroupImagePicker';
import { EMPTY_DETAILS, profileDetailsProblem, type ProfileDetails } from './Onboarding.profile.model';
import { IconCamera1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCamera1';

const PROFILE_TITLE = 'Set up your profile';
const PROFILE_ABOUT = 'Add a picture, your name and a few words about you.';

function PicturePicker({ image, busy, onPick }: {
  image: PickedFile | null; busy: boolean; onPick: (file: PickedFile) => void;
}): React.ReactElement {
  const pal = usePalette();
  const [pickNonce, setPickNonce] = useState(0);
  return (
    <Pressable onPress={() => { if (!busy) setPickNonce((n) => n + 1); }} hitSlop={8} accessibilityLabel="Choose a profile picture" style={{ alignSelf: 'center' }}>
      {image === null ? (
        <Col size={PROFILE_AVATAR_SIZE} radius="full" background={pal.border} align="center" justify="center">
          <Glyph icon={IconCamera1} size={28} color={pal.sub} />
        </Col>
      ) : (
        <Image src={image.uri} size={PROFILE_AVATAR_SIZE} radius="full" background={pal.border} />
      )}
      <GroupImagePicker openNonce={pickNonce} onPick={onPick} />
    </Pressable>
  );
}

export function ProfileStep({ dark, busy, onContinue }: {
  dark: boolean; busy: boolean;
  onContinue: (details: ProfileDetails) => void;
}): React.ReactElement {
  const pal = usePalette();
  const [details, setDetails] = useState<ProfileDetails>(EMPTY_DETAILS);
  const problem = profileDetailsProblem(details);
  const footer = (
    <Button dark={dark} size="lg" fullWidth pill tintBg={pal.primary} tintFg={pal.bg}
      label="Continue" disabled={busy || problem !== null}
      onPress={() => { onContinue(details); }} />
  );
  return (
    <OnboardingCard title={PROFILE_TITLE} about={PROFILE_ABOUT} footer={footer}>
      <PicturePicker image={details.image} busy={busy} onPick={(image) => { setDetails({ ...details, image }); }} />
      <FormField label="Name" placeholder="e.g. Alice" value={details.displayName} onChangeText={(displayName) => { setDetails({ ...details, displayName }); }} disabled={busy} />
      <FormField label="About" placeholder="A few words about you" multiline value={details.description} onChangeText={(description) => { setDetails({ ...details, description }); }} disabled={busy} />
      {problem === null ? null : <Text size="xs" color={pal.sub}>{problem}</Text>}
    </OnboardingCard>
  );
}

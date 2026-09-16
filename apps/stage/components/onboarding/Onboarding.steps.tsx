
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Col } from '../layout';
import { usePalette } from '../../lib/theme';
import { OnboardingCard, SkipLink } from './OnboardingCard';

export function PasskeyStep({ dark, busy, onAdd, onSkip }: {
  dark: boolean; busy: boolean; onAdd: () => void; onSkip: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const footer = (
    <>
      <Button label="Add a passkey" block pill size="lg" color="primary" variant="solid" disabled={busy} dark={dark} onPress={onAdd} />
      <SkipLink disabled={busy} onPress={onSkip} />
    </>
  );
  return (
    <OnboardingCard title="Add a passkey" footer={footer}>
      <Col align="center" padding={{ top: 8 }}>
        <Icon name="fingerPrint" size={56} color={pal.link} />
      </Col>
      <Text size="4xl" color="link" textAlign="center" style={{ paddingVertical: 12 }}
        value={'Approve transactions on this device with a passkey instead of your recovery phrase.'} />
    </OnboardingCard>
  );
}

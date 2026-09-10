
import { fontSize } from '@stage-labs/kit/tokens';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Col, Box } from '../layout';
import { usePalette, DANGER } from '../../lib/theme';

type Pal = ReturnType<typeof usePalette>;

interface StepAction {
  label: string;
  variant: 'solid' | 'soft' | 'ghost';
  disabled: boolean;
  onPress: () => void;
}

function OnboardingStepView({ dark, title, centered, caption, captionSize, topPadding, actions }: {
  dark: boolean; title: string; centered?: boolean; caption?: string;
  captionSize?: 'sm' | 'md'; topPadding?: number; actions: StepAction[];
}): React.ReactElement {
  return (
    <Col flex={1} justify="between">
      <Col gap={10} padding={{ top: topPadding ?? 8 }} align={centered === true ? 'center' : undefined}>
        <Title level={centered === true ? 1 : 2} style={centered === true ? { textAlign: 'center' } : undefined}>{title}</Title>
        {caption === undefined ? null : <Text value={caption} size={captionSize ?? 'sm'} color="secondary" />}
      </Col>
      <Col gap={10}>
        {actions.map((action) => (
          <Button
            key={action.label}
            label={action.label}
            block
            size="lg"
            color="primary"
            variant={action.variant}
            disabled={action.disabled}
            dark={dark}
            onPress={action.onPress}
          />
        ))}
      </Col>
    </Col>
  );
}

export function WelcomeStep({ dark, busy, onCreate, onRestore, onImport }: {
  pal: Pal; dark: boolean; busy: boolean; onCreate: () => void; onRestore: () => void; onImport: () => void;
}): React.ReactElement {
  return (
    <OnboardingStepView
      dark={dark}
      title="Stage"
      centered
      topPadding={8}
      actions={[
        { label: 'Create new wallet', variant: 'solid', disabled: busy, onPress: onCreate },
        { label: 'I have a recovery phrase', variant: 'soft', disabled: busy, onPress: onRestore },
        { label: 'Import from another device', variant: 'ghost', disabled: busy, onPress: onImport },
      ]}
    />
  );
}

export function RestoreStep({ pal, dark, busy, phrase, err, onChange, onNext, onBack }: {
  pal: Pal; dark: boolean; busy: boolean; phrase: string; err: string;
  onChange: (t: string) => void; onNext: () => void; onBack: () => void;
}): React.ReactElement {
  return (
    <Col flex={1} justify="between">
      <Box padding={{ top: 8 }}>
        <Title level={2} color={pal.text}>Restore wallet</Title>
        <Text size="sm" color={pal.sub} style={{ marginTop: 8, marginBottom: 14 }}>
          Enter your 12-24 word recovery phrase, separated by spaces.
        </Text>
        <Textarea
          value={phrase}
          onChangeText={onChange}
          placeholder="word1 word2 word3 ..."
          placeholderTextColor={pal.sub}
          dark={dark}
          inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
          style={{
            color: pal.text, fontFamily: 'Menlo', fontSize: fontSize('sm'),
            minHeight: 110, height: undefined,
            borderWidth: 1, borderColor: pal.border, borderRadius: 12,
            paddingHorizontal: 12, paddingVertical: 12,
            textAlignVertical: 'top', backgroundColor: 'transparent',
          }}
        />
        {err ? <Text size="xs" color={DANGER} style={{ marginTop: 8 }}>{err}</Text> : null}
      </Box>
      <Col gap={10}>
        <Button dark={dark} size="lg" fullWidth tintBg={pal.primary} tintFg={pal.bg}
          label="Continue" disabled={busy || !phrase.trim()} onPress={onNext} />
        <Button dark={dark} variant="ghost" size="lg" fullWidth label="Back" disabled={busy} onPress={onBack} />
      </Col>
    </Col>
  );
}

export function PasskeyStep({ dark, busy, onAdd, onSkip }: {
  pal: Pal; dark: boolean; busy: boolean; onAdd: () => void; onSkip: () => void;
}): React.ReactElement {
  return (
    <OnboardingStepView
      dark={dark}
      title="Add a passkey"
      caption={
        'Add a passkey so this device can approve transactions without your ' +
        'recovery phrase. You will only be asked for it when you sign. You can ' +
        'add one later.'
      }
      actions={[
        { label: 'Add a passkey', variant: 'solid', disabled: busy, onPress: onAdd },
        { label: 'Skip for now', variant: 'ghost', disabled: busy, onPress: onSkip },
      ]}
    />
  );
}

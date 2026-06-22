
import { fontSize } from '@stage-labs/kit/tokens';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Col, Box } from '../layout';
import { Spinner } from '../Spinner';
import { usePalette, DANGER } from '../../lib/theme';
import { type Stage } from './flow';

export interface SetupErr { message: string; accountId?: string }

const STAGE_LABELS: Record<Stage, string> = {
  wallet: 'Creating your wallet',
  messaging: 'Setting up secure messaging',
  finishing: 'Finishing up',
};

type Pal = ReturnType<typeof usePalette>;

export function WelcomeStep({ pal, dark, busy, onCreate, onRestore }: {
  pal: Pal; dark: boolean; busy: boolean; onCreate: () => void; onRestore: () => void;
}): React.ReactElement {
  return (
    <Col flex={1} justify="between">
      <Box padding={{ top: 48 }}>
        <Title level={1} color={pal.text}>Stage</Title>
        <Text size="md" color={pal.sub} style={{ marginTop: 10 }}>
          Your wallet, your messages, your governance. One gasless smart account.
        </Text>
      </Box>
      <Col gap={10}>
        <Button dark={dark} variant="primary" size="lg" fullWidth tintBg={pal.primary} tintFg={pal.bg}
          label="Create new wallet" disabled={busy} onPress={onCreate} />
        <Button dark={dark} variant="secondary" size="lg" fullWidth
          label="I have a recovery phrase" disabled={busy} onPress={onRestore} />
      </Col>
    </Col>
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
        <Button dark={dark} variant="primary" size="lg" fullWidth tintBg={pal.primary} tintFg={pal.bg}
          label="Continue" disabled={busy || !phrase.trim()} onPress={onNext} />
        <Button dark={dark} variant="ghost" size="lg" fullWidth label="Back" disabled={busy} onPress={onBack} />
      </Col>
    </Col>
  );
}

export function PasskeyStep({ pal, dark, busy, onAdd, onSkip }: {
  pal: Pal; dark: boolean; busy: boolean; onAdd: () => void; onSkip: () => void;
}): React.ReactElement {
  return (
    <Col flex={1} justify="between">
      <Box padding={{ top: 8 }}>
        <Title level={2} color={pal.text}>Add a passkey</Title>
        <Text size="sm" color={pal.sub} style={{ marginTop: 8 }}>
          Add a passkey so this device can approve transactions without your
          recovery phrase. You will only be asked for it when you sign. You can
          add one later.
        </Text>
      </Box>
      <Col gap={10}>
        <Button dark={dark} variant="primary" size="lg" fullWidth tintBg={pal.primary} tintFg={pal.bg}
          label="Add a passkey" disabled={busy} onPress={onAdd} />
        <Button dark={dark} variant="ghost" size="lg" fullWidth label="Skip for now" disabled={busy} onPress={onSkip} />
      </Col>
    </Col>
  );
}

function StageProgress({ pal, stage }: { pal: Pal; stage: Stage }): React.ReactElement {
  const order: Stage[] = ['wallet', 'messaging', 'finishing'];
  return (
    <Col gap={4} padding={{ top: 8 }}>
      {order.map((s, i) => {
        const done = order.indexOf(stage) > i;
        const active = stage === s;
        return (
          <Text key={s} size="sm" color={active ? pal.text : done ? pal.sub : pal.border}>
            {done ? '✓ ' : active ? '• ' : '· '}{STAGE_LABELS[s]}
          </Text>
        );
      })}
    </Col>
  );
}

function SetupProgress({ pal, stage }: { pal: Pal; stage: Stage }): React.ReactElement {
  return (
    <Col gap={14} padding={{ top: 24 }} align="center">
      <Spinner size={28} color={pal.primary} />
      <Text size="md" color={pal.text}>{STAGE_LABELS[stage]}</Text>
      <Text size="xs" color={pal.sub} style={{ textAlign: 'center' }}>
        {stage === 'messaging'
          ? 'Registering your encrypted inbox. This can take up to a minute on first launch.'
          : 'This only takes a moment.'}
      </Text>
      <StageProgress pal={pal} stage={stage} />
    </Col>
  );
}

function SetupErrorActions({ pal, dark, busy, setupErr, onRetry, onBack }: {
  pal: Pal; dark: boolean; busy: boolean; setupErr: SetupErr; onRetry: () => void; onBack: () => void;
}): React.ReactElement {
  return (
    <Col gap={10}>
      <Button dark={dark} variant="primary" size="lg" fullWidth tintBg={pal.primary} tintFg={pal.bg}
        label="Try again" disabled={busy} onPress={onRetry} />
      {!setupErr.accountId ? (
        <Button dark={dark} variant="ghost" size="lg" fullWidth label="Back" disabled={busy} onPress={onBack} />
      ) : null}
    </Col>
  );
}

export function SetupStep({ pal, dark, busy, stage, setupErr, onRetry, onBack }: {
  pal: Pal; dark: boolean; busy: boolean; stage: Stage; setupErr: SetupErr | null;
  onRetry: () => void; onBack: () => void;
}): React.ReactElement {
  return (
    <Col flex={1} justify="between">
      <Box padding={{ top: 8 }}>
        <Title level={2} color={pal.text}>
          {setupErr ? 'Setup needs another try' : 'Setting up'}
        </Title>
        {!setupErr ? (
          <SetupProgress pal={pal} stage={stage} />
        ) : (
          <Text size="sm" color={pal.sub} style={{ marginTop: 8 }}>
            {setupErr.accountId
              ? 'Your wallet is ready, but secure messaging did not finish setting up. Try again - your wallet and recovery phrase are safe.'
              : 'We could not finish setting up. ' + setupErr.message}
          </Text>
        )}
      </Box>
      {setupErr ? (
        <SetupErrorActions pal={pal} dark={dark} busy={busy} setupErr={setupErr} onRetry={onRetry} onBack={onBack} />
      ) : null}
    </Col>
  );
}

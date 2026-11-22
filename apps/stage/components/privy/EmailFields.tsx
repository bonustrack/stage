import { useState } from 'react';
import { errorMessage } from '@stage-labs/client/errors';
import { Button } from '@stage-labs/kit/react-native/button';
import { FormField } from '../FormField';
import { capabilities } from '../../lib/capabilities';
import { SignInCancelled } from '../../lib/signInCancelled';
import { useEffectiveColorScheme, usePalette } from '../../lib/theme';
import { EMAIL_CODE_LENGTH, emailAddressOf, emailCodeOf, isFullEmailCode } from './EmailSignIn.model';

const EMAIL_INPUT = { autoCapitalize: 'none', autoComplete: 'email', autoCorrect: false, textContentType: 'emailAddress' } as const;
const CODE_INPUT = { autoComplete: 'one-time-code', textContentType: 'oneTimeCode', maxLength: EMAIL_CODE_LENGTH } as const;

interface Attempt {
  busy: boolean;
  error: string | null;
  run: (work: () => Promise<void>) => void;
}

function useAttempt(): Attempt {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (work: () => Promise<void>): void => {
    if (busy) return;
    setBusy(true);
    setError(null);
    void work()
      .catch((err: unknown) => {
        if (!(err instanceof SignInCancelled)) setError(errorMessage(err));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  return { busy, error, run };
}

function errorHint(error: string | null): { hint?: string; hintTone?: 'danger' } {
  return error === null ? {} : { hint: error, hintTone: 'danger' };
}

function PrimaryButton({
  label,
  busy,
  ready,
  onPress,
}: {
  label: string;
  busy: boolean;
  ready: boolean;
  onPress: () => void;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  return (
    <Button
      variant="primary"
      dark={dark}
      size="lg"
      fullWidth
      pill
      tintBg={pal.primary}
      tintFg={pal.bg}
      label={label}
      loading={busy}
      disabled={busy || !ready}
      onPress={onPress}
    />
  );
}

export function GhostButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  return (
    <Button dark={dark} variant="ghost" color="primary" size="lg" fullWidth label={label} disabled={disabled === true} onPress={onPress} />
  );
}

export function EmailForm({
  action,
  autoFocus,
  disabled,
  onEdit,
  onSend,
}: {
  action: string;
  autoFocus: boolean;
  disabled?: boolean;
  onEdit?: () => void;
  onSend: (email: string) => Promise<void>;
}): React.ReactElement {
  const [value, setValue] = useState('');
  const attempt = useAttempt();
  const email = emailAddressOf(value);
  const blocked = attempt.busy || disabled === true;
  const send = (): void => {
    if (email !== null && disabled !== true) attempt.run(() => onSend(email));
  };
  return (
    <>
      <FormField
        label="Email"
        value={value}
        onChangeText={(text) => {
          setValue(text);
          onEdit?.();
        }}
        placeholder="you@example.com"
        inputType="email"
        inputProps={EMAIL_INPUT}
        autoFocus={autoFocus}
        disabled={blocked}
        onSubmit={send}
        {...errorHint(attempt.error)}
      />
      <PrimaryButton label={action} busy={attempt.busy} ready={email !== null && disabled !== true} onPress={send} />
    </>
  );
}

export function CodeForm({
  action,
  onVerify,
  onResend,
  onChangeEmail,
}: {
  action: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onChangeEmail: () => void;
}): React.ReactElement {
  const [code, setCode] = useState('');
  const attempt = useAttempt();
  const verify = (next: string): void => {
    if (isFullEmailCode(next)) attempt.run(() => onVerify(next));
  };
  const resend = (): void => {
    attempt.run(async () => {
      await onResend();
      setCode('');
      capabilities.toast('We sent you a new code.');
    });
  };
  return (
    <>
      <FormField
        label="Code"
        value={code}
        onChangeText={(text) => {
          const next = emailCodeOf(text);
          setCode(next);
          verify(next);
        }}
        variant="number"
        inputProps={CODE_INPUT}
        autoFocus
        disabled={attempt.busy}
        onSubmit={() => {
          verify(code);
        }}
        {...errorHint(attempt.error)}
      />
      <PrimaryButton
        label={action}
        busy={attempt.busy}
        ready={isFullEmailCode(code)}
        onPress={() => {
          verify(code);
        }}
      />
      <GhostButton label="Send a new code" disabled={attempt.busy} onPress={resend} />
      <GhostButton label="Use a different email" disabled={attempt.busy} onPress={onChangeEmail} />
    </>
  );
}

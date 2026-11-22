import { useRouter } from 'expo-router';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { FORM_FIELD_HEIGHT, FORM_FIELD_RADIUS } from '../FormField';
import { Column } from '../layout';
import { TermsNotice } from '../legal/TermsNotice';
import { EmailForm } from '../privy/EmailFields';
import { privySendEmailCode, wantPrivyHost } from '../../lib/privyBridge';
import { useLoginMethods } from '../../lib/privyLogins';
import { usePalette } from '../../lib/theme';
import { IMPORT_ROUTE } from './nextRoute.model';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import { PLACEHOLDER_BUTTONS, SIGNUP_COPY, signUpLayout } from './Onboarding.signup.model';
import { PrivyLoginButtons } from './PrivyLoginButtons';

function Placeholders({ dark }: { dark: boolean }): React.ReactElement {
  const pal = usePalette();
  return (
    <>
      <Column height={FORM_FIELD_HEIGHT} background={pal.border} style={{ borderRadius: FORM_FIELD_RADIUS, opacity: 0.6 }} />
      {Array.from({ length: PLACEHOLDER_BUTTONS }, (_, index) => (
        <Button key={index} dark={dark} variant="soft" color="primary" size="lg" fullWidth pill label="" disabled />
      ))}
    </>
  );
}

function CreateAccountButton({
  dark,
  busy,
  primary,
  onCreate,
}: {
  dark: boolean;
  busy: boolean;
  primary: boolean;
  onCreate: () => void;
}): React.ReactElement {
  const pal = usePalette();
  if (!primary) {
    return (
      <Button
        dark={dark}
        variant="soft"
        color="primary"
        size="lg"
        fullWidth
        pill
        label="Create account"
        disabled={busy}
        onPress={onCreate}
      />
    );
  }
  return (
    <Button
      variant="primary"
      dark={dark}
      size="lg"
      fullWidth
      pill
      tintBg={pal.primary}
      tintFg={pal.bg}
      label="Create account"
      disabled={busy}
      onPress={onCreate}
    />
  );
}

interface SignUpProps {
  dark: boolean;
  busy: boolean;
  onCreate: () => void;
  onPrivy: (method: PrivyLoginMethod) => void;
  onEmailCodeSent: (email: string) => void;
}

function SignUpActions({
  methods,
  dark,
  busy,
  onCreate,
  onPrivy,
  onEmailCodeSent,
}: SignUpProps & { methods: readonly PrivyLoginMethod[] }): React.ReactElement {
  const layout = signUpLayout(methods);
  return (
    <>
      {layout.email ? (
        <EmailForm
          action="Continue with email"
          autoFocus={false}
          disabled={busy}
          onEdit={wantPrivyHost}
          onSend={async (email) => {
            await privySendEmailCode(email);
            onEmailCodeSent(email);
          }}
        />
      ) : null}
      {layout.createOnPage ? <CreateAccountButton dark={dark} busy={busy} primary={!layout.email} onCreate={onCreate} /> : null}
      {layout.separator ? <Text text="or" size="sm" color="secondary" textAlign="center" /> : null}
      <PrivyLoginButtons dark={dark} busy={busy} methods={layout.buttons} onPick={onPrivy} />
    </>
  );
}

export function SignUpStep(props: SignUpProps): React.ReactElement {
  const router = useRouter();
  const logins = useLoginMethods();
  const methods = logins.status === 'ready' ? logins.methods : null;
  const importOnPage = methods !== null && signUpLayout(methods).importOnPage;
  return (
    <OnboardingCard
      title={SIGNUP_COPY.title}
      about={SIGNUP_COPY.about}
      footer={methods === null ? <Placeholders dark={props.dark} /> : <SignUpActions {...props} methods={methods} />}
      after={
        <>
          {importOnPage ? (
            <SkipLink
              label="Or import"
              disabled={props.busy}
              onPress={() => {
                router.navigate(IMPORT_ROUTE);
              }}
            />
          ) : null}
          <TermsNotice />
        </>
      }
    />
  );
}

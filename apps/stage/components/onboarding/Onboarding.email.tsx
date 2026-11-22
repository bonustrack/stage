import { CodeForm } from '../privy/EmailFields';
import { emailSignInCopy } from '../privy/EmailSignIn.model';
import { privyLoginWithEmail, privySendEmailCode } from '../../lib/privyBridge';
import { OnboardingCard } from './OnboardingCard';

export function EmailCodeStep({
  email,
  onSignedIn,
  onBack,
}: {
  email: string;
  onSignedIn: (address: string) => void;
  onBack: () => void;
}): React.ReactElement {
  const copy = emailSignInCopy(email);
  return (
    <OnboardingCard title={copy.title} about={copy.about}>
      <CodeForm
        action={copy.action}
        onVerify={async (code) => {
          const session = await privyLoginWithEmail(email, code);
          onSignedIn(session.address);
        }}
        onResend={() => privySendEmailCode(email)}
        onChangeEmail={onBack}
      />
    </OnboardingCard>
  );
}

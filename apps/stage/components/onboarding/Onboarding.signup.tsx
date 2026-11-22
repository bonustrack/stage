import { useRouter } from 'expo-router';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { Button } from '@stage-labs/kit/react-native/button';
import { TermsNotice } from '../legal/TermsNotice';
import { usePalette } from '../../lib/theme';
import { IMPORT_ROUTE } from './nextRoute.model';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import { PrivyLoginButtons } from './PrivyLoginButtons';

export const SIGNUP_COPY = {
  title: 'Welcome to Stage',
  about: 'Private, encrypted messaging. Create an account, or sign in with one you already have.',
} as const;

export function SignUpStep({
  dark,
  busy,
  onCreate,
  onPrivy,
}: {
  dark: boolean;
  busy: boolean;
  onCreate: () => void;
  onPrivy: (method: PrivyLoginMethod) => void;
}): React.ReactElement {
  const pal = usePalette();
  const router = useRouter();
  const footer = (
    <>
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
      <PrivyLoginButtons dark={dark} busy={busy} onPick={onPrivy} />
    </>
  );
  return (
    <OnboardingCard
      title={SIGNUP_COPY.title}
      about={SIGNUP_COPY.about}
      footer={footer}
      after={
        <>
          <SkipLink
            label="Or import"
            disabled={busy}
            onPress={() => {
              router.navigate(IMPORT_ROUTE);
            }}
          />
          <TermsNotice />
        </>
      }
    />
  );
}

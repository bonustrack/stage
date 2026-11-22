import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconWallet1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet1';
import { usePalette } from '../../lib/theme';
import { BRAND_LOGO_SIZE, GitHubLogo, GoogleLogo, MicrosoftLogo } from './BrandLogos';

const LABELS: Record<PrivyLoginMethod, string> = {
  google: 'Continue with Google',
  microsoft: 'Continue with Microsoft',
  github: 'Continue with GitHub',
  email: 'Continue with email',
  wallet: 'Continue with wallet',
};

function MethodIcon({ method }: { method: PrivyLoginMethod }): React.ReactElement {
  const pal = usePalette();
  if (method === 'google') return <GoogleLogo />;
  if (method === 'microsoft') return <MicrosoftLogo />;
  if (method === 'github') return <GitHubLogo color={pal.text} />;
  return <Glyph icon={IconWallet1} size={BRAND_LOGO_SIZE} color={pal.primary} />;
}

export function PrivyLoginButtons({
  dark,
  busy,
  methods,
  onPick,
}: {
  dark: boolean;
  busy: boolean;
  methods: readonly PrivyLoginMethod[];
  onPick: (method: PrivyLoginMethod) => void;
}): React.ReactElement {
  return (
    <>
      {methods.map((method) => (
        <Button
          key={method}
          dark={dark}
          variant="soft"
          color="primary"
          size="lg"
          fullWidth
          pill
          label={LABELS[method]}
          iconStart={<MethodIcon method={method} />}
          disabled={busy}
          onPress={() => {
            onPick(method);
          }}
        />
      ))}
    </>
  );
}

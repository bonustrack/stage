import { useState } from 'react';
import type { PrivyLoginMethod } from '@stage-labs/client/accounts/types';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Text } from '@stage-labs/kit/react-native/text';
import { IconWallet1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconWallet1';
import { privyLoginMethods } from '../../lib/privyConfig';
import { usePalette } from '../../lib/theme';
import { BRAND_LOGO_SIZE, GitHubLogo, GoogleLogo, MicrosoftLogo } from './BrandLogos';

const LABELS: Record<PrivyLoginMethod, string> = {
  google: 'Continue with Google',
  microsoft: 'Continue with Microsoft',
  github: 'Continue with GitHub',
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
  onPick,
}: {
  dark: boolean;
  busy: boolean;
  onPick: (method: PrivyLoginMethod) => void;
}): React.ReactElement | null {
  const [methods] = useState(privyLoginMethods);
  if (methods.length === 0) return null;
  return (
    <>
      <Text text="or" size="sm" color="secondary" textAlign="center" />
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

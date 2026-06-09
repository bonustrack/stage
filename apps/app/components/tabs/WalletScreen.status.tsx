/** Shared status primitives for the wallet tabs (Activity, NFTs). Both tabs
 *  render the same centred spinner and the same muted / danger status line
 *  while loading, erroring, or empty. Extracted verbatim so the markup +
 *  styling stay byte-identical across tabs. */

import { Text } from '@metro-labs/kit/text';
import { Spinner } from '../Spinner';
import { Col } from '../layout';
import { DANGER } from '../../lib/theme';

/** Centred spinner, sized to match the wallet tabs (28px). */
export function WalletSpinner({ color }: { color: string }): React.ReactElement {
  return <Spinner size={28} color={color} />;
}

/** A single muted (or danger) status line, e.g. "No transactions yet" or a
 *  load-failure message. `tone` picks the colour: `muted` uses the passed
 *  `sub` colour, `danger` uses the shared DANGER token. */
export function WalletStatusText({
  children, sub, tone = 'muted',
}: {
  children: React.ReactNode; sub: string; tone?: 'muted' | 'danger';
}): React.ReactElement {
  return (
    <Text
      style={{
        color: tone === 'danger' ? DANGER : sub,
        fontSize: 15,
        fontFamily: 'Calibre-Medium',
      }}
    >
      {children}
    </Text>
  );
}

/** The wallet-tab status well: a `py={40}` centred column wrapping a single
 *  status child (spinner or text). Mirrors the inner block both tabs repeat. */
export function WalletStatusWell({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Col py={40} align="center">
      {children}
    </Col>
  );
}

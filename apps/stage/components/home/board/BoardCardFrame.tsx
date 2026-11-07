import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { Column } from '../../layout';
import type { MarkedNode } from '../../keys/keys.model';
import { usePalette } from '../../../lib/theme';

export function BoardCardFrame({
  children,
  selected = false,
  pending = false,
  mark,
}: {
  children: React.ReactNode;
  selected?: boolean;
  pending?: boolean;
  mark?: MarkedNode;
}): React.ReactElement {
  const { bg, link } = usePalette();
  return (
    <Column
      {...mark}
      surface="surface"
      radius={BLOCK_RADIUS_DEFAULT}
      aria-busy={pending}
      accessibilityState={{ busy: pending }}
      style={{ overflow: 'hidden', borderWidth: 1, borderColor: selected ? link : bg, opacity: pending ? 0.5 : 1 }}
    >
      {children}
    </Column>
  );
}

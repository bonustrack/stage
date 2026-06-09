/** A labelled gallery block: a component name + one-line note above a framed
 *  example. Shared by the Kit page (primitives) and the Components page (app-level
 *  components). No controls, no story indirection - the children render the
 *  component directly with sample props. Fonts: Calibre-Medium / Calibre-Semibold. */

import { Box } from '../layout';

import { Text } from '@metro-labs/kit/text';
import { useBlockRadius } from '../../lib/theme';

export function GallerySection({ name, note, head, sub, border, framed = true, innerPadH, innerPadV, children }: {
  name: string; note?: string; head: string; sub: string; border: string;
  /** When true (default) wrap children in a bordered rounded card; else no frame. */
  framed?: boolean; innerPadH?: number; innerPadV?: number; children: React.ReactNode;
}): React.ReactElement {
  const blockRadius = useBlockRadius();
  return (
    <Box style={{ paddingHorizontal: 16, paddingTop: 22 }}>
      <Text weight="semibold" size="xl" color={head}>{name}</Text>
      {note ? (
        <Text size="xs" color={sub} style={{ marginTop: 1 }}>{note}</Text>
      ) : null}
      <Box
        mt={12}
        radius={framed ? blockRadius : 0}
        style={{
          ...(framed ? { borderWidth: 1, borderColor: border, overflow: 'hidden' as const } : {}),
          paddingHorizontal: innerPadH, paddingVertical: innerPadV,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

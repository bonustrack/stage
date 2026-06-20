/** @file GallerySection — labelled gallery block (name + note above a framed example) shared by Kit and Components pages, rendering children directly with sample props. */

import { Box } from '../layout';

import { Text } from '@stage-labs/kit/text';
import { useBlockRadius } from '../../lib/theme';

/** Renders a labeled gallery section, optionally wrapped in a bordered card. */
export function GallerySection({ name, note, head, sub, border, framed = true, innerPadH, innerPadV, children }: {
  name: string; note?: string; head: string; sub: string; border: string;
  /** When true (default) wrap children in a bordered rounded card; else no frame. */
  framed?: boolean; innerPadH?: number; innerPadV?: number; children: React.ReactNode;
}): React.ReactElement {
  const blockRadius = useBlockRadius();
  return (
    <Box padding={{ x: 16, top: 22 }}>
      <Text weight="semibold" size="xl" color={head}>{name}</Text>
      {note ? (
        <Text size="xs" color={sub} style={{ marginTop: 1 }}>{note}</Text>
      ) : null}
      <Box padding={{ x: innerPadH, y: innerPadV }} margin={{ top: 12 }}
        
        radius={framed ? blockRadius : 0}
        style={{ ...(framed ? { borderWidth: 1, borderColor: border, overflow: 'hidden' as const } : {}) }}
      >
        {children}
      </Box>
    </Box>
  );
}

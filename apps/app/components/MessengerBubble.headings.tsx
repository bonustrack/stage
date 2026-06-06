/** Custom react-native-markdown-display render rules that map markdown headings
 *  (h1-h6) onto the Kit Title component so chat headings render at the app's
 *  heading type scale instead of the lib's near-body default. h1->level 1,
 *  h2->level 2, h3-h6->level 3 (the smallest sensible heading level).
 *
 *  The rendered `children` are already inline <Text> nodes; wrapping them in a
 *  Kit Title (itself an RNText) lets them inherit the heading fontSize/family via
 *  RN text nesting. `fg`/`dark` are captured from the bubble so the heading uses
 *  the bubble's foreground colour. */

import type { ReactNode } from 'react';
import { Title, type TitleLevel } from '@metro-labs/kit/title';

type Node = { key: string };

/** Build the heading render-rule overrides bound to the bubble's colour. */
export function headingRules(fg: string, dark: boolean): Record<string, (node: Node, children: ReactNode) => React.ReactElement> {
  const make = (level: TitleLevel) => (node: Node, children: ReactNode): React.ReactElement => (
    <Title key={node.key} level={level} color={fg} dark={dark} style={{ marginTop: 4, marginBottom: 2 }}>
      {children}
    </Title>
  );
  return {
    heading1: make(1),
    heading2: make(2),
    heading3: make(3),
    heading4: make(3),
    heading5: make(3),
    heading6: make(3),
  };
}

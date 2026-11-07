import { Column, PANE_LEFT_PAD } from '.';

export function ContentFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <Column surface="surface" weight={1} width="100%" style={PANE_LEFT_PAD}>
      {children}
    </Column>
  );
}

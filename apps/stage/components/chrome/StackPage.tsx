import type { ReactNode } from 'react';
import type { SimultaneousRefs } from '../layout/simultaneousRefs';
import { useSafeAreaInsets } from '../layout/safeArea';
import { StackHeader } from './StackHeader';
import { Column, Row, ScreenScroll } from '../layout';

interface StackPageProps {
  title: string;
  header?: boolean;
  back?: boolean;
  backTo?: string;
  trailing?: ReactNode;
  panRef?: SimultaneousRefs;
  keyboardShouldPersistTaps?: 'handled';
  list?: boolean;
  children: ReactNode;
}

export function StackPage({
  title,
  header = true,
  back,
  backTo,
  trailing,
  panRef,
  keyboardShouldPersistTaps,
  list = false,
  children,
}: StackPageProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const actions =
    trailing === undefined ? undefined : (
      <Row weight={1} justify="end">
        {trailing}
      </Row>
    );
  return (
    <Column surface="surface" weight={1}>
      {header ? <StackHeader title={title} backTo={backTo} back={back} trailing={actions} /> : null}
      {list ? (
        children
      ) : (
        <ScreenScroll
          simultaneousHandlers={panRef}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
        >
          {children}
        </ScreenScroll>
      )}
    </Column>
  );
}

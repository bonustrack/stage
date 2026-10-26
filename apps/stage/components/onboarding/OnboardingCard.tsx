import type { ReactNode } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { PAGE_INTRO_MAX_WIDTH, PAGE_INTRO_TYPE } from '../chrome/PageIntro.model';
import { Column } from '../layout';

const CENTER = { textAlign: 'center' } as const;

const ACTIONS_GAP = 20;

export function OnboardingCard({ title, about, footer, after, children }: {
  title: string; about?: string; footer?: ReactNode; after?: ReactNode; children?: ReactNode;
}): React.ReactElement {
  return (
    <Column width="100%" maxWidth={PAGE_INTRO_MAX_WIDTH} padding={{ x: PAGE_INTRO_TYPE.padX }} gap={PAGE_INTRO_TYPE.sectionGap}>
      <Column gap={PAGE_INTRO_TYPE.gap}>
        <Title hero="3xl" style={CENTER}>{title}</Title>
        {about === undefined ? null : <Text size="xl" style={{ ...CENTER, ...PAGE_INTRO_TYPE.about }}>{about}</Text>}
      </Column>
      {children === undefined || children === null ? null : <Column gap={16}>{children}</Column>}
      <Column gap={ACTIONS_GAP}>
        {footer === undefined || footer === null ? null : <Column gap={10}>{footer}</Column>}
        {after}
      </Column>
    </Column>
  );
}

export function SkipLink({ label, disabled, onPress }: {
  label: string; disabled?: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={{ alignSelf: 'center', opacity: disabled === true ? 0.5 : 1 }}>
      <Text text={label} size="sm" color="secondary" />
    </Pressable>
  );
}

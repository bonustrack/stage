import type { ReactNode } from 'react';
import { Text } from '@stage-labs/kit/react-native/text';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Col } from '../layout';
import { PageIntro } from '../chrome/PageIntro';
import { PAGE_INTRO_MAX_WIDTH, PAGE_INTRO_TYPE } from '../chrome/PageIntro.model';

export const PROFILE_AVATAR_SIZE = 88;
const ACTIONS_GAP = 20;

export function OnboardingCard({ title, about, footer, after, children }: {
  title: string; about?: string; footer?: ReactNode; after?: ReactNode; children?: ReactNode;
}): React.ReactElement {
  return (
    <Col width="100%" maxWidth={PAGE_INTRO_MAX_WIDTH} padding={{ x: PAGE_INTRO_TYPE.padX }} gap={PAGE_INTRO_TYPE.sectionGap}>
      <PageIntro title={title} about={about} />
      {children === undefined || children === null ? null : <Col gap={16}>{children}</Col>}
      <Col gap={ACTIONS_GAP}>
        {footer === undefined || footer === null ? null : <Col gap={10}>{footer}</Col>}
        {after}
      </Col>
    </Col>
  );
}

export function SkipLink({ label = 'Skip for now', disabled, onPress }: {
  label?: string; disabled?: boolean; onPress: () => void;
}): React.ReactElement {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={8} style={{ alignSelf: 'center', opacity: disabled === true ? 0.5 : 1 }}>
      <Text value={label} size="xl" role="secondary" />
    </Pressable>
  );
}

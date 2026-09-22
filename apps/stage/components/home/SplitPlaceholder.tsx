import { useRouter } from 'expo-router';
import { Button } from '@stage-labs/kit/react-native/button';
import { Col, PANE_LEFT_PAD, viewportFill } from '../layout';
import { PageIntro } from '../chrome/PageIntro';
import { PAGE_INTRO_MAX_WIDTH, PAGE_INTRO_TYPE } from '../chrome/PageIntro.model';
import { useEffectiveColorScheme } from '../../lib/theme';
import { SUGGESTED_CONTACTS } from '../SuggestedContacts.model';
import { SPLIT_PLACEHOLDER_COPY } from './SplitPlaceholder.model';

const SELF_CENTER = { alignSelf: 'center' } as const;

export function SplitPlaceholder(): React.ReactElement {
  const router = useRouter();
  const dark = useEffectiveColorScheme() === 'dark';
  const alice = SUGGESTED_CONTACTS[0];
  return (
    <Col flex={1} align="center" justify="center" surface="surface" style={[viewportFill(), PANE_LEFT_PAD]}>
      <Col gap={PAGE_INTRO_TYPE.sectionGap} width="100%" maxWidth={PAGE_INTRO_MAX_WIDTH} padding={{ x: PAGE_INTRO_TYPE.padX }}>
        <PageIntro title={SPLIT_PLACEHOLDER_COPY.title} about={SPLIT_PLACEHOLDER_COPY.about} />
        {alice === undefined ? null : (
          <Button
            dark={dark} size="lg" pill color="primary" variant="solid" label={SPLIT_PLACEHOLDER_COPY.action} style={SELF_CENTER}
            onPress={() => { router.push({ pathname: '/[convId]', params: { convId: alice } }); }}
          />
        )}
      </Col>
    </Col>
  );
}

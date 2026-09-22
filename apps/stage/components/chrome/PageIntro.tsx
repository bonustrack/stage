import { Text } from '@stage-labs/kit/react-native/text';
import { Col } from '../layout';
import { PAGE_INTRO_TYPE } from './PageIntro.model';

const CENTER = { textAlign: 'center' } as const;

export function PageIntro({ title, about }: { title: string; about?: string }): React.ReactElement {
  return (
    <Col gap={PAGE_INTRO_TYPE.gap}>
      <Text weight="medium" style={{ ...CENTER, ...PAGE_INTRO_TYPE.title }}>{title}</Text>
      {about === undefined ? null : <Text style={{ ...CENTER, ...PAGE_INTRO_TYPE.about }}>{about}</Text>}
    </Col>
  );
}

import { Text } from '@stage-labs/kit/react-native/text';
import { Title } from '@stage-labs/kit/react-native/title';
import { StackHeader } from '../chrome/StackHeader';
import { Column, ScreenScroll, PAGE_GUTTER } from '../layout';
import { updatedLabel, type LegalDoc } from './legal.model';

const READABLE_WIDTH = 720;

export function LegalPage({ doc }: { doc: LegalDoc }): React.ReactElement {
  return (
    <Column surface="surface" weight={1}>
      <StackHeader title={doc.title} />
      <ScreenScroll contentContainerStyle={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 20, paddingBottom: 48 }}>
        <Column gap={24} maxWidth={READABLE_WIDTH}>
          <Column gap={8}>
            <Text size="sm" color="secondary" text={updatedLabel(doc)} />
            <Text size="lg" text={doc.intro} selectable />
          </Column>
          {doc.sections.map((section) => (
            <Column key={section.heading} gap={8}>
              <Title size="sm" text={section.heading} />
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph} size="lg" text={paragraph} selectable />
              ))}
            </Column>
          ))}
        </Column>
      </ScreenScroll>
    </Column>
  );
}

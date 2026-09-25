import { Text, type TextProps } from '@stage-labs/kit/react-native/text';
import { Row } from './layout';
import { labelParts } from './LabelText.model';

const EMOJI_GAP = 4;

type LabelTextProps = Omit<TextProps, 'value' | 'children' | 'style'> & { label: string };

export function LabelText({ label, truncate, ...text }: LabelTextProps): React.ReactElement {
  const parts = labelParts(label);
  const only = parts.length === 1 ? parts[0] : undefined;
  if (only !== undefined) return <Text value={only.text} truncate={truncate} {...text} />;
  return (
    <Row align="center" gap={EMOJI_GAP} style={{ flexShrink: 1 }}>
      {parts.map((part, i) => (
        <Text
          key={`${part.text}-${i}`}
          value={part.text}
          truncate={part.emoji ? false : truncate}
          {...text}
          style={{ flexShrink: part.emoji ? 0 : 1 }}
        />
      ))}
    </Row>
  );
}

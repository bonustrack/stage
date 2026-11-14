import { Text } from '@stage-labs/kit/react-native/text';
import { bubbleLinkProps } from '../bubble/linkProps';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { PRIVACY_URL, TERMS_NOTICE, TERMS_URL } from './legal.model';

const LINK_STYLE = { textDecorationLine: 'underline' } as const;

export function TermsNotice(): React.ReactElement {
  return (
    <Text size="sm" color="secondary" textAlign="center">
      {TERMS_NOTICE.lead}
      <Text size="sm" color="link" style={LINK_STYLE} {...bubbleLinkProps(TERMS_URL, openInBubbleLink)}>
        {TERMS_NOTICE.terms}
      </Text>
      {TERMS_NOTICE.middle}
      <Text size="sm" color="link" style={LINK_STYLE} {...bubbleLinkProps(PRIVACY_URL, openInBubbleLink)}>
        {TERMS_NOTICE.privacy}
      </Text>
      {TERMS_NOTICE.tail}
    </Text>
  );
}

/** A reusable tappable row that opens a GitHub URL via Linking. Renders the
 *  GitHub mark + title + subtitle and an externalLink chevron, matching the
 *  System-page link styling. Shared by the Kit page and the About page. */

import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Box, Row, Col } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { GithubLogo } from '../GithubLogo';

export function GitHubLinkRow({ head, sub, border, url, title, subtitle }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
  url: string; title: string; subtitle: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={() => { void Linking.openURL(url); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
>
      <Box radius="lg" surface="raised" padding={{ x: 14, y: 14 }} margin={{ x: 16, top: 16 }}
        style={{ borderWidth: 1, borderColor: border }}
>
        <Row gap={12} align="center">
          <GithubLogo size={22} color={head}/>
          <Col flex={1}>
            <Text weight="semibold" size="md" color={head}>
              {title}
            </Text>
            <Text color={sub} variant="caption" weight="medium"
              style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          </Col>
          <Icon name="externalLink" size={18} color={sub}/>
        </Row>
      </Box>
    </Pressable>
  );
}

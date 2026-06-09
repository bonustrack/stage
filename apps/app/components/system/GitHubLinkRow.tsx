/** A reusable tappable row that opens a GitHub URL via Linking. Renders the
 *  GitHub mark + title + subtitle and an externalLink chevron, matching the
 *  System-page link styling. Shared by the Kit page and the About page. */

import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Box, Row, Col } from '../layout';
import { Icon } from '@metro-labs/kit/icon';
import { Text } from '@metro-labs/kit/text';
import { GithubLogo } from '../GithubLogo';

export function GitHubLinkRow({ dark, head, sub, border, rowBg, url, title, subtitle }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
  url: string; title: string; subtitle: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={() => { void Linking.openURL(url); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Box
        mx={16} mt={16} py={14} px={14} style={{ borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: rowBg }}
      >
        <Row gap={12} align="center">
          <GithubLogo size={22} color={head} />
          <Col flex={1}>
            <Text weight="semibold" size="md" color={head}>
              {title}
            </Text>
            <Text dark={dark} color={sub} variant="caption" weight="medium"
              style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          </Col>
          <Icon name="externalLink" size={18} color={sub} />
        </Row>
      </Box>
    </Pressable>
  );
}

/** @file GitHubLinkRow — a reusable tappable row (GitHub mark + title/subtitle + external-link chevron) that opens a GitHub URL via Linking, shared by the Kit and About pages. */

import { Linking } from 'react-native';

import { Pressable } from '@stage-labs/kit/pressable';
import { Box, Row, Col } from '../layout';
import { Icon } from '@stage-labs/kit/icon';
import { Text } from '@stage-labs/kit/text';
import { GithubLogo } from '../GithubLogo';

/** Renders a tappable row linking to a GitHub URL. */
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

/** Direct render of the @metro-labs/kit primitives for the Kit page. Each
 *  primitive shows a couple representative variants inline with sample props -
 *  no controls, no story indirection. The new Card + ListView/ListViewItem
 *  primitives are included alongside Title / Text / Button / Icon. */

import { Box, Row } from '../layout';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { Card } from '@metro-labs/kit/card';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { GallerySection } from './GallerySection';
import type { GalleryPalette } from './galleryPalette';

const SAMPLE_ICONS = ['cog', 'bell', 'wallet', 'chat', 'user', 'check'] as const;
const LIST_ROWS = ['Display', 'Messenger', 'Notifications', 'Security'];

export function KitSections({ dark, head, sub, border }: GalleryPalette): React.ReactElement {
  const sec = { head, sub, border };
  return (
    <Box>
      <GallerySection name="Title" note="Heading typography, levels 1-3" {...sec} innerPadH={14} innerPadV={12}>
        <Title dark={dark} level={1} color={head}>Level 1 title</Title>
        <Title dark={dark} level={2} color={head}>Level 2 title</Title>
        <Title dark={dark} level={3} color={head}>Level 3 title</Title>
      </GallerySection>

      <GallerySection name="Text" note="Body / secondary / caption / mono variants" {...sec} innerPadH={14} innerPadV={12}>
        <Text dark={dark} variant="body">Body text - the default paragraph style.</Text>
        <Text dark={dark} variant="secondary">Secondary text - muted supporting copy.</Text>
        <Text dark={dark} variant="caption">Caption text - smallest label.</Text>
        <Text dark={dark} variant="mono">0xabc...1234</Text>
      </GallerySection>

      <GallerySection name="Button" note="Variants + sizes + icon / pill" {...sec} innerPadH={14} innerPadV={12}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Button dark={dark} variant="primary" label="Primary" />
          <Button dark={dark} variant="secondary" label="Secondary" />
          <Button dark={dark} variant="ghost" label="Ghost" />
          <Button dark={dark} variant="danger" label="Danger" />
        </Row>
        <Row gap={8} mt={10} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button dark={dark} size="sm" label="Small" />
          <Button dark={dark} size="lg" label="Large" />
          <Button
            dark={dark} variant="primary"
            label="With icon" icon={<Icon name="check" size={18} color={dark ? '#000' : '#fff'} />}
          />
          <Button dark={dark} variant="secondary" pill icon={<Icon name="cog" size={18} color={head} />} />
        </Row>
      </GallerySection>

      <GallerySection name="Icon" note="Heroicon vocabulary, head-tinted" {...sec} innerPadH={14} innerPadV={14}>
        <Row gap={18} style={{ flexWrap: 'wrap' }}>
          {SAMPLE_ICONS.map((n) => <Icon key={n} name={n} size={26} color={head} />)}
        </Row>
      </GallerySection>

      <GallerySection name="Card" note="ChatKit surface with status + actions" {...sec} framed={false}>
        <Card
          dark={dark}
          status={{ text: 'Pending confirmation' }}
          confirm={{ label: 'Confirm', onPress: () => {} }}
          cancel={{ label: 'Cancel', onPress: () => {} }}
        >
          <Text dark={dark}>A bordered Card surface holding arbitrary body content.</Text>
        </Card>
      </GallerySection>

      <GallerySection name="ListView" note="Grouped rows (ListView + ListViewItem)" {...sec} framed={false}>
        <ListView dark={dark} status={{ text: `${LIST_ROWS.length} items` }}>
          {LIST_ROWS.map((label) => (
            <ListViewItem key={label} dark={dark} onPress={() => {}}>
              <Icon name="cog" size={22} color={head} />
              <Box style={{ flex: 1 }}>
                <Text dark={dark} color={head} weight="medium" size={18}>{label}</Text>
              </Box>
              <Icon name="chevronRight" size={18} color={sub} />
            </ListViewItem>
          ))}
        </ListView>
      </GallerySection>
    </Box>
  );
}

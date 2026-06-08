/** Direct render of the @metro-labs/kit primitives for the Kit page. Each
 *  primitive shows a couple representative variants inline with sample props -
 *  no controls, no story indirection. */

import { Box, Row } from '../layout';
import { Title } from '@metro-labs/kit/title';
import { Text } from '@metro-labs/kit/text';
import { Button } from '@metro-labs/kit/button';
import { Icon } from '@metro-labs/kit/icon';
import { Card } from '@metro-labs/kit/card';
import { ListView, ListViewItem } from '@metro-labs/kit/list-view';
import { Divider } from '@metro-labs/kit/divider';
import { Caption } from '@metro-labs/kit/caption';
import { Image } from '@metro-labs/kit/image';
import { Spacer } from '@metro-labs/kit/spacer';
import { Label } from '@metro-labs/kit/label';
import { Input } from '@metro-labs/kit/input';
import { Textarea } from '@metro-labs/kit/textarea';
import { Checkbox } from '@metro-labs/kit/checkbox';
import { RadioGroup } from '@metro-labs/kit/radio-group';
import { GallerySection } from './GallerySection';
import type { GalleryPalette } from './galleryPalette';

const SAMPLE_ICONS = ['cog', 'bell', 'wallet', 'chat', 'user', 'check'] as const;
const LIST_ROWS = ['Display', 'Messenger', 'Notifications', 'Security'];
const SAMPLE_IMAGE = 'https://stamp.fyi/avatar/eth:0x2539f6dd5e4ab2c3a30c2b9a0a8a8a8a8a8a79d5?s=160';

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

      <GallerySection name="Divider" note="Hairline separator - spacing / flush / thickness" {...sec} innerPadH={14} innerPadV={14}>
        <Text dark={dark}>Above the divider</Text>
        <Divider dark={dark} spacing={12} />
        <Text dark={dark}>Between two dividers</Text>
        <Divider dark={dark} spacing={12} size={2} />
        <Text dark={dark}>Below the thick divider</Text>
      </GallerySection>

      <GallerySection name="Caption" note="Section labels / muted secondary text" {...sec} innerPadH={14} innerPadV={14}>
        <Caption dark={dark} value="DEFAULT CAPTION" />
        <Caption dark={dark} value="Semibold caption" weight="semibold" />
        <Caption dark={dark} value="Small centered caption" size="sm" textAlign="center" />
      </GallerySection>

      <GallerySection name="Image" note="Unified image - fit / radius / frame" {...sec} innerPadH={14} innerPadV={14}>
        <Row gap={12} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Image src={SAMPLE_IMAGE} size={56} radius="full" fit="cover" alt="Round avatar" />
          <Image src={SAMPLE_IMAGE} size={56} radius="lg" fit="cover" alt="Rounded square" />
          <Image src={SAMPLE_IMAGE} size={56} radius="lg" frame fit="contain" alt="Framed contain" />
        </Row>
      </GallerySection>

      <GallerySection name="Spacer" note="Flexible gap - pushes siblings apart" {...sec} innerPadH={14} innerPadV={14}>
        <Row style={{ alignItems: 'center' }}>
          <Text dark={dark} color={head}>Start</Text>
          <Spacer />
          <Text dark={dark} color={sub}>End</Text>
        </Row>
      </GallerySection>

      <GallerySection name="Label" note="Form-field label - size / weight / align" {...sec} innerPadH={14} innerPadV={14}>
        <Label dark={dark} fieldName="email" value="Email address" />
        <Label dark={dark} value="Semibold large label" size="lg" weight="semibold" />
      </GallerySection>

      <GallerySection name="Input" note="Single-line field - soft / outline / pill" {...sec} innerPadH={14} innerPadV={14}>
        <Box style={{ gap: 10 }}>
          <Input dark={dark} name="soft" placeholder="Soft input" variant="soft" />
          <Input dark={dark} name="outline" placeholder="Outline input" variant="outline" />
          <Input dark={dark} name="pill" placeholder="Pill input" variant="soft" pill />
        </Box>
      </GallerySection>

      <GallerySection name="Textarea" note="Multi-line field - rows / auto-resize" {...sec} innerPadH={14} innerPadV={14}>
        <Textarea dark={dark} name="bio" placeholder="Tell us about yourself..." rows={3} maxRows={6} />
      </GallerySection>

      <GallerySection name="Checkbox" note="Boolean control - label / checked" {...sec} innerPadH={14} innerPadV={14}>
        <Box style={{ gap: 10 }}>
          <Checkbox dark={dark} name="terms" label="Accept the terms" defaultChecked />
          <Checkbox dark={dark} name="news" label="Subscribe to updates" />
        </Box>
      </GallerySection>

      <GallerySection name="RadioGroup" note="Single-select - options / direction" {...sec} innerPadH={14} innerPadV={14}>
        <RadioGroup
          dark={dark}
          name="plan"
          defaultValue="pro"
          options={[
            { label: 'Free', value: 'free' },
            { label: 'Pro', value: 'pro' },
            { label: 'Team', value: 'team' },
          ]}
        />
      </GallerySection>
    </Box>
  );
}

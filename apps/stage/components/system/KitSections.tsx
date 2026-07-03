
import { Box, Row, Col } from '../layout';
import { Title } from '@stage-labs/kit/react-native/title';
import { Text } from '@stage-labs/kit/react-native/text';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { Card } from '@stage-labs/kit/react-native/card';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Divider } from '@stage-labs/kit/react-native/divider';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Image } from '@stage-labs/kit/react-native/image';
import { Spacer } from '@stage-labs/kit/react-native/spacer';
import { Label } from '@stage-labs/kit/react-native/label';
import { Input } from '@stage-labs/kit/react-native/input';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Checkbox } from '@stage-labs/kit/react-native/checkbox';
import { RadioGroup } from '@stage-labs/kit/react-native/radio-group';
import { Select } from '@stage-labs/kit/react-native/select';
import { DatePicker } from '@stage-labs/kit/react-native/date-picker';
import { Form } from '@stage-labs/kit/react-native/form';
import { Markdown } from '@stage-labs/kit/react-native/markdown';
import { Table } from '@stage-labs/kit/react-native/table';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import type { WidgetRoot } from '@stage-labs/kit/kit';
import { EXTENSION_WIDGET } from './KitSections.extensions';
import { GallerySection } from './GallerySection';
import type { GalleryPalette } from './galleryPalette';

const CHART_WIDGET: WidgetRoot = {
  type: 'Card',
  children: [
    { type: 'Title', value: 'Weekly volume', size: 'md' },
    {
      type: 'Chart',
      height: 200,
      showYAxis: true,
      showLegend: true,
      xAxis: { dataKey: 'day' },
      data: [
        { day: 'Mon', sent: 12, received: 8 },
        { day: 'Tue', sent: 18, received: 14 },
        { day: 'Wed', sent: 9, received: 20 },
        { day: 'Thu', sent: 22, received: 11 },
        { day: 'Fri', sent: 16, received: 19 },
      ],
      series: [
        { type: 'bar', dataKey: 'sent', label: 'Sent' },
        { type: 'bar', dataKey: 'received', label: 'Received' },
      ],
    },
  ],
};

const SAMPLE_ICONS = ['cog', 'bell', 'wallet', 'chat', 'user', 'check'] as const;
const LIST_ROWS = ['Display', 'Messenger', 'Notifications', 'Security'];
const SAMPLE_IMAGE = 'https://cdn.stamp.fyi/avatar/eth:0x2539f6dd5e4ab2c3a30c2b9a0a8a8a8a8a8a79d5?s=160';

function TypographySections({ dark, head, sub, border }: GalleryPalette): React.ReactElement {
  const sec = { head, sub, border };
  return (
    <>
      <GallerySection name="Title" note="Heading typography, levels 1-3" {...sec} innerPadH={14} innerPadV={12}>
        <Title level={1} color={head}>Level 1 title</Title>
        <Title level={2} color={head}>Level 2 title</Title>
        <Title level={3} color={head}>Level 3 title</Title>
      </GallerySection>

      <GallerySection name="Text" note="Kit value / size / weight / textAlign" {...sec} innerPadH={14} innerPadV={12}>
        <Text value="Body text - the default paragraph style."/>
        <Text role="secondary" value="Secondary text - muted supporting copy."/>
        <Text role="secondary" size="xs" value="Caption text - smallest label."/>
        <Text weight="semibold" textAlign="center" value="Semibold, centered."/>
        <Text italic lineThrough value="Italic + line-through."/>
        <Text variant="mono" value="0xabc...1234"/>
      </GallerySection>

      <GallerySection name="Button" note="Kit color + variant + size + iconStart/iconEnd" {...sec} innerPadH={14} innerPadV={12}>
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Button dark={dark} color="primary" label="Primary"/>
          <Button dark={dark} color="secondary" label="Secondary"/>
          <Button dark={dark} color="primary" variant="ghost" label="Ghost"/>
          <Button dark={dark} color="danger" label="Danger"/>
        </Row>
        <Row margin={{ top: 10 }} gap={8} style={{ flexWrap: 'wrap' }}>
          <Button dark={dark} color="info" variant="soft" label="Soft"/>
          <Button dark={dark} color="success" variant="outline" label="Outline"/>
          <Button dark={dark} color="warning" label="Warning"/>
        </Row>
        <Row margin={{ top: 10 }} gap={8} align="center" style={{ flexWrap: 'wrap' }}>
          <Button dark={dark} size="sm" label="Small"/>
          <Button dark={dark} size="lg" label="Large"/>
          <Button dark={dark} block label="Block"/>
        </Row>
        <Row margin={{ top: 10 }} gap={8} align="center" style={{ flexWrap: 'wrap' }}>
          <Button dark={dark} color="primary"
            label="iconStart" iconStart={<Icon name="check" size={18} color={dark ? '#000' : '#fff'} />}/>
          <Button dark={dark} color="secondary"
            label="iconEnd" iconEnd={<Icon name="check" size={18} color={head} />}/>
          <Button dark={dark} color="secondary" pill iconStart={<Icon name="cog" size={18} color={head} />}/>
        </Row>
      </GallerySection>

      <GallerySection name="Icon" note="Heroicon vocabulary, head-tinted" {...sec} innerPadH={14} innerPadV={14}>
        <Row gap={18} style={{ flexWrap: 'wrap' }}>
          {SAMPLE_ICONS.map((n) => <Icon key={n} name={n} size={26} color={head} />)}
        </Row>
      </GallerySection>
    </>
  );
}

function SurfaceSections({ dark, head, sub, border }: GalleryPalette): React.ReactElement {
  const sec = { head, sub, border };
  return (
    <>
      <GallerySection name="Card" note="Kit surface with status + actions" {...sec} framed={false}>
        <Card dark={dark}
          status={{ text: 'Pending confirmation' }}
          confirm={{ label: 'Confirm', onPress: () => undefined }}
          cancel={{ label: 'Cancel', onPress: () => undefined }}
>
          <Text>A bordered Card surface holding arbitrary body content.</Text>
        </Card>
      </GallerySection>

      <GallerySection name="ListView" note="Grouped rows (ListView + ListViewItem)" {...sec} framed={false}>
        <ListView dark={dark} status={{ text: `${LIST_ROWS.length} items` }}>
          {LIST_ROWS.map((label) => (
            <ListViewItem key={label} dark={dark} onPress={() => undefined}>
              <Icon name="cog" size={22} color={head}/>
              <Col flex={1}>
                <Text color={head} weight="medium" size="xl">{label}</Text>
              </Col>
              <Icon name="chevronRight" size={18} color={sub}/>
            </ListViewItem>
          ))}
        </ListView>
      </GallerySection>

      <GallerySection name="Divider" note="Hairline separator - spacing / flush / thickness" {...sec} innerPadH={14} innerPadV={14}>
        <Text>Above the divider</Text>
        <Divider dark={dark} spacing={12}/>
        <Text>Between two dividers</Text>
        <Divider dark={dark} spacing={12} size={2}/>
        <Text>Below the thick divider</Text>
      </GallerySection>

      <GallerySection name="Caption" note="Section labels / muted secondary text" {...sec} innerPadH={14} innerPadV={14}>
        <Caption value="DEFAULT CAPTION"/>
        <Caption value="Semibold caption" weight="semibold"/>
        <Caption value="Small centered caption" size="sm" textAlign="center"/>
      </GallerySection>

      <GallerySection name="Image" note="Unified image - fit / radius / frame" {...sec} innerPadH={14} innerPadV={14}>
        <Row gap={12} align="center" style={{ flexWrap: 'wrap' }}>
          <Image src={SAMPLE_IMAGE} size={56} radius="full" fit="cover" alt="Round avatar"/>
          <Image src={SAMPLE_IMAGE} size={56} radius="lg" fit="cover" alt="Rounded square"/>
          <Image src={SAMPLE_IMAGE} size={56} radius="lg" frame fit="contain" alt="Framed contain"/>
        </Row>
      </GallerySection>

      <GallerySection name="Spacer" note="Flexible gap - pushes siblings apart" {...sec} innerPadH={14} innerPadV={14}>
        <Row align="center">
          <Text color={head}>Start</Text>
          <Spacer/>
          <Text role="secondary">End</Text>
        </Row>
      </GallerySection>
    </>
  );
}

function FormSections({ dark, head, sub, border }: GalleryPalette): React.ReactElement {
  const sec = { head, sub, border };
  return (
    <>
      <GallerySection name="Label" note="Form-field label - size / weight / align" {...sec} innerPadH={14} innerPadV={14}>
        <Label dark={dark} fieldName="email" value="Email address"/>
        <Label dark={dark} value="Semibold large label" size="lg" weight="semibold"/>
      </GallerySection>

      <GallerySection name="Input" note="Single-line field - soft / outline / pill" {...sec} innerPadH={14} innerPadV={14}>
        <Box gap={10}>
          <Input dark={dark} name="soft" placeholder="Soft input" variant="soft"/>
          <Input dark={dark} name="outline" placeholder="Outline input" variant="outline"/>
          <Input dark={dark} name="pill" placeholder="Pill input" variant="soft" pill/>
        </Box>
      </GallerySection>

      <GallerySection name="Textarea" note="Multi-line field - rows / auto-resize" {...sec} innerPadH={14} innerPadV={14}>
        <Textarea dark={dark} name="bio" placeholder="Tell us about yourself..." rows={3} maxRows={6}/>
      </GallerySection>

      <GallerySection name="Checkbox" note="Boolean control - label / checked" {...sec} innerPadH={14} innerPadV={14}>
        <Box gap={10}>
          <Checkbox dark={dark} name="terms" label="Accept the terms" defaultChecked/>
          <Checkbox dark={dark} name="news" label="Subscribe to updates"/>
        </Box>
      </GallerySection>

      <GallerySection name="RadioGroup" note="Single-select - options / direction" {...sec} innerPadH={14} innerPadV={14}>
        <RadioGroup dark={dark} name="plan" defaultValue="pro"
          options={[
            { label: 'Free', value: 'free' },
            { label: 'Pro', value: 'pro' },
            { label: 'Team', value: 'team' },
          ]}/>
      </GallerySection>

      <GallerySection name="Select" note="Dropdown - options / placeholder / clearable" {...sec} innerPadH={14} innerPadV={14}>
        <Box gap={10}>
          <Select dark={dark} name="network" placeholder="Choose a network" clearable
            options={[
              { label: 'Ethereum', value: 'eth' },
              { label: 'Base', value: 'base' },
              { label: 'Optimism', value: 'op' },
              { label: 'Arbitrum', value: 'arb' },
            ]}/>
          <Select dark={dark} name="role" variant="outline" defaultValue="admin"
            options={[
              { label: 'Admin', value: 'admin' },
              { label: 'Member', value: 'member' },
            ]}/>
        </Box>
      </GallerySection>

      <GallerySection name="DatePicker" note="Calendar field - defaultValue / min / clearable" {...sec} innerPadH={14} innerPadV={14}>
        <Box gap={10}>
          <DatePicker dark={dark} name="when" placeholder="Pick a date" clearable/>
          <DatePicker dark={dark} name="dob" variant="outline" defaultValue="2026-01-15"/>
        </Box>
      </GallerySection>

      <GallerySection name="Form" note="Groups controls + onSubmit" {...sec} innerPadH={14} innerPadV={14}>
        <Form onSubmit={() => undefined}>
          <Label dark={dark} fieldName="name" value="Display name"/>
          <Input dark={dark} name="name" placeholder="Satoshi"/>
          <Select dark={dark} name="plan" placeholder="Select a plan"
            options={[
              { label: 'Free', value: 'free' },
              { label: 'Pro', value: 'pro' },
            ]}/>
          <Button dark={dark} variant="primary" label="Submit"/>
        </Form>
      </GallerySection>
    </>
  );
}

function ContentSections({ dark, head, sub, border }: GalleryPalette): React.ReactElement {
  const sec = { head, sub, border };
  return (
    <>
      <GallerySection name="Markdown" note="Kit value - headings / code / links" {...sec} innerPadH={14} innerPadV={12}>
        <Markdown dark={dark}
          value={'## Markdown\nRenders **bold**, _italic_, `inline code`, and [links](https://metro.box).\n\n- Bulleted item\n- Second item\n\n```\ncode fence\n```'}/>
      </GallerySection>

      <GallerySection name="Table" note="Kit Table / Row / Cell - header + data" {...sec} framed={false}>
        <Table dark={dark}>
          <Table.Row header>
            <Table.Cell><Text weight="semibold">Token</Text></Table.Cell>
            <Table.Cell align="end"><Text weight="semibold">Balance</Text></Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell><Text>ETH</Text></Table.Cell>
            <Table.Cell align="end"><Text variant="mono">1.42</Text></Table.Cell>
          </Table.Row>
          <Table.Row>
            <Table.Cell><Text>USDC</Text></Table.Cell>
            <Table.Cell align="end"><Text variant="mono">980.00</Text></Table.Cell>
          </Table.Row>
        </Table>
      </GallerySection>

      <GallerySection name="Chart" note="JSON widget - bar/line/area series, SVG renderer" {...sec} framed={false}>
        <ViewHost node={CHART_WIDGET} />
      </GallerySection>

      <GallerySection name="Scroll" note="Kit ScrollView wrapper - padding / gap shorthands" {...sec} innerPadH={14} innerPadV={12}>
        <Scroll horizontal gap={8} style={{ maxHeight: 48 }} showsHorizontalScrollIndicator={false}>
          {['One', 'Two', 'Three', 'Four', 'Five'].map((n) => (
            <Box padding={{ x: 12, y: 8 }} key={n} radius="sm" background={dark ? '#1c1c1e' : '#f0f0f2'}>
              <Text>{n}</Text>
            </Box>
          ))}
        </Scroll>
      </GallerySection>

      <GallerySection name="Pressable" note="Kit Pressable wrapper - pressedOpacity feedback" {...sec} innerPadH={14} innerPadV={12}>
        <Pressable pressedOpacity={0.5} onPress={() => undefined}>
          <Box padding={{ x: 12, y: 10 }} radius="sm" background={dark ? '#1c1c1e' : '#f0f0f2'}>
            <Text>Tap me - dims on press</Text>
          </Box>
        </Pressable>
      </GallerySection>
    </>
  );
}

function ExtensionSections({ head, sub, border }: GalleryPalette): React.ReactElement {
  const sec = { head, sub, border };
  return (
    <GallerySection
      name="Extension nodes"
      note="Spinner / Switch / Tabs / AvatarStack / QRCode / TextField / ColorPicker / Pressable / Audio / Video / FilePicker / VoiceRecorder - all JSON, via ViewHost"
      {...sec}
      framed={false}
    >
      <ViewHost node={EXTENSION_WIDGET} />
    </GallerySection>
  );
}

export function KitSections(p: GalleryPalette): React.ReactElement {
  return (
    <Box>
      <TypographySections {...p} />
      <SurfaceSections {...p} />
      <FormSections {...p} />
      <ContentSections {...p} />
      <ExtensionSections {...p} />
    </Box>
  );
}

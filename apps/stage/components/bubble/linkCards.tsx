import { router } from 'expo-router';
import { ChannelRow } from '../ChannelRow';
import { Box, Col, Row } from '../layout';
import { useConvMeta } from '../../modules/messaging/queries';
import { shortAddress } from '@stage-labs/client/identity/format';
import { usePeerProfiles, getPeerName, isPeerResolved } from '../../lib/peerProfiles';
import { channelStampSeed } from '@stage-labs/kit/avatar';
import { usePalette, DANGER, SUCCESS } from '../../lib/theme';
import { BLOCK_RADIUS_DEFAULT, schemePalette } from '@stage-labs/kit/tokens';
import { bubbleLinkProps } from './linkProps';
import { openInBubbleLink } from '../../lib/safeOpenLink';
import { channelTitle, type ConvTitle } from '../conversation/convTitle';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { previewLinkOf } from '@stage-labs/client/embed/cardLinks';
import { githubLinkOf } from '@stage-labs/client/api/github';
import { useGithubMeta, type GithubMeta } from '../../lib/useGithubMeta';
import { TEXT_11PX } from '../smallText';
import type { SpacingValue } from '@stage-labs/kit/layout';
import { Image } from '@stage-labs/kit/react-native/image';
import { domainOf } from '../../lib/format';
import { useLinkPreview, isX402, type LinkPreviewResult } from '../../lib/useLinkPreview';
import { X402Card } from '../PaymentCard';
import Svg, { Path } from 'react-native-svg';

const GITHUB_PATH =
  'M512 0C229.12 0 0 229.12 0 512c0 226.56 146.56 417.92 350.08 485.76 25.6 4.48 35.2-10.88 35.2-24.32 0-12.16-0.64-52.48-0.64-95.36-128.64 23.68-161.92-31.36-172.16-60.16-5.76-14.72-30.72-60.16-52.48-72.32-17.92-9.6-43.52-33.28-0.64-33.92 40.32-0.64 69.12 37.12 78.72 52.48 46.08 77.44 119.68 55.68 149.12 42.24 4.48-33.28 17.92-55.68 32.64-68.48-113.92-12.8-232.96-56.96-232.96-252.8 0-55.68 19.84-101.76 52.48-137.6-5.12-12.8-23.04-65.28 5.12-135.68 0 0 42.88-13.44 140.8 52.48 40.96-11.52 84.48-17.28 128-17.28 43.52 0 87.04 5.76 128 17.28 97.92-66.56 140.8-52.48 140.8-52.48 28.16 70.4 10.24 122.88 5.12 135.68 32.64 35.84 52.48 81.28 52.48 137.6 0 196.48-119.68 240-233.6 252.8 18.56 16 34.56 46.72 34.56 94.72 0 68.48-0.64 123.52-0.64 140.8 0 13.44 9.6 29.44 35.2 24.32A512.832 512.832 0 0 0 1024 512c0-282.88-229.12-512-512-512z';

export function GithubLogo({
  size = 22,
  color = '#000000',
}: {
  size?: number;
  color?: string;
}): React.ReactElement {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Path d={GITHUB_PATH} fill={color} />
    </Svg>
  );
}

function LinkPreviewBody({ meta, url, subColor, imageBg }: {
  meta: Exclude<LinkPreviewResult, { kind: 'x402' }>; url: string; subColor: string; imageBg: string;
}): React.ReactElement {
  const domain = meta.siteName == null || meta.siteName === ''
    ? domainOf(meta.url == null || meta.url === '' ? url : meta.url)
    : meta.siteName;
  return (
    <>
      {meta.image ? (
        <Image src={meta.image} alt={meta.title} fit="cover" background={imageBg} style={{ width: '100%', height: 160 }} />
      ) : null}
      <Box padding={{ x: 12, y: 10 }}>
        <Row margin={{ bottom: 4 }} align="center" justify="start">
          {meta.favicon ? (
            <Image src={meta.favicon} alt={domain} radius="xs" style={{ width: 14, height: 14, marginRight: 6 }} />
          ) : null}
          <Text color={subColor} numberOfLines={1} style={TEXT_11PX}>{domain}</Text>
        </Row>
        <LinkCardText title={meta.title === '' ? undefined : meta.title} description={meta.description} subColor={subColor} />
      </Box>
    </>
  );
}

function CardFrame({ background, padding, children }: {
  background?: string; padding?: SpacingValue; children: React.ReactNode;
}): React.ReactElement {
  const { border } = usePalette();
  return (
    <Box background={background} padding={padding} radius={BLOCK_RADIUS_DEFAULT} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
      {children}
    </Box>
  );
}

function OutlinedLinkCard({ url, padding, children }: {
  url: string; padding?: SpacingValue; children: React.ReactNode;
}): React.ReactElement {
  return (
    <Pressable {...bubbleLinkProps(url, openInBubbleLink)}>
      <CardFrame background={'transparent'} padding={padding}>
        {children}
      </CardFrame>
    </Pressable>
  );
}

function LinkCardText({ title, description, subColor }: {
  title?: string; description?: string; subColor: string;
}): React.ReactElement {
  return (
    <>
      {title === undefined ? null : (
        <Text weight="semibold" size="xl" numberOfLines={2}>{title}</Text>
      )}
      {description ? (
        <Text size="2xs" color={subColor} style={{ lineHeight: 21, marginTop: 3 }} numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </>
  );
}

export function LinkPreviewCard({ url, dark }: {
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const meta = useLinkPreview(url);
  const pal = usePalette();
  if (!meta) return null;
  if (isX402(meta)) return <X402Card challenge={meta} dark={dark} />;

  return (
    <OutlinedLinkCard url={url}>
      <LinkPreviewBody meta={meta} url={url} subColor={pal.text} imageBg={pal.bg} />
    </OutlinedLinkCard>
  );
}

const DOT: Record<string, string> = {
  open: SUCCESS, merged: '#a371f7', closed: DANGER,
};

const fmt = (n: number): string => n.toLocaleString('en-US');

function GithubDiffStats({ meta }: { meta: GithubMeta }): React.ReactElement | null {
  if (meta.kind !== 'pull' || (meta.additions == null && meta.deletions == null)) return null;
  return (
    <>
      {meta.additions != null ? (
        <Text weight="semibold" color={SUCCESS} style={[TEXT_11PX, { marginLeft: 8 }]}>+{fmt(meta.additions)}</Text>
      ) : null}
      {meta.deletions != null ? (
        <Text weight="semibold" color={DANGER} style={[TEXT_11PX, { marginLeft: 6 }]}>−{fmt(meta.deletions)}</Text>
      ) : null}
    </>
  );
}

function GithubFooter({ meta, subColor }: { meta: GithubMeta; subColor: string }): React.ReactElement {
  const dot = DOT[meta.state];
  return (
    <Row margin={{ top: 6 }} align="center" justify="start">
      {dot ? (
        <Box width={8} height={8} radius="full" background={dot} margin={{ right: 6 }}/>
      ) : null}
      {meta.state ? (
        <Text color={subColor} style={[TEXT_11PX, { textTransform: 'capitalize' }]}>{meta.state}</Text>
      ) : null}
      {meta.kind === 'repo' && meta.stars != null ? (
        <Text color={subColor} style={TEXT_11PX}>★ {meta.stars}</Text>
      ) : null}
      {meta.author ? (
        <Text color={subColor} style={[TEXT_11PX, { marginLeft: meta.state ? 8 : 0 }]}>{meta.author}</Text>
      ) : null}
      <GithubDiffStats meta={meta} />
    </Row>
  );
}

export function GitHubLinkCard({ url }: { url: string }): React.ReactElement | null {
  const ref = githubLinkOf(url);
  const meta = useGithubMeta(ref);
  const pal = usePalette();
  if (!ref || !meta) return null;

  const subColor = pal.text;
  const numLabel = meta.number != null ? `#${meta.number}` : null;

  return (
    <OutlinedLinkCard url={url} padding={{ x: 12, y: 10 }}>
      <Row margin={{ bottom: 4 }} align="center" justify="start">
        <GithubLogo size={16} color={pal.link}/>
        <Text color={subColor} style={[TEXT_11PX, { marginLeft: 6 }]}>
          {meta.repo}{numLabel ? ` · ${numLabel}` : ''}
        </Text>
      </Row>
      <LinkCardText title={meta.title} description={meta.description} subColor={subColor} />
      <GithubFooter meta={meta} subColor={subColor} />
    </OutlinedLinkCard>
  );
}

export function PreviewLinkCard({ url }: { url: string }): React.ReactElement | null {
  const dark = useKitScheme() === 'dark';
  const ref = previewLinkOf(url);
  if (!ref) return null;

  const pressedBg = schemePalette(dark).pressed;
  return (
    <Pressable {...bubbleLinkProps(ref.url, openInBubbleLink)} style={({ pressed }) => (pressed ? { backgroundColor: pressedBg } : undefined)}>
      <ListViewItem dark={dark}>
        <Col radius="lg">
          <Col gap={2} padding={{ x: 12, y: 10 }}>
            <Text size="2xs" value="Open preview build" weight="semibold" truncate />
            <Caption value={`EAS Update · ${ref.shortGroup}`} color="secondary" maxLines={2} />
          </Col>
        </Col>
      </ListViewItem>
    </Pressable>
  );
}

export function ChannelCard(
  { convId, peerAddress, url }: { convId?: string; peerAddress?: string; url: string },
): React.ReactElement | null {
  if (peerAddress) return <DmPeerCard address={peerAddress} url={url} />;
  if (!convId) return null;
  return <ConvIdCard convId={convId} url={url} />;
}

function cardTitle(meta: ReturnType<typeof useConvMeta>, convId: string): ConvTitle {
  if (meta.isGroup) return channelTitle(meta.groupName, 'Channel');
  const peerName = getPeerName(meta.peerAddr);
  if (peerName != null && peerName !== '') return { text: peerName, placeholder: false };
  if (meta.peerAddr) return { text: shortAddress(meta.peerAddr), placeholder: false };
  return { text: `Channel ${convId.slice(0, 6)}…`, placeholder: true };
}

function convSubtitle(meta: ReturnType<typeof useConvMeta>): string {
  if (meta.isGroup) return meta.memberAddrs.length ? `${meta.memberAddrs.length} members` : 'Channel';
  return meta.peerAddr ? 'Direct message' : 'Open channel';
}

function convAvatar(
  meta: ReturnType<typeof useConvMeta>, convId: string,
): { avatarUri: string | null; avatarAddress: string | null } {
  const isGroup = meta.isGroup;
  const avatarUri = isGroup ? (meta.groupImage?.trim() || null) : null;
  const avatarSeed = isGroup ? (avatarUri ? null : channelStampSeed(convId)) : meta.peerAddr;
  let avatarAddress: string | null = null;
  if (!avatarUri && avatarSeed && (isGroup || isPeerResolved(avatarSeed))) avatarAddress = avatarSeed;
  return { avatarUri, avatarAddress };
}

function ConvIdCard({ convId, url }: { convId: string; url: string }): React.ReactElement {
  const meta = useConvMeta(convId);
  usePeerProfiles([meta.peerAddr]);

  const title = cardTitle(meta, convId);
  const subtitle = convSubtitle(meta);
  const { avatarUri, avatarAddress } = convAvatar(meta, convId);

  const open = (): void => {
    router.push({ pathname: '/channel/[convId]', params: { convId } });
  };

  return (
    <CardFrame>
      <ChannelRow
        title={title.text}
        placeholderTitle={title.placeholder}
        subtitle={subtitle}
        avatarUri={avatarUri}
        avatarAddress={avatarAddress}
        square={meta.isGroup}
        onPress={open}
        linkProps={url ? bubbleLinkProps(url, openInBubbleLink) : undefined}
      />
    </CardFrame>
  );
}

function DmPeerCard({ address, url }: { address: string; url: string }): React.ReactElement {
  usePeerProfiles([address]);

  const peerName = getPeerName(address);
  const title = peerName == null || peerName === '' ? shortAddress(address) : peerName;
  const avatarAddress = !isPeerResolved(address) ? null : address;

  const open = (): void => {
    router.push({ pathname: '/[convId]', params: { convId: address } });
  };

  return (
    <CardFrame>
      <ChannelRow
        title={title}
        subtitle="Direct message"
        avatarAddress={avatarAddress}
        onPress={open}
        linkProps={url ? bubbleLinkProps(url, openInBubbleLink) : undefined}
      />
    </CardFrame>
  );
}


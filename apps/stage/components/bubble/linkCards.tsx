import { router } from 'expo-router';
import { channelLinkOf } from '@stage-labs/client/routing/deepLinks';
import { dmLinkOf } from '../../lib/links';
import { ChannelRow } from '../chatRow/ChannelRow';
import { useConvRow } from '../../lib/messaging/queries';
import { isGroupRow, memberAddressesOf, type ConvRow } from '../../lib/messaging/convRow.model';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { usePalette, DANGER, SUCCESS } from '../../lib/theme';
import { BLOCK_RADIUS_DEFAULT, schemePalette } from '@stage-labs/kit/tokens';
import { bubbleLinkProps } from '../links/linkProps';
import { openInBubbleLink } from '../../lib/capabilities';
import { channelAvatar, channelTitle, peerTitle, resolvedPeerAddress, type ConvAvatar, type ConvTitle } from '../../lib/convIdentity';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { previewLinkOf } from '@stage-labs/client/embed/cardLinks';
import { githubLinkOf, type GithubMeta } from '@stage-labs/client/api/github';
import { useGithubMeta } from '../../lib/useGithubMeta';
import type { SpacingValue } from '@stage-labs/kit/layout';
import { Image } from '@stage-labs/kit/react-native/image';
import { domainOf } from '../../lib/format';
import { useLinkPreview } from '../../lib/useLinkPreview';
import { isX402, type LinkPreviewResult } from '@stage-labs/client/api/linkPreview';
import { X402Card } from './PaymentCard';
import { GithubLogo } from '../logos/GithubLogo';
import { Column, Row } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';

function LinkPreviewBody({
  meta,
  url,
  subColor,
  imageBg,
}: {
  meta: Exclude<LinkPreviewResult, { kind: 'x402' }>;
  url: string;
  subColor: string;
  imageBg: string;
}): React.ReactElement {
  const domain =
    meta.siteName == null || meta.siteName === '' ? domainOf(meta.url == null || meta.url === '' ? url : meta.url) : meta.siteName;
  return (
    <>
      {meta.image ? (
        <Image url={meta.image} description={meta.title} fit="cover" background={imageBg} style={{ width: '100%', height: 160 }} />
      ) : null}
      <Column padding={{ x: 12, y: 10 }}>
        <Row margin={{ bottom: 4 }} align="center" justify="start">
          {meta.favicon ? (
            <Image fit="cover" url={meta.favicon} description={domain} radius="xs" style={{ width: 14, height: 14, marginRight: 6 }} />
          ) : null}
          <Text color={subColor} numberOfLines={1} size="3xs">
            {domain}
          </Text>
        </Row>
        <LinkCardText title={meta.title === '' ? undefined : meta.title} description={meta.description} subColor={subColor} />
      </Column>
    </>
  );
}

function CardFrame({
  background,
  padding,
  children,
}: {
  background?: string;
  padding?: SpacingValue;
  children: React.ReactNode;
}): React.ReactElement {
  const { border } = usePalette();
  return (
    <Column
      background={background}
      padding={padding}
      radius={BLOCK_RADIUS_DEFAULT}
      style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}
    >
      {children}
    </Column>
  );
}

function OutlinedLinkCard({
  url,
  padding,
  children,
}: {
  url: string;
  padding?: SpacingValue;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Pressable {...bubbleLinkProps(url, openInBubbleLink)}>
      <CardFrame background="transparent" padding={padding}>
        {children}
      </CardFrame>
    </Pressable>
  );
}

function LinkCardText({ title, description, subColor }: { title?: string; description?: string; subColor: string }): React.ReactElement {
  return (
    <>
      {title === undefined ? null : (
        <Text fontWeight="semibold" size="xl" numberOfLines={2}>
          {title}
        </Text>
      )}
      {description ? (
        <Text size="xs" color={subColor} style={{ lineHeight: 21, marginTop: 3 }} numberOfLines={2}>
          {description}
        </Text>
      ) : null}
    </>
  );
}

export function LinkPreviewCard({ url, dark }: { url: string; dark?: boolean }): React.ReactElement | null {
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

const DOT: Record<string, string> = { open: SUCCESS, merged: '#a371f7', closed: DANGER };

const fmt = (n: number): string => n.toLocaleString('en-US');

function GithubDiffStats({ meta }: { meta: GithubMeta }): React.ReactElement | null {
  if (meta.kind !== 'pull' || (meta.additions == null && meta.deletions == null)) return null;
  return (
    <>
      {meta.additions != null ? (
        <Text fontWeight="semibold" color={SUCCESS} size="3xs" style={{ marginLeft: 8 }}>
          +{fmt(meta.additions)}
        </Text>
      ) : null}
      {meta.deletions != null ? (
        <Text fontWeight="semibold" color={DANGER} size="3xs" style={{ marginLeft: 6 }}>
          −{fmt(meta.deletions)}
        </Text>
      ) : null}
    </>
  );
}

function GithubFooter({ meta, subColor }: { meta: GithubMeta; subColor: string }): React.ReactElement {
  const dot = DOT[meta.state];
  return (
    <Row margin={{ top: 6 }} align="center" justify="start">
      {dot ? <Column width={8} height={8} radius="full" background={dot} margin={{ right: 6 }} /> : null}
      {meta.state ? (
        <Text color={subColor} size="3xs" textTransform="capitalize">
          {meta.state}
        </Text>
      ) : null}
      {meta.kind === 'repo' && meta.stars != null ? (
        <Text color={subColor} size="3xs">
          ★ {meta.stars}
        </Text>
      ) : null}
      {meta.author ? (
        <Text color={subColor} size="3xs" style={{ marginLeft: meta.state ? 8 : 0 }}>
          {meta.author}
        </Text>
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
        <GithubLogo size={16} color={pal.link} />
        <Text color={subColor} size="3xs" style={{ marginLeft: 6 }}>
          {meta.repo}
          {numLabel ? ` · ${numLabel}` : ''}
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
    <Pressable
      {...bubbleLinkProps(ref.url, openInBubbleLink)}
      style={({ pressed }) => (pressed ? { backgroundColor: pressedBg } : undefined)}
    >
      <ListViewItem dark={dark}>
        <Column radius="lg">
          <Column gap={2} padding={{ x: 12, y: 10 }}>
            <Text size="xs" text="Open preview build" fontWeight="semibold" truncate />
            <Text size="md" variant="caption" text={`EAS Update · ${ref.shortGroup}`} color="secondary" maxLines={2} />
          </Column>
        </Column>
      </ListViewItem>
    </Pressable>
  );
}

export function ChannelCard({
  convId,
  peerAddress,
  url,
}: {
  convId?: string;
  peerAddress?: string;
  url: string;
}): React.ReactElement | null {
  if (peerAddress) return <DmPeerCard address={peerAddress} url={url} />;
  if (!convId) return null;
  return <ConvIdCard convId={convId} url={url} />;
}

function cardTitle(row: ConvRow | null, convId: string): ConvTitle {
  if (isGroupRow(row)) return channelTitle(row?.groupName ?? null, 'Channel');
  if (row?.peerAddress) return peerTitle(row.peerAddress);
  return { text: `Channel ${convId.slice(0, 6)}…`, placeholder: true };
}

function convSubtitle(row: ConvRow | null): string {
  const count = memberAddressesOf(row).length;
  if (isGroupRow(row)) return count ? `${count} members` : 'Channel';
  return row?.peerAddress ? 'Direct message' : 'Open channel';
}

function convAvatar(row: ConvRow | null, convId: string): ConvAvatar {
  if (row === null || row.peerAddress !== null) return { avatarUri: null, avatarAddress: resolvedPeerAddress(row?.peerAddress) };
  return channelAvatar(convId, row.avatarUri);
}

function ConvIdCard({ convId, url }: { convId: string; url: string }): React.ReactElement {
  const row = useConvRow(convId);
  usePeerProfiles([row?.peerAddress ?? null]);

  const title = cardTitle(row, convId);
  const subtitle = convSubtitle(row);
  const { avatarUri, avatarAddress } = convAvatar(row, convId);

  return (
    <CardFrame>
      <ChannelRow
        title={title.text}
        placeholderTitle={title.placeholder}
        subtitle={subtitle}
        avatarUri={avatarUri}
        avatarAddress={avatarAddress}
        square={isGroupRow(row)}
        onPress={() => {
          router.push(channelLinkOf(convId));
        }}
        linkProps={url ? bubbleLinkProps(url, openInBubbleLink) : undefined}
      />
    </CardFrame>
  );
}

function DmPeerCard({ address, url }: { address: string; url: string }): React.ReactElement {
  usePeerProfiles([address]);

  return (
    <CardFrame>
      <ChannelRow
        title={peerTitle(address).text}
        subtitle="Direct message"
        avatarAddress={resolvedPeerAddress(address)}
        onPress={() => {
          router.push(dmLinkOf(address));
        }}
        linkProps={url ? bubbleLinkProps(url, openInBubbleLink) : undefined}
      />
    </CardFrame>
  );
}

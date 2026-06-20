/** @file Generic rich preview card for a plain http(s) link not claimed by a more specific card, fetching OpenGraph/Twitter metadata via the Metro link-preview proxy and rendering nothing on load or failure. */

import { Linking } from 'react-native';

import { Pressable } from '@stage-labs/kit/pressable';
import { Image } from '@stage-labs/kit/image';
import { Text } from '@stage-labs/kit/text';
import { Box, Row } from './layout';
import { domainOf } from '../lib/genericLinkDetect';
import { useLinkPreview, isX402, type LinkPreviewResult } from '../lib/useLinkPreview';
import { X402Card } from './X402Card';
import { usePalette, useBlockRadius } from '../lib/theme';

/** Renders the OpenGraph image/title/description body of a link preview card. */
function LinkPreviewBody({ meta, url, subColor }: {
  meta: Exclude<LinkPreviewResult, { kind: 'x402' }>; url: string; subColor: string;
}): React.ReactElement {
  const domain = meta.siteName == null || meta.siteName === ''
    ? domainOf(meta.url == null || meta.url === '' ? url : meta.url)
    : meta.siteName;
  return (
    <>
      {meta.image ? (
        <Image src={meta.image} alt={meta.title} fit="cover" style={{ width: '100%', height: 160 }} />
      ) : null}
      <Box padding={{ x: 12, y: 10 }}>
        <Row margin={{ bottom: 4 }} align="center" justify="start">
          {meta.favicon ? (
            <Image src={meta.favicon} alt={domain} radius="xs" style={{ width: 14, height: 14, marginRight: 6 }} />
          ) : null}
          <Text size="3xs" color={subColor} numberOfLines={1}>{domain}</Text>
        </Row>
        {meta.title ? (
          <Text weight="semibold" size="4xl" numberOfLines={2}>{meta.title}</Text>
        ) : null}
        {meta.description ? (
          <Text size="md" color={subColor} style={{ lineHeight: 21, marginTop: 3 }} numberOfLines={2}>
            {meta.description}
          </Text>
        ) : null}
      </Box>
    </>
  );
}

/** Renders a generic OpenGraph preview card for a plain link, or nothing while loading or on failure. */
export function LinkPreviewCard({ url, dark }: {
  /** `dark` is forwarded to the x402 payment card (Pay-style button tinting); the OG preview path takes colors from the live palette tokens (same convention as GitHubLinkCard / PreviewLinkCard). */
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const meta = useLinkPreview(url);
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  if (!meta) return null;
  /** The proxy probe found an x402 payment challenge — render the payment card. */
  if (isX402(meta)) return <X402Card challenge={meta} dark={dark} />;

  return (
    <Pressable onPress={() => void Linking.openURL(url)}>
      <Box background={'transparent'} radius={blockRadius} style={{ borderWidth: 1, borderColor: pal.border, overflow: 'hidden' }}>
        <LinkPreviewBody meta={meta} url={url} subColor={pal.text} />
      </Box>
    </Pressable>
  );
}

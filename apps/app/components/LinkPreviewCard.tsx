/** Generic rich preview card for a plain http(s) link found in a message body
 *  (anything not already claimed by a GitHub / channel / YouTube / map / EAS
 *  preview card — see lib/cardLinks.ts). Metadata (OpenGraph / Twitter-card /
 *  title / description / image / favicon) is fetched through the Metro
 *  link-preview proxy via `useLinkPreview`.
 *
 *  Matches the github / channel card look: 1px theme border, rounded (block
 *  radius), transparent fill, palette tokens — plus an optional OG image at the
 *  top. While loading OR on any failure (proxy unreachable, blocked url, no
 *  metadata) the hook returns null and we render NOTHING — the plain text link
 *  stays as-is, never a broken/empty card. Tappable -> opens the link. */

import { Linking } from 'react-native';

import { Pressable } from '@metro-labs/kit/pressable';
import { Image } from '@metro-labs/kit/image';
import { Text } from '@metro-labs/kit/text';
import { Box, Row } from './layout';
import { domainOf } from '../lib/genericLinkDetect';
import { useLinkPreview, isX402 } from '../lib/useLinkPreview';
import { X402Card } from './X402Card';
import { usePalette, useBlockRadius } from '../lib/theme';

export function LinkPreviewCard({ url, dark }: {
  /** `dark` is forwarded to the x402 payment card (Pay-style button tinting);
   *  the OG preview path takes colors from the live palette tokens (same
   *  convention as GitHubLinkCard / PreviewLinkCard). */
  url: string; dark?: boolean;
}): React.ReactElement | null {
  const meta = useLinkPreview(url);
  const pal = usePalette();
  const blockRadius = useBlockRadius();
  if (!meta) return null;
  // The proxy probe found an x402 payment challenge — render the payment card.
  if (isX402(meta)) return <X402Card challenge={meta} dark={dark} />;

  const subColor = pal.text;
  const border = pal.border;
  const domain = meta.siteName || domainOf(meta.url || url);

  return (
    <Pressable onPress={() => void Linking.openURL(url)}>
      <Box background={'transparent'} radius={blockRadius} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
        {meta.image ? (
          <Image
            src={meta.image}
            alt={meta.title}
            fit="cover"
            style={{ width: '100%', height: 160 }}
          />
        ) : null}
        <Box padding={{ x: 12, y: 10 }}>
          <Row margin={{ bottom: 4 }} align="center" justify="start">
            {meta.favicon ? (
              <Image src={meta.favicon} alt={domain} radius="xs" style={{ width: 14, height: 14, marginRight: 6 }} />
            ) : null}
            <Text size="3xs" color={subColor} numberOfLines={1}>
              {domain}
            </Text>
          </Row>
          {meta.title ? (
            <Text weight="semibold" size="4xl" numberOfLines={2}>
              {meta.title}
            </Text>
          ) : null}
          {meta.description ? (
            <Text size="md" color={subColor} style={{ lineHeight: 21, marginTop: 3 }} numberOfLines={2}>
              {meta.description}
            </Text>
          ) : null}
        </Box>
      </Box>
    </Pressable>
  );
}

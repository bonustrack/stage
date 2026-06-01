/** Kit page — a live gallery of @metro-labs/kit components at every supported
 *  size/variant. Each component family (Title, Text, Button, Icons) lives in a
 *  CollapsibleSection: tap the header (kit Title + chevron) to expand/collapse.
 *  Title (levels + size tokens) and Text (variants × sizes × weights) are split
 *  into KitGallery.title / KitGallery.text; Button + Icons keep their own files.
 *  Also hosts the app-wide theme switcher. */

import { Box } from '../layout';
import { Text } from '@metro-labs/kit/text';
import { ThemeSwitcher } from './ThemeSwitcher';
import { CollapsibleSection } from './CollapsibleSection';
import { TitleSection } from './KitGallery.title';
import { TextSection } from './KitGallery.text';
import { BUTTON_VARIANTS, ButtonVariantBlock } from './KitGallery.buttons';
import { IconGallery, ICON_COUNT } from './KitGallery.icons';

export function KitGallery({ dark, head, sub, border, rowBg }: {
  dark: boolean; head: string; sub: string; border: string; rowBg: string;
}): React.ReactElement {
  return (
    <Box style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      <ThemeSwitcher dark={dark} head={head} sub={sub} border={border} rowBg={rowBg} />

      <CollapsibleSection title="Title" dark={dark} head={head} sub={sub} defaultOpen>
        <TitleSection dark={dark} head={head} />
      </CollapsibleSection>

      <CollapsibleSection title="Text" dark={dark} head={head} sub={sub}>
        <TextSection dark={dark} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Button"
        subtitle="Each size (sm/md/lg) in 3 forms: text · text+icon · icon-only pill"
        dark={dark}
        head={head}
        sub={sub}
      >
        {BUTTON_VARIANTS.map((variant) => (
          <ButtonVariantBlock key={variant} variant={variant} dark={dark} sub={sub} />
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="Icons"
        subtitle={`All ${ICON_COUNT} icons in the kit — @metro-labs/kit/icon`}
        dark={dark}
        head={head}
        sub={sub}
      >
        <IconGallery dark={dark} head={head} sub={sub} />
      </CollapsibleSection>

      <Text dark={dark} color={sub} variant="caption" weight="medium" style={{ marginTop: 20 }}>
        Tap a section header to expand or collapse it.
      </Text>
    </Box>
  );
}

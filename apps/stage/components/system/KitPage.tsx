
import { Linking } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col, ScreenScroll } from '../layout';
import { StackHeader } from '../chrome/StackHeader';
import { ThemeSwitcher } from './ThemeSwitcher';
import { KitSections } from './KitSections';
import { GithubLogo } from '../GithubLogo';
import { useGalleryPalette } from './galleryPalette';

const KIT_GITHUB_URL = 'https://github.com/bonustrack/stage/tree/main/packages/kit';

export function KitPage(): React.ReactElement {
  const p = useGalleryPalette();
  const insets = useSafeAreaInsets();

  return (
    <Col surface="surface" flex={1}>
      <StackHeader
        title="Kit"
        trailing={
          <Col flex={1} align="end">
            <Pressable
              onPress={() => { void Linking.openURL(KIT_GITHUB_URL); }}
              hitSlop={8}
              style={{ padding: 4 }}
              accessibilityLabel="View @stage-labs/kit on GitHub"
>
              <GithubLogo size={24} color={p.sub}/>
            </Pressable>
          </Col>
        }
/>
      <ScreenScroll
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
>
        <ThemeSwitcher {...p}/>
        <KitSections {...p}/>
      </ScreenScroll>
    </Col>
  );
}

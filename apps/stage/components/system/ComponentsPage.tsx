import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col, ScreenScroll } from '../layout';
import { StackHeader } from '../chrome/StackHeader';
import { ThemeSwitcher } from './ThemeSwitcher';
import { ComponentsSections } from './ComponentsSections';
import { useGalleryPalette } from './galleryPalette';

export function ComponentsPage(): React.ReactElement {
  const p = useGalleryPalette();
  const insets = useSafeAreaInsets();
  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Components"/>
      <ScreenScroll keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}>
        <ThemeSwitcher {...p}/>
        <ComponentsSections {...p}/>
      </ScreenScroll>
    </Col>
  );
}

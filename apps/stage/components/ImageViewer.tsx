import { useEffect, useState } from 'react';

import { Alert, Platform, type GestureResponderEvent } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Image } from '@stage-labs/kit/react-native/image';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph, type CentralIcon } from '@stage-labs/kit/react-native/glyph';
import { Col, PAGE_GUTTER, Row } from './layout';
import { AnchoredMenu, menuPointBelowEnd } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { MenuList, MenuRow } from './MenuRows';
import { HoverTooltip } from './HoverTooltip';
import { TooltipHost } from './system/TooltipHost';
import { downloadImage } from '../lib/imageDownload';
import { describeError } from '../lib/errorPolicy';
import { useSafeAreaInsets } from '../lib/safeArea';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { isCoarsePointer, lockDocumentScroll } from '../lib/webLayout';
import { ZoomableImage } from './ZoomableImage';
import { IconArrowInbox } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowInbox';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';
import { IconDotGrid1x3Vertical } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconDotGrid1x3Vertical';

const FRAME = Platform.OS === 'web' ? { x: 18, y: 104 } : { x: 0, y: 0 };

function ViewerButton({ icon, label, dark, loading, onPress }: {
  icon: CentralIcon; label: string; dark: boolean; loading?: boolean;
  onPress: (event: GestureResponderEvent) => void;
}): React.ReactElement {
  const { link: head } = usePalette();
  return (
    <HoverTooltip label={label} placement="below">
      <Button
        uniform pill color="secondary" variant="solid" dark={dark} loading={loading}
        accessibilityLabel={label}
        iconStart={<Glyph icon={icon} size={20} color={head}/>}
        onPress={onPress}
      />
    </HoverTooltip>
  );
}

function ViewerMenu({ dark, saving, onDownload }: {
  dark: boolean; saving: boolean; onDownload: () => void;
}): React.ReactElement {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const close = (): void => { setAnchor(null); };
  return (
    <>
      <ViewerButton
        icon={IconDotGrid1x3Vertical} label="More" dark={dark} loading={saving}
        onPress={(e) => { setAnchor(menuPointBelowEnd(e)); }}
      />
      <AnchoredMenu visible={anchor !== null} onClose={close} anchor={anchor}>
        <MenuList dark={dark}>
          <MenuRow icon={IconArrowInbox} label="Download" dark={dark} onPress={() => { close(); onDownload(); }}/>
        </MenuList>
      </AnchoredMenu>
    </>
  );
}

export function ImageViewer({ uri, visible, onClose }: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const [saving, setSaving] = useState(false);
  const dark = useEffectiveColorScheme() === 'dark';
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return undefined;
    return lockDocumentScroll();
  }, [visible]);

  const onDownload = async (): Promise<void> => {
    if (saving || !uri) return;
    setSaving(true);
    try {
      await downloadImage(uri);
    } catch (e) {
      Alert.alert('Download failed', describeError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={visible} onClose={onClose} animationType="fade" backdrop={false} fullBleedPanel gestureRoot>
      <Col background={'rgba(0,0,0,0.97)'} flex={1}>
        {uri && isCoarsePointer() ? (
          <ZoomableImage key={uri} uri={uri} frame={FRAME} onTap={onClose}/>
        ) : (
          <Pressable
            onPress={onClose}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: FRAME.x, paddingVertical: FRAME.y }}
          >
            {uri ? (
              <Image src={uri} style={{ width: '100%', height: '100%' }} fit="contain"/>
            ) : null}
          </Pressable>
        )}

        <Row gap={8} style={{ position: 'absolute', top: insets.top + PAGE_GUTTER, right: PAGE_GUTTER }}>
          <ViewerMenu dark={dark} saving={saving} onDownload={() => { void onDownload(); }}/>
          <ViewerButton icon={IconCrossMedium} label="Close" dark={dark} onPress={onClose}/>
        </Row>
        <TooltipHost/>
      </Col>
    </Dialog>
  );
}

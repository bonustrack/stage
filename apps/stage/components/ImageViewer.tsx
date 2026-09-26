import { useEffect, useState } from 'react';

import { Alert, Platform } from 'react-native';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Dialog } from '@stage-labs/kit/react-native/dialog';
import { Image } from '@stage-labs/kit/react-native/image';
import { Col, PAGE_GUTTER, Row } from './layout';
import { RoundOverflowMenu } from './MenuRows';
import { RoundIconButton } from './RoundIconButton';
import { TooltipHost } from './system/TooltipHost';
import { downloadImage } from '../lib/imageDownload';
import { describeError } from '../lib/errorPolicy';
import { useSafeAreaInsets } from '../lib/safeArea';
import { isCoarsePointer, lockDocumentScroll } from '../lib/webLayout';
import { ZoomableImage } from './ZoomableImage';
import { IconArrowInbox } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowInbox';
import { IconCrossMedium } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCrossMedium';

const FRAME = Platform.OS === 'web' ? { x: 18, y: 104 } : { x: 0, y: 0 };

const VIEWER_MENU = [{ id: 'download', label: 'Download', icon: IconArrowInbox }];

export function ImageViewer({ uri, visible, onClose }: {
  uri: string;
  visible: boolean;
  onClose: () => void;
}): React.ReactElement {
  const [saving, setSaving] = useState(false);
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
          <RoundOverflowMenu items={VIEWER_MENU} loading={saving} onSelect={() => { void onDownload(); }}/>
          <RoundIconButton icon={IconCrossMedium} label="Close" onPress={onClose}/>
        </Row>
        <TooltipHost/>
      </Col>
    </Dialog>
  );
}

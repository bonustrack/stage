import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { parseFrameDoc, type FrameNav } from '@stage-labs/kit/frame';
import { useFrameNavigation, type FrameNavigation } from '@stage-labs/kit/react-native/frame';
import type { FrameContent } from '@stage-labs/client/xmtp/frame';
import type { ScreenScrollHandle } from '../layout/ScreenScroll.types';
import { frameInputOf, frameScreenTitle } from './frame.model';

export interface FrameScreens {
  title: string;
  navigation: FrameNavigation;
  onBack?: () => void;
  scrollRef: RefObject<ScreenScrollHandle | null>;
}

export function useFrameScreens(frame: FrameContent | null, leave: () => void): FrameScreens {
  const parsed = useMemo(() => parseFrameDoc(frame === null ? undefined : frameInputOf(frame)), [frame]);
  const nav = useFrameNavigation(parsed.ok ? parsed.doc.start : '');
  const { screen, depth, navigate: step } = nav;
  const back = useCallback((): boolean => {
    if (depth === 0) return false;
    step({ kind: 'back' });
    return true;
  }, [depth, step]);
  const navigate = useCallback((next: FrameNav): void => {
    if (next.kind === 'back' && depth === 0) leave();
    else step(next);
  }, [depth, step, leave]);
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => { sub.remove(); };
  }, [back]));
  const scrollRef = useRef<ScreenScrollHandle>(null);
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [screen]);
  return {
    title: frame === null ? 'Frame' : frameScreenTitle(frame, parsed, screen),
    navigation: { screen, depth, navigate },
    onBack: depth > 0 ? () => { back(); } : undefined,
    scrollRef,
  };
}

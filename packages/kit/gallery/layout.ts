import { useWindowDimensions } from 'react-native';

const MENU_BELOW = 768;
const STACK_BELOW = 1024;

export function useGalleryLayout(): { menu: boolean; stacked: boolean } {
  const { width } = useWindowDimensions();
  return { menu: width < MENU_BELOW, stacked: width < STACK_BELOW };
}

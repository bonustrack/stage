import { Platform } from 'react-native';
import { PAGES, pageAt, rendererOf, type PageId } from './pages';

const WEB = Platform.OS === 'web';

export function renderedByRoute(id: PageId): boolean {
  return rendererOf(PAGES[id], WEB) === 'route';
}

export function routeRendersPage(pathname: string): boolean {
  const page = pageAt(pathname);
  return page !== undefined && rendererOf(page, WEB) === 'route';
}

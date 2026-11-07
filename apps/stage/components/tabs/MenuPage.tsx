import type { ReactElement, ReactNode } from 'react';
import { Redirect, useIsFocused } from 'expo-router';
import { retryDeveloperMode, useDeveloperMode, useDeveloperModeLoaded, useDeveloperModeLoadFailed } from '../../lib/developerMode';
import { RetryNotice } from '../chrome/RetryNotice';
import { StackPage } from '../chrome/StackPage';
import { useWebTabRail } from '../layout/webLayout';
import { PAGES, type PageId } from './pages';

type MenuPageId = { [K in PageId]: (typeof PAGES)[K] extends { readonly menu: object } ? K : never }[PageId];

export function useDeveloperModeStatus(): 'loading' | 'failed' | 'off' | 'on' {
  const enabled = useDeveloperMode();
  const loaded = useDeveloperModeLoaded();
  const failed = useDeveloperModeLoadFailed();
  if (failed) return 'failed';
  if (!loaded) return 'loading';
  return enabled ? 'on' : 'off';
}

export function DeveloperModeRetry(): ReactElement {
  return <RetryNotice message="Developer mode could not be loaded." onRetry={retryDeveloperMode} />;
}

function DeveloperModeGate({ children }: { children: ReactNode }): ReactElement | null {
  const status = useDeveloperModeStatus();
  const focused = useIsFocused();
  if (status === 'failed') return focused ? <DeveloperModeRetry /> : null;
  if (status === 'loading') return null;
  if (status === 'on') return <>{children}</>;
  return focused ? <Redirect href={PAGES.settings.href} /> : null;
}

export function MenuPageGate({ id, children }: { id: MenuPageId; children: ReactNode }): ReactElement | null {
  return PAGES[id].menu.devOnly ? <DeveloperModeGate>{children}</DeveloperModeGate> : <>{children}</>;
}

interface MenuPageProps {
  id: MenuPageId;
  sub?: string;
  trailing?: ReactNode;
  keyboardShouldPersistTaps?: 'handled';
  list?: boolean;
  children: ReactNode;
}

function MenuPageFrame({ id, sub, trailing, keyboardShouldPersistTaps, list, children }: MenuPageProps): ReactElement {
  const page: { readonly href: string; readonly label: string; readonly tabBar?: boolean } = PAGES[id];
  const rail = useWebTabRail();
  const top = sub === undefined;
  return (
    <StackPage
      title={sub ?? page.label}
      back={top ? page.tabBar !== true && !rail : true}
      backTo={top ? PAGES.settings.href : page.href}
      trailing={trailing}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      list={list}
    >
      {children}
    </StackPage>
  );
}

export function MenuPage(props: MenuPageProps): ReactElement | null {
  return (
    <MenuPageGate id={props.id}>
      <MenuPageFrame {...props} />
    </MenuPageGate>
  );
}

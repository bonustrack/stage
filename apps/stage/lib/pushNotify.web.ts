import { router } from 'expo-router';
import { PROXY_ROUTES } from '@stage-labs/client/endpoints';
import type { PushPlatform, PushRpc } from '@stage-labs/client/xmtp/pushServer';
import { toPermission, type PushPermission } from './pushNotify.model';
import { channelLinkOf } from './links';
import { isAppInFront } from './appInFront.web';
import { report } from './errorPolicy';
import { isBrowserExtension } from './extension';
import { linkProxyBase } from './linkProxy';

export const PUSH_PLATFORM: PushPlatform = 'web';

export function pushRpcUrl(method: PushRpc): string {
  return `${linkProxyBase()}${PROXY_ROUTES.push}${method}`;
}

export function isPushSupported(): boolean {
  return !isBrowserExtension() && typeof Notification !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

export function getPushPermission(): Promise<PushPermission> {
  return Promise.resolve(isPushSupported() ? toPermission(Notification.permission) : 'denied');
}

export async function requestPushPermission(): Promise<PushPermission> {
  if (!isPushSupported()) return 'denied';
  try {
    return toPermission(await Notification.requestPermission());
  } catch {
    return 'undetermined';
  }
}

export async function pushToken(): Promise<string | null> {
  if (!isPushSupported() || Notification.permission !== 'granted') return null;
  const { firebasePushToken } = await import('./firebaseWeb');
  return firebasePushToken();
}

export function markBackgroundDelivered(messageId: string | null | undefined): void {
  void messageId;
}

function openConversation(convId: string): void {
  if (typeof window !== 'undefined') window.focus();
  router.push(channelLinkOf(convId));
}

export async function presentInboundNotification(args: { title: string; body: string; convId: string; messageId?: string }): Promise<void> {
  if (isBrowserExtension() || typeof Notification === 'undefined' || Notification.permission !== 'granted' || isAppInFront()) return;
  const options: NotificationOptions = { body: args.body, tag: args.convId, data: { convId: args.convId } };
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) {
      await registration.showNotification(args.title, options);
      return;
    }
    const notification = new Notification(args.title, options);
    notification.onclick = () => {
      openConversation(args.convId);
      notification.close();
    };
  } catch (err) {
    report('push.webNotification', err);
  }
}

export async function dismissConvNotifications(convId: string): Promise<void> {
  if (isBrowserExtension() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return;
  for (const card of await registration.getNotifications({ tag: convId })) card.close();
}

export function usePushDeepLinks(): void {
  return undefined;
}

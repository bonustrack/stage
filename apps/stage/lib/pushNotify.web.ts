import { router } from 'expo-router';

export function markBackgroundDelivered(messageId: string | null | undefined): void {
  void messageId;
}

function tabIsInFront(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();
}

function openConversation(convId: string): void {
  if (typeof window !== 'undefined') window.focus();
  router.push({ pathname: '/channel/[convId]', params: { convId } });
}

export async function presentInboundNotification(args: {
  title: string;
  body: string;
  convId: string;
  messageId?: string;
}): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || tabIsInFront()) return;
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
  } catch { }
}

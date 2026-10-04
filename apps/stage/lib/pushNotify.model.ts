export interface PresentedNotification {
  identifier: string;
  data: unknown;
}

export function convIdOfNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const convId = (data as Record<string, unknown>).convId;
  return typeof convId === 'string' && convId.length > 0 ? convId : null;
}

export function javaStringHash(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  return hash;
}

export function nativeCardIdentifier(convId: string): string {
  return `expo-notifications://foreign_notifications?id=${javaStringHash(convId.toLowerCase())}`;
}

export function notificationIdsForConv(
  presented: readonly PresentedNotification[], convId: string, withNativeCard: boolean,
): string[] {
  const ids = presented.filter((n) => convIdOfNotificationData(n.data) === convId).map((n) => n.identifier);
  if (withNativeCard) ids.push(nativeCardIdentifier(convId));
  return [...new Set(ids)];
}

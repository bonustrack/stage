import { Platform } from 'react-native';
import { XMTP_APP_GROUP } from './xmtp.appGroup';
import { getCachedXmtpClient } from './xmtp.state';
import { reported } from './errorPolicy';

const RELEASES_ON_BACKGROUND = Platform.OS === 'ios' && XMTP_APP_GROUP !== null;

let released = false;

export async function releaseSharedDb(): Promise<void> {
  if (!RELEASES_ON_BACKGROUND || released) return;
  const client = getCachedXmtpClient();
  if (!client) return;
  released = true;
  try {
    await client.dropLocalDatabaseConnection();
  } catch {
    released = false;
  }
}

export async function reclaimSharedDb(): Promise<void> {
  if (!released) return;
  released = false;
  await getCachedXmtpClient()?.reconnectLocalDatabase().catch(reported('xmtp.reconnectDb'));
}

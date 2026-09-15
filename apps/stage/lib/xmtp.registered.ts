import { Client, PublicIdentity } from '@xmtp/react-native-sdk';

export async function isXmtpRegistered(address: string): Promise<boolean> {
  const result = await Client.canMessage('production', [new PublicIdentity(address, 'ETHEREUM')]);
  return Object.values(result).some(Boolean);
}

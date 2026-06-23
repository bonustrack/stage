
import { privateKeyToAccount } from 'viem/accounts';
import type { TypedDataDefinition } from 'viem';
import {
  type SignatureRequestContent, type SignatureReferenceContent,
  typedDataForRequest, personalMessageForRequest, buildSignatureReference,
} from '@stage-labs/client/xmtp/sign';
import type { AccountRecord } from '@stage-labs/client/accounts/types';
import { getActiveAccount, loadPk } from './accounts';

async function signWithKernel(
  req: SignatureRequestContent, active: AccountRecord,
): Promise<SignatureReferenceContent> {
  if (active.hdIndex == null) throw new Error('Smart account is missing its key index.');
  const { smartOwnerSigner } = await import('./accounts');
  const { makePublicClient, makeKernelClient } = await import('./zerodev');
  const { createEcdsaKernel } = await import('@stage-labs/client/zerodev/account');
  const owner = smartOwnerSigner(active.hdIndex);
  const publicClient = makePublicClient();
  const account = await createEcdsaKernel(publicClient, owner, active.hdIndex);
  const kernel = makeKernelClient(account, publicClient);
  if (req.kind === 'eip712') {
    const typedData = typedDataForRequest(req) as unknown as TypedDataDefinition;
    const signature = await kernel.signTypedData(
      typedData as Parameters<typeof kernel.signTypedData>[0],
    );
    return buildSignatureReference(req.id, signature, active.address);
  }
  const message = personalMessageForRequest(req);
  const signature = await kernel.signMessage(
    { message } as Parameters<typeof kernel.signMessage>[0],
  );
  return buildSignatureReference(req.id, signature, active.address);
}

async function signWithEoa(
  req: SignatureRequestContent, active: AccountRecord,
): Promise<SignatureReferenceContent> {
  const pk = loadPk(active.id);
  if (!pk) throw new Error('Active account has no stored key to sign with.');
  const account = privateKeyToAccount(pk);
  if (req.kind === 'eip712') {
    const signature = await account.signTypedData(
      typedDataForRequest(req) as unknown as TypedDataDefinition,
    );
    return buildSignatureReference(req.id, signature, account.address);
  }
  const message = personalMessageForRequest(req);
  const signature = await account.signMessage({ message });
  return buildSignatureReference(req.id, signature, account.address);
}

export async function signRequest(
  content: SignatureRequestContent,
): Promise<SignatureReferenceContent> {
  const active = await getActiveAccount();
  if (!active) throw new Error('No active account to sign with.');
  return active.type === 'smart'
    ? signWithKernel(content, active)
    : signWithEoa(content, active);
}

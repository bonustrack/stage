
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

const APP_ROOT = join(import.meta.dir, '..');
const read = (...p: string[]) => readFileSync(join(APP_ROOT, ...p), 'utf8');
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const createSrc = code(read('lib', 'zerodev', 'create.ts'));
const kernelSrc = code(read('lib', 'zerodev', 'kernelForRecord.ts'));
const enableSrc = code(read('lib', 'zerodev', 'enablePasskey.ts'));
const signingSrc = code(read('lib', 'xmtp.signing.core.ts'));
const txLayerSrc = code(read('components', 'xmtp-conv', 'useTxSignLayer.ts'));
const onboardSrc = code(read('components', 'onboarding', 'flow.ts'));
const disableSrc = code(read('lib', 'zerodev', 'disablePasskey.ts'));
const clientSrc = code(read('lib', 'zerodev', 'client.ts'));
const walletSettingsSrc = code(read('components', 'settings', 'WalletSettings.tsx'))
  + code(read('components', 'settings', 'WalletSettings.sections.tsx'))
  + code(read('components', 'settings', 'WalletSettings.model.ts'));
const passkeyHookSrc = code(read('lib', 'passkey.ts'));

describe('A. create.ts — create is passkey-AGNOSTIC (ECDSA-owner only)', () => {
  test('builds the ECDSA (deployable) Kernel and never touches the passkey path', () => {
    expect(createSrc).toContain('const { address } = await createEcdsaKernel(publicClient, owner, hdIndex)');
    expect(createSrc).not.toContain('registerPasskeyCredential');
    expect(createSrc).not.toContain('deployAndSwapToPasskey');
    expect(createSrc).not.toContain('passkey,');
  });

  test('persists an ECDSA-owner record (deployed:false, no passkey/passkeySudo)', () => {
    expect(createSrc).toContain('deployed: false');
    expect(createSrc).not.toContain('passkeySudo');
  });
});

describe('A2. callers install the passkey BEFORE messaging (passkey signs the inbox)', () => {
  test('onboarding create/restore: createSmartAccount, enable, THEN bringMessagingOnline', () => {
    const create = onboardSrc.indexOf('createSmartAccount({ fresh })');
    const enable = onboardSrc.indexOf('enablePasskeyForRecord(rec)');
    const msg = onboardSrc.indexOf('bringMessagingOnline(rec.id');
    expect(create).toBeGreaterThanOrEqual(0);
    expect(enable).toBeGreaterThan(create);
    expect(msg).toBeGreaterThan(enable);
    expect(onboardSrc).toContain('withPasskey && passkeysAvailable()');
  });

  test('the only other creators route through the onboarding pages', () => {
    const menu = code(read('components', 'MenuSheet.tsx'));
    const accounts = code(read('components', 'AccountsManager.tsx'));
    expect(menu).not.toContain('createSmartAccount');
    expect(accounts).not.toContain('createSmartAccount');
    expect(menu).toContain('SIGNUP_ROUTE');
    expect(accounts).toContain('SIGNUP_ROUTE');
  });
});

describe('B. kernelForRecord.ts — validator chosen from the account\'s onchain root', () => {
  test('passkey branch builds from the passkey validator', () => {
    expect(kernelSrc).toContain('passkeyKernelResult(publicClient, hdIndex, rec.passkey, addressOverride)');
    expect(kernelSrc).toContain('storedPasskeyMatches(');
  });
  test('passkeySudo => no override; else pin to rec.address', () => {
    expect(kernelSrc).toContain('rec.passkeySudo ? undefined : (rec.address as Hex)');
  });
  test('reads the root validator and the ECDSA execute permission before choosing', () => {
    expect(kernelSrc).toContain("functionName: 'rootValidator'");
    expect(kernelSrc).toContain('KERNEL_EXECUTE_SELECTOR');
    expect(kernelSrc).toContain('planKernelSigning(');
  });
  test('fails closed (throws) rather than signing with a key the account does not allow to transact', () => {
    expect(kernelSrc).toContain('throw new Error(describeUnavailableSigning(purpose, passkey.problem, passkey.detail))');
  });
});

describe('C. enablePasskey.ts — deploy-via-ECDSA-initcode then swap sudo on-chain', () => {
  test('builds the CURRENT ECDSA Kernel (its initCode deploys to the ECDSA-derived address)', () => {
    expect(enableSrc).toContain('createEcdsaKernel(publicClient, owner, hdIndex)');
  });
  test('shares ONE on-chain deploy-and-swap helper with the create path', () => {
    expect(enableSrc).toContain('export async function deployAndSwapToPasskey');
    expect(enableSrc).toContain('deployAndSwapToPasskey(publicClient, rec.hdIndex, stored)');
  });
  test('swaps sudo to the passkey via the shared changeSudoValidator helper (one sponsored userOp)', () => {
    expect(enableSrc).toContain('swapSudoValidator(kernelClient, passkeyValidator)');
    expect(clientSrc).toContain('changeSudoValidator({ sudoValidator })');
  });
  test('persists the deployed flag only AFTER the userOp receipt succeeds', () => {
    const swapIdx = clientSrc.indexOf('changeSudoValidator');
    const waitIdx = clientSrc.indexOf('waitForUserOperationReceipt');
    expect(swapIdx).toBeGreaterThanOrEqual(0);
    expect(waitIdx).toBeGreaterThan(swapIdx);
    expect(clientSrc).toContain('success: receipt?.success === true');
    const helperIdx = enableSrc.indexOf('swapSudoValidator(kernelClient');
    const persistIdx = enableSrc.lastIndexOf('updateSmartAccount(');
    expect(persistIdx).toBeGreaterThan(helperIdx);
    expect(enableSrc).toContain('if (!success) return { ok: false');
  });
  test('persists a fresh credential BEFORE the swap so an interrupted swap can never orphan it', () => {
    const prePersist = enableSrc.indexOf('if (!rec.passkey) {');
    const swapCall = enableSrc.indexOf('deployAndSwapToPasskey(publicClient, rec.hdIndex, stored)');
    expect(prePersist).toBeGreaterThanOrEqual(0);
    expect(swapCall).toBeGreaterThan(prePersist);
    expect(enableSrc).toContain('if (rec.passkey) return { stored: rec.passkey }');
  });
  test('repairs an undeployed record that already carries a passkey (old broken shortcut)', () => {
    expect(enableSrc).toContain('if (rec.passkey && deployed) return { ok: false, reason: \'already\' }');
  });
});

describe('D. xmtp.signing.core.ts — smart account signs XMTP via the kernel client', () => {
  test('smart accounts resolve their signing key through kernelClientForRecord', () => {
    expect(signingSrc).toContain("rec.type === 'smart'");
    expect(signingSrc).toContain("kernelClientForRecord(rec, 'sign')");
    expect(signingSrc).toContain("kind: 'SCW', address: rec.address");
  });
});

describe('E. useTxSignLayer.ts — smart account tx + signatures go through the kernel', () => {
  test('onPay sends a smart-account tx via kernelClientForRecord (sponsored userOp)', () => {
    expect(txLayerSrc).toContain('kernelClientForRecord(active)');
    expect(txLayerSrc).toContain('kernel.sendTransaction');
  });
  test('onSign signs message + typedData via the same kernel client', () => {
    expect(txLayerSrc).toContain('kernel.signTypedData');
    expect(txLayerSrc).toContain('kernel.signMessage');
  });
});

describe('F. disablePasskey.ts — revert swaps root back to ECDSA, clears state fail-closed', () => {
  test('builds the CURRENT (passkey-sudo) Kernel as the signer of the revert userOp', () => {
    expect(disableSrc).toContain('passkeyKernelFromStored');
    expect(disableSrc).toContain('rec.passkeySudo ? undefined : (rec.address as `0x${string}`)');
  });
  test('swaps sudo BACK to the ECDSA validator via the shared changeSudoValidator helper (one userOp)', () => {
    expect(disableSrc).toContain('ecdsaValidatorForOwner');
    expect(disableSrc).toContain('swapSudoValidator(kernelClient, ecdsaValidator)');
  });
  test('clears rec.passkey ONLY AFTER the userOp receipt succeeds (fail-closed)', () => {
    const swapIdx = disableSrc.indexOf('swapSudoValidator(kernelClient');
    const clearIdx = disableSrc.lastIndexOf('updateSmartAccount(');
    expect(swapIdx).toBeGreaterThanOrEqual(0);
    expect(clearIdx).toBeGreaterThan(swapIdx);
    expect(disableSrc).toContain('if (!success) return { ok: false');
    expect(disableSrc).toContain('passkey: undefined');
    expect(disableSrc).toContain('passkeyCredId: undefined');
    expect(disableSrc).toContain('passkeySudo: undefined');
  });
  test('guards: returns ok:false before any swap when the account has no passkey', () => {
    const guardIdx = disableSrc.indexOf("if (!rec.passkey) return { ok: false, reason: 'none' }");
    const swapCallIdx = disableSrc.indexOf('swapRootToEcdsa(publicClient, rec)');
    expect(guardIdx).toBeGreaterThanOrEqual(0);
    expect(swapCallIdx).toBeGreaterThan(guardIdx);
  });
});

describe('G. Settings -> Wallet — Remove passkey affordance is wired + gated', () => {
  test('WalletSettings renders the Remove passkey row only when available', () => {
    expect(walletSettingsSrc).toContain('useRemovePasskey');
    expect(walletSettingsSrc).toContain('removePasskey.available');
    expect(walletSettingsSrc).toContain('Remove passkey');
  });
  test('the hook shows only for a smart account that currently HAS a passkey', () => {
    expect(passkeyHookSrc).toContain("acct.type === 'smart' && !!acct.passkey");
    expect(passkeyHookSrc).toContain('perform: removePasskeyFromRecord');
  });
  test('the hook confirms with a destructive dialog before reverting', () => {
    expect(passkeyHookSrc).toContain('destructive: true');
    expect(passkeyHookSrc).toContain('if (await capabilities.confirm(spec.confirm)) perform();');
  });
});

describe('H. web passkey seam — validator callback contract and safety gates', () => {
  const webSrc = code(read('lib', 'zerodev', 'passkeys.web.ts'));

  test('sign callback declares the exact 4-arg shape toPasskeyValidator invokes', () => {
    expect(webSrc).toMatch(
      /async function signMessageWithWebPasskeys\(\s*message: unknown,\s*rpID: string,\s*chainId: number,\s*allowCredentials\?/,
    );
  });
  test('signature encodes r before s in the validator ABI tuple', () => {
    expect(webSrc).toContain(
      '[authenticatorDataHex, clientDataJSON, beforeType, r, s, isRIP7212SupportedNetwork(chainId)]',
    );
  });
  test('availability is gated to the rpId family so ephemeral hosts cannot mint sudo credentials', () => {
    expect(webSrc).toContain('hostSupportsRpId(zerodevRpId(), window.location.hostname)');
  });
  test('user cancellation maps to null while real failures propagate', () => {
    expect(webSrc).toContain('if (isUserCancelled(e)) return null');
    expect(webSrc).toContain('throw e instanceof Error ? e : new Error(');
  });
  test('onboarding continues without a passkey when the user cancels the sheet', () => {
    expect(onboardSrc).toContain("res.ok || res.reason === 'already' || res.reason === 'cancelled'");
  });
});


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
const codecsSrc = code(read('lib', 'xmtp.codecs.ts'));
const txLayerSrc = code(read('components', 'xmtp-conv', 'useTxSignLayer.ts'));
const onboardSrc = code(read('components', 'onboarding', 'flow.ts'));
const acctMgrSrc = code(read('components', 'AccountsManager.hook.ts'));
const drawerSrc = code(read('components', 'LeftDrawer.accounts.tsx'));
const disableSrc = code(read('lib', 'zerodev', 'disablePasskey.ts'));
const walletSettingsSrc = code(read('components', 'settings', 'WalletSettings.tsx'))
  + code(read('components', 'settings', 'WalletSettings.sections.tsx'));
const removeHookSrc = code(read('lib', 'useRemovePasskey.ts'));

describe('A. create.ts — create is passkey-AGNOSTIC (ECDSA-owner only)', () => {
  test('builds the ECDSA (deployable) Kernel and never touches the passkey path', () => {
    expect(createSrc).toContain('const account = await createEcdsaKernel(publicClient, owner, hdIndex)');
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
    const create = onboardSrc.indexOf('createSmartAccount()');
    const enable = onboardSrc.indexOf('enablePasskeyForRecord(rec)');
    const msg = onboardSrc.indexOf('bringMessagingOnline(rec.id');
    expect(create).toBeGreaterThanOrEqual(0);
    expect(enable).toBeGreaterThan(create);
    expect(msg).toBeGreaterThan(enable);
    expect(onboardSrc).toContain('withPasskey && passkeysAvailable()');
  });

  test('AccountsManager add: createSmartAccount, enable, THEN switch', () => {
    const create = acctMgrSrc.indexOf('createSmartAccount()');
    const enable = acctMgrSrc.indexOf('enablePasskeyForRecord(rec)');
    const sw = acctMgrSrc.indexOf('AccountManager.switch(rec.id)');
    expect(create).toBeGreaterThanOrEqual(0);
    expect(enable).toBeGreaterThan(create);
    expect(sw).toBeGreaterThan(enable);
  });

  test('LeftDrawer add: createSmartAccount, enable, THEN activate', () => {
    const create = drawerSrc.indexOf('createSmartAccount()');
    const enable = drawerSrc.indexOf('enablePasskeyForRecord(rec)');
    const act = drawerSrc.indexOf('activate(rec.id, onChanged)');
    expect(create).toBeGreaterThanOrEqual(0);
    expect(enable).toBeGreaterThan(create);
    expect(act).toBeGreaterThan(enable);
  });
});

describe('B. kernelForRecord.ts — override only for enable-upgraded accounts', () => {
  test('passkey branch builds from the passkey validator', () => {
    expect(kernelSrc).toContain('passkeyKernelFromStored');
    expect(kernelSrc).toContain('if (rec.passkey)');
  });
  test('passkeySudo => no override; else pin to rec.address', () => {
    expect(kernelSrc).toContain('rec.passkeySudo ? undefined : (rec.address as `0x${string}`)');
  });
  test('fails closed (throws) rather than signing a passkey account with the ECDSA key', () => {
    expect(kernelSrc).toContain('if (passkeysAvailable())');
    expect(kernelSrc).toMatch(/throw new Error\([^)]*refusing to sign with the ECDSA key/);
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
  test('swaps sudo to the passkey via changeSudoValidator (one sponsored userOp)', () => {
    expect(enableSrc).toContain('changeSudoValidator');
    expect(enableSrc).toContain('sudoValidator: passkeyValidator');
  });
  test('persists rec.passkey only AFTER the userOp receipt succeeds', () => {
    const swapIdx = enableSrc.indexOf('changeSudoValidator');
    const waitIdx = enableSrc.indexOf('waitForUserOperationReceipt');
    const persistIdx = enableSrc.lastIndexOf('updateSmartAccount(');
    expect(swapIdx).toBeGreaterThanOrEqual(0);
    expect(waitIdx).toBeGreaterThan(swapIdx);
    expect(persistIdx).toBeGreaterThan(waitIdx);
    expect(enableSrc).toContain('if (!receipt?.success)');
  });
  test('repairs an undeployed record that already carries a passkey (old broken shortcut)', () => {
    expect(enableSrc).toContain('if (rec.passkey && deployed) return { ok: false, reason: \'already\' }');
  });
});

describe('D. xmtp.codecs.ts — smart account signs XMTP via the scwSigner + kernel', () => {
  test('smart accounts route through signerForSmart -> scwSigner + kernelClientForRecord', () => {
    expect(codecsSrc).toContain("rec.type === 'smart'");
    expect(codecsSrc).toContain('kernelClientForRecord(rec)');
    expect(codecsSrc).toContain('scwSigner(kernelClient, rec.address)');
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
  test('swaps sudo BACK to the ECDSA validator via changeSudoValidator (one userOp)', () => {
    expect(disableSrc).toContain('ecdsaValidatorForOwner');
    expect(disableSrc).toContain('changeSudoValidator');
    expect(disableSrc).toContain('sudoValidator: ecdsaValidator');
  });
  test('clears rec.passkey ONLY AFTER the userOp receipt succeeds (fail-closed)', () => {
    const swapIdx = disableSrc.indexOf('changeSudoValidator');
    const waitIdx = disableSrc.indexOf('waitForUserOperationReceipt');
    const clearIdx = disableSrc.lastIndexOf('updateSmartAccount(');
    expect(swapIdx).toBeGreaterThanOrEqual(0);
    expect(waitIdx).toBeGreaterThan(swapIdx);
    expect(clearIdx).toBeGreaterThan(waitIdx);
    expect(disableSrc).toContain('if (!receipt?.success)');
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
    expect(removeHookSrc).toContain("acct?.type === 'smart' && !!acct.passkey");
    expect(removeHookSrc).toContain('removePasskeyFromRecord(acct)');
  });
  test('the hook confirms with a destructive Alert before reverting', () => {
    expect(removeHookSrc).toContain('Alert.alert');
    expect(removeHookSrc).toContain("style: 'destructive'");
  });
});

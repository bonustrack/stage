import {
  concat, concatHex, encodeAbiParameters, encodeFunctionData, getAddress, isAddress, keccak256, pad, slice, zeroAddress, type Hex,
} from 'viem';

export const WEBAUTHN_SIGNER_V0_0_4: Hex = '0x65DEeC8fEe717dc044D0CFD63cCf55F02cCaC2b3';
export const SUDO_POLICY: Hex = '0x67b436caD8a6D025DF6C82C5BB43fbF11fC5B9B7';
export const POLICY_FOR_ALL_VALIDATION: Hex = '0x0000';
export const PERMISSION_VALIDATION_TYPE: Hex = '0x02';

export interface DevicePasskeyKey { pubX: Hex; pubY: Hex; authenticatorIdHash: Hex }

export const PERMISSION_CONFIG_ABI = [
  {
    name: 'permissionConfig', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'pId', type: 'bytes4' }],
    outputs: [{
      type: 'tuple',
      components: [
        { name: 'permissionFlag', type: 'bytes2' },
        { name: 'signer', type: 'address' },
        { name: 'policyData', type: 'bytes22[]' },
      ],
    }],
  },
] as const;

const UNINSTALL_VALIDATION_ABI = [
  {
    name: 'uninstallValidation', type: 'function', stateMutability: 'payable',
    inputs: [{ name: 'vId', type: 'bytes21' }, { name: 'deinitData', type: 'bytes' }, { name: 'hookDeinitData', type: 'bytes' }],
    outputs: [],
  },
] as const;

export function devicePasskeySignerData(key: DevicePasskeyKey): Hex {
  return encodeAbiParameters(
    [
      { type: 'tuple', components: [{ name: 'pubKeyX', type: 'uint256' }, { name: 'pubKeyY', type: 'uint256' }] },
      { type: 'bytes32' },
    ],
    [{ pubKeyX: BigInt(key.pubX), pubKeyY: BigInt(key.pubY) }, key.authenticatorIdHash],
  );
}

function sudoPolicyBytes(): Hex {
  return concatHex([POLICY_FOR_ALL_VALIDATION, SUDO_POLICY]);
}

function signerBytes(key: DevicePasskeyKey): Hex {
  return concat([POLICY_FOR_ALL_VALIDATION, WEBAUTHN_SIGNER_V0_0_4, devicePasskeySignerData(key)]);
}

export function devicePasskeyEnableData(key: DevicePasskeyKey): Hex {
  return encodeAbiParameters([{ type: 'bytes[]' }], [[sudoPolicyBytes(), signerBytes(key)]]);
}

export function devicePasskeyPermissionId(key: DevicePasskeyKey): Hex {
  const policyId = encodeAbiParameters([{ type: 'bytes[]' }], [[sudoPolicyBytes()]]);
  const signerId = encodeAbiParameters([{ type: 'bytes' }], [concat([WEBAUTHN_SIGNER_V0_0_4, devicePasskeySignerData(key)])]);
  const packed = encodeAbiParameters([{ type: 'bytes[]' }], [[policyId, POLICY_FOR_ALL_VALIDATION, signerId]]);
  return slice(keccak256(packed), 0, 4);
}

export function permissionValidationId(permissionId: Hex): Hex {
  return concat([PERMISSION_VALIDATION_TYPE, pad(permissionId, { size: 20, dir: 'right' })]).toLowerCase() as Hex;
}

export function encodeUninstallDevicePasskey(permissionId: Hex): Hex {
  const deinit = encodeAbiParameters([{ type: 'bytes[]' }], [['0x', '0x']]);
  return encodeFunctionData({
    abi: UNINSTALL_VALIDATION_ABI, functionName: 'uninstallValidation', args: [permissionValidationId(permissionId), deinit, '0x'],
  });
}

export interface DevicePasskeyCall { to: Hex; data: Hex; value: bigint }

const NO_OP_CALL: DevicePasskeyCall = { to: zeroAddress, data: '0x', value: 0n };

export function enableDevicePasskeyCalls(): DevicePasskeyCall[] {
  return [NO_OP_CALL];
}

export function removeDevicePasskeyCalls(account: Hex, permissionId: Hex): DevicePasskeyCall[] {
  return [{ to: account, data: encodeUninstallDevicePasskey(permissionId), value: 0n }, NO_OP_CALL];
}

export function devicePasskeyFingerprint(key: DevicePasskeyKey): string {
  const hex = keccak256(devicePasskeySignerData(key)).slice(2, 10).toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export interface DevicePasskeyRequest { account: Hex; key: DevicePasskeyKey }

export interface DevicePasskeyApproval { account: Hex; permissionId: Hex; nonce: number; enableSignature: Hex }

const REQUEST_PREFIX = 'stage-device-passkey:1';
const APPROVAL_PREFIX = 'stage-device-approval:1';
const WORD = /^0x[0-9a-f]{1,64}$/;
const BYTES32 = /^0x[0-9a-f]{64}$/;
const PERMISSION_ID = /^0x[0-9a-f]{8}$/;
const SIGNATURE = /^0x(?:[0-9a-f]{2})+$/;

function word(value: Hex): string {
  return `0x${BigInt(value).toString(16).padStart(64, '0')}`;
}

export function encodeDevicePasskeyRequest(request: DevicePasskeyRequest): string {
  const { account, key } = request;
  return [REQUEST_PREFIX, getAddress(account).toLowerCase(), word(key.pubX), word(key.pubY), key.authenticatorIdHash.toLowerCase()].join(':');
}

function parseAccount(raw: string | undefined): Hex | null {
  return raw !== undefined && isAddress(raw, { strict: false }) ? getAddress(raw) : null;
}

export function parseDevicePasskeyRequest(input: string): DevicePasskeyRequest | null {
  const parts = input.trim().toLowerCase().split(':');
  if (parts.length !== 6 || `${parts[0]}:${parts[1]}` !== REQUEST_PREFIX) return null;
  const [, , rawAccount, pubX, pubY, idHash] = parts;
  const account = parseAccount(rawAccount);
  if (account === null || pubX === undefined || pubY === undefined || idHash === undefined) return null;
  if (!WORD.test(pubX) || !WORD.test(pubY) || !BYTES32.test(idHash)) return null;
  return { account, key: { pubX: pubX as Hex, pubY: pubY as Hex, authenticatorIdHash: idHash as Hex } };
}

export function encodeDevicePasskeyApproval(approval: DevicePasskeyApproval): string {
  return [
    APPROVAL_PREFIX, getAddress(approval.account).toLowerCase(), approval.permissionId.toLowerCase(),
    String(approval.nonce), approval.enableSignature.toLowerCase(),
  ].join(':');
}

export function parseDevicePasskeyApproval(input: string): DevicePasskeyApproval | null {
  const parts = input.trim().toLowerCase().split(':');
  if (parts.length !== 6 || `${parts[0]}:${parts[1]}` !== APPROVAL_PREFIX) return null;
  const [, , rawAccount, permissionId, rawNonce, signature] = parts;
  const account = parseAccount(rawAccount);
  if (account === null || permissionId === undefined || rawNonce === undefined || signature === undefined) return null;
  if (!PERMISSION_ID.test(permissionId) || !/^\d{1,10}$/.test(rawNonce) || !SIGNATURE.test(signature)) return null;
  return { account, permissionId: permissionId as Hex, nonce: Number(rawNonce), enableSignature: signature as Hex };
}

export type ApprovalCheck = 'ok' | 'other-account' | 'other-passkey' | 'stale';

export function checkDevicePasskeyApproval(
  approval: DevicePasskeyApproval, account: Hex, key: DevicePasskeyKey, currentNonce: number,
): ApprovalCheck {
  if (approval.account.toLowerCase() !== account.toLowerCase()) return 'other-account';
  if (approval.permissionId !== devicePasskeyPermissionId(key)) return 'other-passkey';
  return approval.nonce === Math.max(currentNonce, 1) ? 'ok' : 'stale';
}

export interface DevicePasskeyOnchain { hook: Hex; signer: Hex; canExecute: boolean }

export function isDevicePasskeyInstalled(onchain: DevicePasskeyOnchain): boolean {
  if (onchain.hook.toLowerCase() === zeroAddress) return false;
  return onchain.canExecute && onchain.signer.toLowerCase() === WEBAUTHN_SIGNER_V0_0_4.toLowerCase();
}

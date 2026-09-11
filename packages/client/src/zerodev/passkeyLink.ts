import { keccak256, type Hex } from 'viem';

export const WEBAUTHN_STORAGE_ABI = [
  {
    name: 'webAuthnValidatorStorage', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'kernel', type: 'address' }],
    outputs: [{ name: 'pubX', type: 'uint256' }, { name: 'pubY', type: 'uint256' }],
  },
] as const;

export const KERNEL_ROOT_VALIDATOR_ABI = [
  { name: 'rootValidator', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes21' }] },
] as const;

export interface PasskeyPublicKey { pubX: bigint; pubY: bigint }

export function validatorAddressOf(validationId: Hex): Hex {
  return `0x${validationId.slice(4)}`;
}

export function bigintToBytes32(value: bigint): Uint8Array {
  const hex = value.toString(16).padStart(64, '0');
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
}

export function p256RawPublicKey(key: PasskeyPublicKey): Uint8Array {
  const out = new Uint8Array(65);
  out[0] = 4;
  out.set(bigintToBytes32(key.pubX), 1);
  out.set(bigintToBytes32(key.pubY), 33);
  return out;
}

export function rsToRawSignature(r: bigint, s: bigint): Uint8Array {
  const out = new Uint8Array(64);
  out.set(bigintToBytes32(r), 0);
  out.set(bigintToBytes32(s), 32);
  return out;
}

export function authenticatorIdHashOf(rawId: Uint8Array): Hex {
  return keccak256(rawId);
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export function hexOfBigint(value: bigint): Hex {
  return `0x${value.toString(16)}`;
}

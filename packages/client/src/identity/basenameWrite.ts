import { encodeFunctionData, namehash, type Hex } from 'viem';
import { normalize } from 'viem/ens';
import { BASENAME_L2_RESOLVER } from './onchainProfile';

export const BASENAME_REVERSE_REGISTRAR = '0x79EA96012eEa67A83431F1701B3dFf7e37F9E282' as const;
export const BASENAME_CLAIM_URL = 'https://www.base.org/names';

const L2_RESOLVER_WRITE_ABI = [
  {
    name: 'setText', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'node', type: 'bytes32' }, { name: 'key', type: 'string' }, { name: 'value', type: 'string' }],
    outputs: [],
  },
] as const;

const REVERSE_REGISTRAR_ABI = [
  {
    name: 'setName', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'name', type: 'string' }],
    outputs: [{ name: '', type: 'bytes32' }],
  },
] as const;

export interface ContractCall { to: Hex; data: Hex }

export function encodeSetBasenameAvatar(name: string, avatarUri: string): ContractCall {
  return {
    to: BASENAME_L2_RESOLVER,
    data: encodeFunctionData({
      abi: L2_RESOLVER_WRITE_ABI, functionName: 'setText', args: [namehash(normalize(name)), 'avatar', avatarUri],
    }),
  };
}

export function encodeSetPrimaryBasename(name: string): ContractCall {
  return {
    to: BASENAME_REVERSE_REGISTRAR,
    data: encodeFunctionData({ abi: REVERSE_REGISTRAR_ABI, functionName: 'setName', args: [name] }),
  };
}

export function manageBasenameUrl(name: string): string {
  return `https://www.base.org/name/${name.replace(/\.base\.eth$/i, '')}`;
}

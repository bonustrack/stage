import { gcm } from '@noble/ciphers/aes';
import { x25519 } from '@noble/curves/ed25519';
import { expand, extract } from '@noble/hashes/hkdf';
import { sha256 } from '@noble/hashes/sha2';
import { concatBytes, utf8ToBytes } from '@noble/hashes/utils';

const KEM_ID = 0x0020;
const KDF_ID = 0x0001;
const AEAD_ID = 0x0001;
const AEAD_KEY_BYTES = 16;
const AEAD_NONCE_BYTES = 12;
const KEM_SECRET_BYTES = 32;
const HPKE_ENC_BYTES = 32;

const EMPTY = new Uint8Array(0);
const MODE_BASE = new Uint8Array([0]);
const VERSION_LABEL = utf8ToBytes('HPKE-v1');

function i2osp(value: number, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let rest = value;
  for (let index = length - 1; index >= 0; index -= 1) {
    out[index] = rest % 256;
    rest = Math.floor(rest / 256);
  }
  return out;
}

const KEM_SUITE = concatBytes(utf8ToBytes('KEM'), i2osp(KEM_ID, 2));
const HPKE_SUITE = concatBytes(utf8ToBytes('HPKE'), i2osp(KEM_ID, 2), i2osp(KDF_ID, 2), i2osp(AEAD_ID, 2));

function labeledExtract(suite: Uint8Array, salt: Uint8Array, label: string, ikm: Uint8Array): Uint8Array {
  return extract(sha256, concatBytes(VERSION_LABEL, suite, utf8ToBytes(label), ikm), salt);
}

function labeledExpand(suite: Uint8Array, prk: Uint8Array, label: string, info: Uint8Array, length: number): Uint8Array {
  return expand(sha256, prk, concatBytes(i2osp(length, 2), VERSION_LABEL, suite, utf8ToBytes(label), info), length);
}

export interface HpkeKeyPair {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export function deriveHpkeKeyPair(ikm: Uint8Array): HpkeKeyPair {
  const prk = labeledExtract(KEM_SUITE, EMPTY, 'dkp_prk', ikm);
  const secretKey = labeledExpand(KEM_SUITE, prk, 'sk', EMPTY, KEM_SECRET_BYTES);
  return { secretKey, publicKey: x25519.getPublicKey(secretKey) };
}

function kemSharedSecret(dh: Uint8Array, enc: Uint8Array, recipientPublicKey: Uint8Array): Uint8Array {
  const prk = labeledExtract(KEM_SUITE, EMPTY, 'eae_prk', dh);
  return labeledExpand(KEM_SUITE, prk, 'shared_secret', concatBytes(enc, recipientPublicKey), KEM_SECRET_BYTES);
}

function aeadFor(sharedSecret: Uint8Array, info: Uint8Array, aad: Uint8Array): ReturnType<typeof gcm> {
  const context = concatBytes(
    MODE_BASE,
    labeledExtract(HPKE_SUITE, EMPTY, 'psk_id_hash', EMPTY),
    labeledExtract(HPKE_SUITE, EMPTY, 'info_hash', info),
  );
  const secret = labeledExtract(HPKE_SUITE, sharedSecret, 'secret', EMPTY);
  const key = labeledExpand(HPKE_SUITE, secret, 'key', context, AEAD_KEY_BYTES);
  const nonce = labeledExpand(HPKE_SUITE, secret, 'base_nonce', context, AEAD_NONCE_BYTES);
  return gcm(key, nonce, aad);
}

export function hpkeSeal(
  recipientPublicKey: Uint8Array,
  info: Uint8Array,
  aad: Uint8Array,
  plaintext: Uint8Array,
  ephemeralSecretKey: Uint8Array = x25519.utils.randomPrivateKey(),
): Uint8Array {
  const enc = x25519.getPublicKey(ephemeralSecretKey);
  const dh = x25519.getSharedSecret(ephemeralSecretKey, recipientPublicKey);
  const ciphertext = aeadFor(kemSharedSecret(dh, enc, recipientPublicKey), info, aad).encrypt(plaintext);
  return concatBytes(enc, ciphertext);
}

export function hpkeOpen(recipientSecretKey: Uint8Array, info: Uint8Array, aad: Uint8Array, sealed: Uint8Array): Uint8Array {
  if (sealed.length <= HPKE_ENC_BYTES) throw new Error('Sealed data is too short.');
  const enc = sealed.subarray(0, HPKE_ENC_BYTES);
  const dh = x25519.getSharedSecret(recipientSecretKey, enc);
  const shared = kemSharedSecret(dh, enc, x25519.getPublicKey(recipientSecretKey));
  return aeadFor(shared, info, aad).decrypt(sealed.subarray(HPKE_ENC_BYTES));
}

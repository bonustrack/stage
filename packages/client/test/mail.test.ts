import { describe, expect, test } from 'bun:test';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import { serializeErc6492Signature } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { deriveHpkeKeyPair, hpkeOpen, hpkeSeal } from '../src/mail/hpke';
import {
  deriveMailKey, isMailboxLabel, isMailId, mailAddressOf, mailboxLabel, mailKeyMessage, mailPublicKeyHex,
  mailRegisterMessage, mailSessionMessage, openMailIndex, openMailPart, sealMailIndex, sealMailPart, type MailIndex,
} from '../src/mail/mailbox';

const RFC9180_A1 = {
  info: '4f6465206f6e2061204772656369616e2055726e',
  ikmE: '7268600d403fce431561aef583ee1613527cff655c1343f29812e66706df3234',
  pkEm: '37fda3567bdbd628e88668c3c8d7e97d1d1253b6d4ea6d44c150f741f1bf4431',
  skEm: '52c4a758a802cd8b936eceea314432798d5baf2d7e9235dc084ab1b9cfa2f736',
  ikmR: '6db9df30aa07dd42ee5e8181afdb977e538f5e1fec8a06223f33f7013e525037',
  pkRm: '3948cfe0ad1ddb695d780e59077195da6c56506b027329794ab02bca80815c4d',
  skRm: '4612c550263fc8ad58375df3f557aac531d26850903e55a9f23f21d8534e8ac8',
  pt: '4265617574792069732074727574682c20747275746820626561757479',
  aad: '436f756e742d30',
  ct: 'f938558b5d72f1a23810b4be2ab4f84331acc02fc97babc53a52ae8218a355a96d8770ac83d07bea87e13c512a',
};

const OWNER = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d');
const ID = '1759430000000-9ef6fdd0-0635-4130-8b77-aaeae0f65158';
const INDEX: MailIndex = {
  envelopeFrom: 'bounce@example.com', from: 'Ann <ann@example.com>', to: 'alice1@st.box',
  subject: 'Hello', date: 'Thu, 2 Oct 2026 18:00:00 +0000', messageId: '<1@example.com>', size: 42,
};

describe('HPKE (RFC 9180 DHKEM X25519, HKDF-SHA256, AES-128-GCM)', () => {
  test('derives the RFC A.1 key pairs from their ikm', () => {
    const sender = deriveHpkeKeyPair(hexToBytes(RFC9180_A1.ikmE));
    const recipient = deriveHpkeKeyPair(hexToBytes(RFC9180_A1.ikmR));
    expect(bytesToHex(sender.secretKey)).toBe(RFC9180_A1.skEm);
    expect(bytesToHex(sender.publicKey)).toBe(RFC9180_A1.pkEm);
    expect(bytesToHex(recipient.secretKey)).toBe(RFC9180_A1.skRm);
    expect(bytesToHex(recipient.publicKey)).toBe(RFC9180_A1.pkRm);
  });

  test('seals to the RFC A.1 enc and ciphertext, and opens it again', () => {
    const sealed = hpkeSeal(
      hexToBytes(RFC9180_A1.pkRm), hexToBytes(RFC9180_A1.info), hexToBytes(RFC9180_A1.aad),
      hexToBytes(RFC9180_A1.pt), hexToBytes(RFC9180_A1.skEm),
    );
    expect(bytesToHex(sealed)).toBe(RFC9180_A1.pkEm + RFC9180_A1.ct);
    const opened = hpkeOpen(hexToBytes(RFC9180_A1.skRm), hexToBytes(RFC9180_A1.info), hexToBytes(RFC9180_A1.aad), sealed);
    expect(bytesToHex(opened)).toBe(RFC9180_A1.pt);
  });

  test('uses a fresh ephemeral key per seal and refuses tampered data', () => {
    const keys = deriveHpkeKeyPair(utf8ToBytes('test ikm'));
    const info = utf8ToBytes('info');
    const first = hpkeSeal(keys.publicKey, info, utf8ToBytes('a'), utf8ToBytes('secret'));
    const second = hpkeSeal(keys.publicKey, info, utf8ToBytes('a'), utf8ToBytes('secret'));
    expect(bytesToHex(first)).not.toBe(bytesToHex(second));
    const flipped = first.slice();
    flipped[flipped.length - 1] = (flipped[flipped.length - 1] ?? 0) ^ 1;
    expect(() => hpkeOpen(keys.secretKey, info, utf8ToBytes('a'), flipped)).toThrow();
    expect(() => hpkeOpen(keys.secretKey, info, utf8ToBytes('b'), first)).toThrow();
    expect(() => hpkeOpen(deriveHpkeKeyPair(utf8ToBytes('other')).secretKey, info, utf8ToBytes('a'), first)).toThrow();
  });
});

describe('st.box addresses', () => {
  test('maps an address to its stage label, without +tag and case', () => {
    expect(mailboxLabel('Alice1@ST.box')).toBe('alice1');
    expect(mailboxLabel('alice1+news@st.box')).toBe('alice1');
    expect(mailAddressOf('alice1')).toBe('alice1@st.box');
  });

  test('rejects other domains, invalid labels and role names', () => {
    expect(mailboxLabel('alice1@stage.box')).toBeNull();
    expect(mailboxLabel('bob@st.box')).toBeNull();
    expect(mailboxLabel('a_lice1@st.box')).toBeNull();
    expect(mailboxLabel('@st.box')).toBeNull();
    for (const role of ['postmaster', 'hostmaster', 'webmaster', 'administrator', 'mailer-daemon', 'security']) {
      expect(mailboxLabel(`${role}@st.box`)).toBeNull();
      expect(isMailboxLabel(role)).toBe(false);
    }
  });

  test('accepts only time-ordered mail ids', () => {
    expect(isMailId(ID)).toBe(true);
    expect(isMailId('../key')).toBe(false);
    expect(isMailId(ID.toUpperCase())).toBe(false);
  });
});

describe('mail keys and messages', () => {
  test('derives the same key from the same owner signature, a different one per name', async () => {
    const sign = (message: string) => OWNER.signMessage({ message });
    const first = await deriveMailKey('alice1', sign);
    const again = await deriveMailKey('alice1', sign);
    const other = await deriveMailKey('alice2', sign);
    expect(mailPublicKeyHex(again)).toBe(mailPublicKeyHex(first));
    expect(mailPublicKeyHex(other)).not.toBe(mailPublicKeyHex(first));
    expect(mailKeyMessage('alice1')).toBe('st.box mail key v1 for alice1.stage.base.eth');
  });

  test('derives the same key before and after a smart account is deployed', async () => {
    const deployed = (message: string) => OWNER.signMessage({ message });
    const undeployed = async (message: string) => serializeErc6492Signature({
      address: '0x00000000000000000000000000000000DeaDBeef', data: '0x1234', signature: await deployed(message),
    });
    expect(mailPublicKeyHex(await deriveMailKey('alice1', undeployed))).toBe(mailPublicKeyHex(await deriveMailKey('alice1', deployed)));
  });

  test('refuses a signer that does not sign deterministically', async () => {
    let count = 0;
    const flaky = (message: string) => OWNER.signMessage({ message: `${message}${count++}` });
    await expect(deriveMailKey('alice1', flaky)).rejects.toThrow('same signature twice');
  });

  test('binds the register and sign-in messages to the name, key, nonce and times', () => {
    expect(mailRegisterMessage({ label: 'alice1', publicKey: '0xAB', issuedAt: 5 }))
      .toBe('Register st.box mail key\nname: alice1.stage.base.eth\nkey: 0xab\nissued: 5');
    expect(mailSessionMessage({ label: 'alice1', nonce: 'n1', expiresAt: 9 }))
      .toBe('Sign in to st.box mail\nname: alice1.stage.base.eth\nnonce: n1\nexpires: 9');
  });

  test('seals the index and body to one mailbox and mail id only', async () => {
    const keys = await deriveMailKey('alice1', (message) => OWNER.signMessage({ message }));
    const index = sealMailIndex(keys.publicKey, 'alice1', ID, INDEX);
    expect(openMailIndex(keys.secretKey, 'alice1', ID, index)).toEqual(INDEX);
    const body = sealMailPart(keys.publicKey, 'alice1', ID, 'body', utf8ToBytes('Subject: Hello\r\n\r\nHi'));
    expect(new TextDecoder().decode(openMailPart(keys.secretKey, 'alice1', ID, 'body', body))).toContain('Hi');
    expect(() => openMailPart(keys.secretKey, 'alice2', ID, 'body', body)).toThrow();
    expect(() => openMailPart(keys.secretKey, 'alice1', ID.replace('9ef6', '0000'), 'body', body)).toThrow();
    expect(() => openMailPart(keys.secretKey, 'alice1', ID, 'index', body)).toThrow();
  });
});

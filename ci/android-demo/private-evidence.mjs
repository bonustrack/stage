import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, diffieHellman, generateKeyPairSync, hkdfSync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const VERSION = 'stage-private-evidence-v1';
const MAX_BYTES = 32 * 1024 * 1024;
const INFO = Buffer.from(VERSION);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = bytes => Buffer.from(bytes).toString('base64');
const decode = text => Buffer.from(text, 'base64');

export function recipient() {
  const pair = generateKeyPairSync('x25519');
  return {
    publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }),
    privateKey: pair.privateKey.export({ type: 'pkcs8', format: 'der' }),
  };
}

export function seal(plaintext, recipientDer) {
  if (plaintext.length > MAX_BYTES) throw new Error('Evidence exceeds transport bound');
  const remote = createPublicKey({ key: recipientDer, type: 'spki', format: 'der' });
  if (remote.asymmetricKeyType !== 'x25519') throw new Error('Wrong recipient key type');
  const pair = generateKeyPairSync('x25519');
  const salt = randomBytes(32);
  const nonce = randomBytes(12);
  const header = Buffer.from(JSON.stringify({
    version: VERSION,
    recipientSha256: digest(recipientDer),
    ephemeralPublicKey: encode(pair.publicKey.export({ type: 'spki', format: 'der' })),
    salt: encode(salt),
    nonce: encode(nonce),
  }));
  const shared = diffieHellman({ privateKey: pair.privateKey, publicKey: remote });
  const key = Buffer.from(hkdfSync('sha256', shared, salt, INFO, 32));
  shared.fill(0);
  try {
    const cipher = createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(header);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return Buffer.concat([header, Buffer.from('\n'), encrypted, cipher.getAuthTag()]);
  } finally {
    key.fill(0);
  }
}

export function open(envelope, recipientPrivateDer) {
  if (envelope.length > MAX_BYTES + 4096) throw new Error('Envelope exceeds transport bound');
  const newline = envelope.indexOf(10);
  if (newline < 0 || newline > 2048) throw new Error('Invalid envelope header');
  const header = envelope.subarray(0, newline);
  const data = JSON.parse(header.toString('utf8'));
  if (data.version !== VERSION) throw new Error('Wrong envelope version');
  const privateKey = createPrivateKey({ key: recipientPrivateDer, type: 'pkcs8', format: 'der' });
  const ownPublic = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  if (digest(ownPublic) !== data.recipientSha256) throw new Error('Wrong recipient');
  const ephemeral = createPublicKey({ key: decode(data.ephemeralPublicKey), type: 'spki', format: 'der' });
  const shared = diffieHellman({ privateKey, publicKey: ephemeral });
  const key = Buffer.from(hkdfSync('sha256', shared, decode(data.salt), INFO, 32));
  shared.fill(0);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, decode(data.nonce));
    decipher.setAAD(header);
    decipher.setAuthTag(envelope.subarray(-16));
    return Buffer.concat([decipher.update(envelope.subarray(newline + 1, -16)), decipher.final()]);
  } finally {
    key.fill(0);
  }
}

export function frames(envelope) {
  const size = 4096;
  const count = Math.ceil(envelope.length / size);
  const sha256 = digest(envelope);
  return Array.from({ length: count }, (_, index) => JSON.stringify({
    type: VERSION,
    sha256,
    index,
    count,
    data: encode(envelope.subarray(index * size, (index + 1) * size)),
  }));
}

export function reassemble(lines) {
  const parts = lines.map(line => JSON.parse(line));
  if (!parts.length || parts.length > 8193) throw new Error('Invalid frame count');
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (part.type !== VERSION || part.index !== index || part.count !== parts.length || part.sha256 !== parts[0].sha256) throw new Error('Invalid frame sequence');
  }
  const envelope = Buffer.concat(parts.map(part => decode(part.data)));
  if (envelope.length > MAX_BYTES + 4096 || digest(envelope) !== parts[0].sha256) throw new Error('Invalid envelope digest');
  return envelope;
}

const [command, first, second, third] = process.argv.slice(2);
if (command === 'keygen') {
  const pair = recipient();
  writeFileSync(first, pair.privateKey, { mode: 0o600, flag: 'wx' });
  writeFileSync(second, pair.publicKey, { mode: 0o600, flag: 'wx' });
} else if (command === 'seal') {
  writeFileSync(third, seal(readFileSync(first), readFileSync(second)), { mode: 0o600, flag: 'wx' });
} else if (command === 'open') {
  writeFileSync(third, open(readFileSync(first), readFileSync(second)), { mode: 0o600, flag: 'wx' });
} else if (command === 'frames') {
  process.stdout.write(`${frames(readFileSync(first)).join('\n')}\n`);
}

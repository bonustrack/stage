#!/usr/bin/env bun
import { X509Certificate, constants, createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { inflateRawSync } from 'node:zlib';

const V2_BLOCK_ID = 0x7109871a;
const SIGNING_BLOCK_MAGIC = 'APK Sig Block 42';
const CHUNK_SIZE = 1024 * 1024;
const NO_STRING = 0xffffffff;

const SIGNATURE_ALGORITHMS = new Map([
  [0x0101, { hash: 'sha256', pssSalt: 32 }],
  [0x0102, { hash: 'sha512', pssSalt: 64 }],
  [0x0103, { hash: 'sha256' }],
  [0x0104, { hash: 'sha512' }],
  [0x0201, { hash: 'sha256' }],
  [0x0202, { hash: 'sha512' }],
  [0x0301, { hash: 'sha256' }],
]);

const USAGE = 'usage: bun scripts/verify-apk.mjs <file.apk> [--package id] [--version-code n] [--version-name v] [--runtime hash] [--commit sha] [--cert sha256]';

function fail(message) {
  throw new Error(message);
}

function lengthPrefixed(buffer, offset) {
  if (offset + 4 > buffer.length) fail('truncated APK Signature Scheme v2 block');
  const end = offset + 4 + buffer.readUInt32LE(offset);
  if (end > buffer.length) fail('truncated APK Signature Scheme v2 block');
  return { value: buffer.subarray(offset + 4, end), next: end };
}

function sequence(buffer) {
  const items = [];
  for (let offset = 0; offset < buffer.length;) {
    const { value, next } = lengthPrefixed(buffer, offset);
    items.push(value);
    offset = next;
  }
  return items;
}

function idAndBytes(item) {
  return { id: item.readUInt32LE(0), bytes: lengthPrefixed(item, 4).value };
}

function findEocd(apk) {
  const lowest = Math.max(0, apk.length - 22 - 0xffff);
  for (let offset = apk.length - 22; offset >= lowest; offset -= 1) {
    if (apk.readUInt32LE(offset) === 0x06054b50 && offset + 22 + apk.readUInt16LE(offset + 20) === apk.length) {
      return offset;
    }
  }
  return fail('not a ZIP file: no end of central directory record');
}

function readZip(apk) {
  const eocd = findEocd(apk);
  const cdSize = apk.readUInt32LE(eocd + 12);
  const cdOffset = apk.readUInt32LE(eocd + 16);
  if (cdOffset + cdSize !== eocd) fail('central directory does not end at the end of central directory record');
  const entries = new Map();
  for (let offset = cdOffset; offset < eocd;) {
    if (apk.readUInt32LE(offset) !== 0x02014b50) fail('corrupt central directory');
    const nameLength = apk.readUInt16LE(offset + 28);
    const name = apk.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, {
      method: apk.readUInt16LE(offset + 10),
      compressedSize: apk.readUInt32LE(offset + 20),
      localOffset: apk.readUInt32LE(offset + 42),
    });
    offset += 46 + nameLength + apk.readUInt16LE(offset + 30) + apk.readUInt16LE(offset + 32);
  }
  return { eocd, cdOffset, entries };
}

function readEntry(apk, zip, name) {
  const entry = zip.entries.get(name);
  if (!entry) return null;
  const { localOffset, method, compressedSize } = entry;
  if (apk.readUInt32LE(localOffset) !== 0x04034b50) fail(`corrupt local header for ${name}`);
  const start = localOffset + 30 + apk.readUInt16LE(localOffset + 26) + apk.readUInt16LE(localOffset + 28);
  const data = apk.subarray(start, start + compressedSize);
  if (method === 0) return data;
  if (method === 8) return inflateRawSync(data);
  return fail(`unsupported compression method ${method} for ${name}`);
}

function signingBlock(apk, cdOffset) {
  if (cdOffset < 32 || apk.toString('latin1', cdOffset - 16, cdOffset) !== SIGNING_BLOCK_MAGIC) {
    fail('no APK Signing Block: the APK is not signed with APK Signature Scheme v2');
  }
  const size = Number(apk.readBigUInt64LE(cdOffset - 24));
  const start = cdOffset - size - 8;
  if (start < 0 || Number(apk.readBigUInt64LE(start)) !== size) fail('corrupt APK Signing Block');
  const pairs = new Map();
  for (let offset = start + 8; offset < cdOffset - 24;) {
    const length = Number(apk.readBigUInt64LE(offset));
    pairs.set(apk.readUInt32LE(offset + 8), apk.subarray(offset + 12, offset + 8 + length));
    offset += 8 + length;
  }
  return { start, pairs };
}

function chunkedDigest(hash, sections) {
  const digests = [];
  for (const section of sections) {
    for (let offset = 0; offset < section.length; offset += CHUNK_SIZE) {
      const chunk = section.subarray(offset, offset + CHUNK_SIZE);
      const prefix = Buffer.alloc(5, 0xa5);
      prefix.writeUInt32LE(chunk.length, 1);
      digests.push(createHash(hash).update(prefix).update(chunk).digest());
    }
  }
  const prefix = Buffer.alloc(5, 0x5a);
  prefix.writeUInt32LE(digests.length, 1);
  return createHash(hash).update(prefix).update(Buffer.concat(digests)).digest();
}

function verifyV2(apk, zip) {
  const block = signingBlock(apk, zip.cdOffset);
  const v2 = block.pairs.get(V2_BLOCK_ID);
  if (!v2) fail('no APK Signature Scheme v2 signature');
  const signers = sequence(lengthPrefixed(v2, 0).value);
  const [signer] = signers;
  if (!signer || signers.length !== 1) fail(`expected one v2 signer, found ${signers.length}`);
  const signedData = lengthPrefixed(signer, 0);
  const signatureList = lengthPrefixed(signer, signedData.next);
  const publicKey = lengthPrefixed(signer, signatureList.next).value;
  const digestList = lengthPrefixed(signedData.value, 0);
  const [certificate] = sequence(lengthPrefixed(signedData.value, digestList.next).value);
  if (!certificate) fail('v2 signer has no certificate');
  const digests = new Map(sequence(digestList.value).map(idAndBytes).map(({ id, bytes }) => [id, bytes]));
  const signatures = sequence(signatureList.value).map(idAndBytes);
  const signatureIds = signatures.map(({ id }) => id).sort();
  if (signatureIds.join() !== [...digests.keys()].sort().join()) fail('v2 digest and signature algorithms differ');
  const supported = signatures.filter(({ id }) => SIGNATURE_ALGORITHMS.has(id));
  if (supported.length === 0) fail(`no supported v2 signature algorithm in ${signatureIds.join(', ')}`);
  const key = createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
  const cert = new X509Certificate(certificate);
  if (!cert.publicKey.export({ type: 'spki', format: 'der' }).equals(publicKey)) {
    fail('v2 signing certificate does not match the signer public key');
  }
  const eocd = Buffer.from(apk.subarray(zip.eocd));
  eocd.writeUInt32LE(block.start, 16);
  const sections = [apk.subarray(0, block.start), apk.subarray(zip.cdOffset, zip.eocd), eocd];
  const computed = new Map();
  for (const { id, bytes } of supported) {
    const { hash, pssSalt } = SIGNATURE_ALGORITHMS.get(id) ?? fail(`unsupported algorithm ${id}`);
    const options = pssSalt ? { key, padding: constants.RSA_PKCS1_PSS_PADDING, saltLength: pssSalt } : key;
    if (!verify(hash, signedData.value, options, bytes)) fail(`v2 signature 0x${id.toString(16)} does not verify`);
    if (!computed.has(hash)) computed.set(hash, chunkedDigest(hash, sections));
    if (!computed.get(hash).equals(digests.get(id))) fail('APK contents do not match the v2 signed digest');
  }
  return {
    signatureScheme: 'v2',
    signatureAlgorithms: supported.map(({ id }) => `0x${id.toString(16).padStart(4, '0')}`),
    certSha256: createHash('sha256').update(certificate).digest('hex'),
    certSubject: cert.subject.replaceAll('\n', ', '),
  };
}

function stringPool(chunk) {
  const headerSize = chunk.readUInt16LE(2);
  const count = chunk.readUInt32LE(8);
  const utf8 = (chunk.readUInt32LE(16) & 0x100) !== 0;
  const stringsStart = chunk.readUInt32LE(20);
  const varLength = (offset) => chunk[offset] & 0x80
    ? { length: ((chunk[offset] & 0x7f) << 8) | chunk[offset + 1], next: offset + 2 }
    : { length: chunk[offset], next: offset + 1 };
  return Array.from({ length: count }, (_, index) => {
    const offset = stringsStart + chunk.readUInt32LE(headerSize + index * 4);
    if (utf8) {
      const { length, next } = varLength(varLength(offset).next);
      return chunk.toString('utf8', next, next + length);
    }
    const first = chunk.readUInt16LE(offset);
    const long = (first & 0x8000) !== 0;
    const length = long ? ((first & 0x7fff) << 16) | chunk.readUInt16LE(offset + 2) : first;
    const start = offset + (long ? 4 : 2);
    return chunk.toString('utf16le', start, start + length * 2);
  });
}

function attributeValue(xml, at, strings) {
  const rawValue = xml.readUInt32LE(at + 8);
  const dataType = xml[at + 15];
  const data = xml.readUInt32LE(at + 16);
  if (dataType === 0x03) return strings[data];
  if (dataType === 0x12) return data !== 0;
  if (rawValue !== NO_STRING) return strings[rawValue];
  return data;
}

function manifestElements(xml) {
  if (xml.readUInt16LE(0) !== 0x0003) fail('AndroidManifest.xml is not binary XML');
  let strings = [];
  const elements = [];
  for (let offset = xml.readUInt16LE(2); offset < xml.length;) {
    const type = xml.readUInt16LE(offset);
    const headerSize = xml.readUInt16LE(offset + 2);
    const size = xml.readUInt32LE(offset + 4);
    if (size === 0) fail('corrupt AndroidManifest.xml');
    if (type === 0x0001) strings = stringPool(xml.subarray(offset, offset + size));
    if (type === 0x0102) {
      const ext = offset + headerSize;
      const attributeStart = xml.readUInt16LE(ext + 8);
      const attributeSize = xml.readUInt16LE(ext + 10);
      const attributes = {};
      for (let index = 0; index < xml.readUInt16LE(ext + 12); index += 1) {
        const at = ext + attributeStart + index * attributeSize;
        attributes[strings[xml.readUInt32LE(at + 4)]] = attributeValue(xml, at, strings);
      }
      elements.push({ name: strings[xml.readUInt32LE(ext + 4)], attributes });
    }
    offset += size;
  }
  return elements;
}

function inspect(path) {
  const apk = readFileSync(path);
  const zip = readZip(apk);
  const signature = verifyV2(apk, zip);
  const manifestXml = readEntry(apk, zip, 'AndroidManifest.xml') ?? fail('no AndroidManifest.xml');
  const elements = manifestElements(manifestXml);
  const manifest = elements.find(({ name }) => name === 'manifest')?.attributes ?? fail('no manifest element');
  const application = elements.find(({ name }) => name === 'application')?.attributes ?? {};
  const runtime = readEntry(apk, zip, 'assets/fingerprint')?.toString('utf8').trim() ?? null;
  const appConfig = readEntry(apk, zip, 'assets/app.config');
  const abis = [...new Set([...zip.entries.keys()].map((name) => /^lib\/([^/]+)\//.exec(name)?.[1]).filter(Boolean))];
  return {
    file: path,
    bytes: apk.length,
    sha256: createHash('sha256').update(apk).digest('hex'),
    package: manifest.package ?? null,
    versionCode: manifest.versionCode ?? null,
    versionName: manifest.versionName ?? null,
    debuggable: application.debuggable === true,
    runtime,
    commit: appConfig ? JSON.parse(appConfig.toString('utf8')).extra?.gitHash ?? null : null,
    ...signature,
    abis,
  };
}

function normalise(field, value) {
  return field === 'certSha256' ? String(value).toLowerCase().replaceAll(':', '') : String(value);
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      package: { type: 'string' },
      'version-code': { type: 'string' },
      'version-name': { type: 'string' },
      runtime: { type: 'string' },
      commit: { type: 'string' },
      cert: { type: 'string' },
    },
  });
  const [path] = positionals;
  if (!path || positionals.length !== 1) {
    console.error(USAGE);
    process.exit(2);
  }
  let report;
  try {
    report = inspect(path);
  } catch (error) {
    console.error(`verify-apk: ${path}: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
  const expected = [
    ['package', values.package],
    ['versionCode', values['version-code']],
    ['versionName', values['version-name']],
    ['runtime', values.runtime],
    ['commit', values.commit],
    ['certSha256', values.cert],
  ];
  const mismatches = expected
    .filter(([, want]) => want !== undefined)
    .filter(([field, want]) => report[field] === null || normalise(field, report[field]) !== normalise(field, want))
    .map(([field, want]) => `${field} is ${report[field]}, expected ${want}`);
  console.log(JSON.stringify(report, null, 2));
  if (mismatches.length > 0) {
    for (const mismatch of mismatches) console.error(`verify-apk: ${mismatch}`);
    process.exit(1);
  }
}

main();

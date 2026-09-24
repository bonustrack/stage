import { describe, expect, test } from 'bun:test';
import { HistoryProblem } from '../lib/historySync.model';
import {
  TRANSFER_COPY, TRANSFER_TTL_MS, downloadProblem, importProblem, transferExpiry, transferProblemMessage, uploadProblem,
} from '../lib/historyTransfer.model';
import {
  canSubmitCode, codeFromScan, displayCode, expiryLabel,
} from '../components/settings/HistoryTransferSheets.model';

describe('transfer http problems', () => {
  test('a missing, used or expired code reads as not found', () => {
    expect(downloadProblem(404)).toBe(TRANSFER_COPY.notFound);
  });

  test('rate limits and other failures', () => {
    expect(downloadProblem(429)).toBe(TRANSFER_COPY.rateLimited);
    expect(downloadProblem(502)).toBe(TRANSFER_COPY.downloadFailed);
    expect(uploadProblem(413)).toBe(TRANSFER_COPY.tooLarge);
    expect(uploadProblem(429)).toBe(TRANSFER_COPY.rateLimited);
    expect(uploadProblem(500)).toBe(TRANSFER_COPY.uploadFailed);
  });
});

describe('importProblem', () => {
  test('a key that does not decrypt the archive is a wrong code', () => {
    expect(importProblem(new Error('Missing metadata'))).toBe(TRANSFER_COPY.wrongCode);
    expect(importProblem(new Error('AES-GCM encryption error'))).toBe(TRANSFER_COPY.wrongCode);
  });

  test('an archive libxmtp cannot parse comes from an incompatible version', () => {
    expect(importProblem(new Error('failed to decode Protobuf message: invalid wire type'))).toBe(TRANSFER_COPY.incompatible);
    expect(importProblem(new Error('IO error: Unknown frame descriptor'))).toBe(TRANSFER_COPY.incompatible);
  });

  test('keeps our own problems and falls back otherwise', () => {
    expect(importProblem(new HistoryProblem(TRANSFER_COPY.importSlow))).toBe(TRANSFER_COPY.importSlow);
    expect(importProblem(new Error('boom'))).toBe(TRANSFER_COPY.importFailed);
  });
});

describe('transferProblemMessage', () => {
  test('network failures, our problems and anything else', () => {
    expect(transferProblemMessage(new TypeError('Failed to fetch'), 'fallback', 'offline')).toBe('offline');
    expect(transferProblemMessage(new TypeError('Network request failed'), 'fallback', 'offline')).toBe('offline');
    expect(transferProblemMessage(new HistoryProblem(TRANSFER_COPY.notFound), 'fallback', 'offline')).toBe(TRANSFER_COPY.notFound);
    expect(transferProblemMessage(new Error('boom'), 'fallback', 'offline')).toBe('fallback');
  });
});

describe('transferExpiry', () => {
  test('uses the Worker expiry and falls back to 24 hours', () => {
    expect(transferExpiry({ expiresAt: 5_000 }, 1_000)).toBe(5_000);
    expect(transferExpiry({ expiresAt: 500 }, 1_000)).toBe(1_000 + TRANSFER_TTL_MS);
    expect(transferExpiry(undefined, 1_000)).toBe(1_000 + TRANSFER_TTL_MS);
    expect(transferExpiry({ expiresAt: 'soon' }, 1_000)).toBe(1_000 + TRANSFER_TTL_MS);
  });
});

describe('transfer sheets', () => {
  test('only a full code can be submitted', () => {
    expect(canSubmitCode('k7m2-9qx4-tr')).toBe(true);
    expect(canSubmitCode('K7M29QX4TR')).toBe(true);
    expect(canSubmitCode('K7M2-9QX4')).toBe(false);
    expect(canSubmitCode('')).toBe(false);
  });

  test('scanned text becomes a formatted code or nothing', () => {
    expect(codeFromScan(' k7m29qx4tr\n')).toBe('K7M2-9QX4-TR');
    expect(codeFromScan('stage://link/abc')).toBeNull();
    expect(displayCode('K7M29QX4TR')).toBe('K7M2-9QX4-TR');
  });

  test('expiry reads in hours, then minutes, then expired', () => {
    expect(expiryLabel(TRANSFER_TTL_MS, 0)).toBe('Works once. Expires in 24 hours.');
    expect(expiryLabel(60 * 60_000, 0)).toBe('Works once. Expires in 1 hour.');
    expect(expiryLabel(59 * 60_000, 0)).toBe('Works once. Expires in 59 minutes.');
    expect(expiryLabel(30_000, 0)).toBe('Works once. Expires in 1 minute.');
    expect(expiryLabel(0, 10)).toBe('This code has expired.');
  });
});

import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportWeb } from '../../scripts/exportWeb.mjs';

const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

rmSync(outDir, { recursive: true, force: true });
exportWeb(outDir);

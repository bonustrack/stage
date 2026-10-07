import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dir, '../../../..');
const TEXT = "import { Text as Copy } from '@stage-labs/kit/react-native/text';";
const TOKENS = "import { FONT_SIZE as sizes, fontSize as sizeOf } from '@stage-labs/kit/tokens';";
const NAMESPACE = "import * as tokens from '@stage-labs/kit/tokens';";
const SHEET = "import { StyleSheet as Sheet } from 'react-native';";
const RULE = 'stage(no-custom-font-size)';

const INVALID = [
  `${TEXT} <Copy style={{ fontSize: 26 }} />;`,
  `${TEXT} <Copy style={{ 'fontSize': '26px' }} />;`,
  `${TEXT} <Copy style={{ ['fontSize']: 26 }} />;`,
  `${TEXT} <Copy style={{ [\`fontSize\`]: 26 }} />;`,
  `${TEXT} <Copy style={{ fontSize: 13 * 2 }} />;`,
  `${TEXT} const n = 26; <Copy style={{ fontSize: n }} />;`,
  `${TEXT} ${TOKENS} <Copy style={{ fontSize: sizes.md }} />;`,
  `${TEXT} ${TOKENS} const style = { fontSize: sizes.md }; <Copy style={style} />;`,
  `${TEXT} ${TOKENS} const style = { fontSize: sizes.md }; <Copy style={[{}, style]} />;`,
  `${TEXT} ${TOKENS} const style = { fontSize: sizes.md }; <Copy style={{ ...style }} />;`,
  `${TEXT} ${TOKENS} const style = { fontSize: sizes.md }; <Copy style={flag && style} />;`,
  `${TEXT} ${TOKENS} const style = { fontSize: sizes.md }; <Copy style={flag ? style : {}} />;`,
  `${TEXT} ${TOKENS} ${SHEET} const styles = Sheet.create({ title: { fontSize: sizes.md } }); <Copy style={styles.title} />;`,
  `${TEXT} ${TOKENS} ${SHEET} const styles = Sheet.create({ title: { fontSize: sizes.md } }); <Copy style={Sheet.flatten([styles.title])} />;`,
  `${TEXT} ${TOKENS} const props = { style: { fontSize: sizes.md } }; <Copy {...props} />;`,
  `${TEXT} ${TOKENS} const props = { style: { fontSize: sizes.md } }; <Copy {...{ ...props }} />;`,
  `${TEXT} ${TOKENS} const Body = Copy; <Body style={{ fontSize: sizes.md }} />;`,
  `import * as Kit from '@stage-labs/kit/react-native/text'; ${TOKENS} <Kit.Text style={{ fontSize: sizes.md }} />;`,
  `${TEXT} <Copy style={{ 'font-size': '26px' }} />;`,
  `${TEXT} <Copy style={{ font: '26px Calibre' }} />;`,
  `${TEXT} <Copy fontSize={26} />;`,
  'const style = { fontSize: 26 };',
  "const style = { fontSize: '26px' };",
  'const fontSize = 26; const style = { fontSize };',
  'const style = {}; style.fontSize = 26;',
  "const style = {}; style['fontSize'] = '26px';",
  "const css = '.copy { font-size: 26px; }';",
  'const css = `.copy { font-size: ${size}px; }`;',
  'const css = `.copy { font: 26px Calibre; }`;',
  `${TOKENS} function demo(sizes) { return { fontSize: sizes.md }; }`,
  'const fontSize = () => 26; const style = { fontSize: fontSize() };',
  `${TEXT} const a = b; const b = a; <Copy style={{ fontSize: a }} />;`,
  "const key = 'fontSize'; const style = { [key]: 31 };",
  `${TEXT} ${TOKENS} const key = 'fontSize'; const style = { [key]: sizes.md }; <Copy style={style} />;`,
  `${TOKENS} const style = { fontSize: sizes.md }; style.fontSize += sizes.sm;`,
  `${TOKENS} const style = { fontSize: sizes.md }; style.fontSize++;`,
  `${TOKENS} const style = { fontSize: sizes.md }; --style.fontSize;`,
  `${TEXT} ${TOKENS} const props = active ? { style: { fontSize: sizes.md } } : {}; <Copy {...props} />;`,
  `${TEXT} ${TOKENS} const props = { style: { fontSize: sizes.md } }; <Copy {...(active && props)} />;`,
  `${TEXT} ${TOKENS} const base = { body: { fontSize: sizes.md } }; const styles = { ...base }; <Copy style={styles.body} />;`,
  `import * as Kit from '@stage-labs/kit/react-native/text'; ${TOKENS} const Copy = Kit.Text; <Copy style={{ fontSize: sizes.md }} />;`,
  `${TEXT} ${TOKENS} ${SHEET} const S = Sheet; const styles = S.create({ body: { fontSize: sizes.md } }); <Copy style={S.flatten(styles.body)} />;`,
  `${TEXT} ${TOKENS} const styles = [{ fontSize: sizes.md }]; <Copy style={styles[0]} />;`,
  `${TEXT} ${TOKENS} const styles = flag ? { body: { fontSize: sizes.md } } : { body: {} }; <Copy style={styles.body} />;`,
  "const css = '.copy { FONT-SIZE: 27px; }';",
  "const css = '.copy { FONT: 27px Calibre; }';",
  'const css = String.raw`.\\31 title { font-size: 27px; }`;',
  `${TEXT} ${TOKENS} const styles = { 0: { fontSize: sizes.md } }; <Copy style={styles['0']} />;`,
  `${TEXT} ${TOKENS} <Copy fontSize={sizes.lg} />;`,
  `${TEXT} ${TOKENS} const { md } = sizes; <Copy style={{ fontSize: md }} />;`,
  `${TEXT} ${TOKENS} const { body } = { body: { fontSize: sizes.md } }; <Copy style={body} />;`,
  `${TEXT} ${TOKENS} const [style] = [{ fontSize: sizes.md }]; <Copy style={style} />;`,
  `${TEXT} ${NAMESPACE} <Copy style={{ fontSize: tokens.FONT_SIZE.md }} />;`,
  `${TEXT} ${TOKENS} const base = { body: {} }; const styles = { ...base, body: { fontSize: sizes.md } }; <Copy style={styles.body} />;`,
];

const VALID = [
  `${TEXT} <Copy size="3xl" style={{ lineHeight: 31.2, letterSpacing: 0.2 }} />;`,
  `${TEXT} const style = { letterSpacing: 1 }; <Copy style={[style]} />;`,
  `${TEXT} ${SHEET} const styles = Sheet.create({ title: { lineHeight: 31 } }); <Copy style={styles.title} />;`,
  `${TOKENS} const style = { fontSize: sizes.md };`,
  `${TOKENS} const style = { fontSize: sizeOf('md') };`,
  `${TOKENS} const md = sizes.md; const style = { fontSize: md };`,
  `${TOKENS} const style = { fontSize: flag ? sizes.md : sizes.lg };`,
  `${TOKENS} <Editor fontSize={sizeOf('lg')} />;`,
  `${TOKENS} <Markdown fontSize={sizeOf('md')} />;`,
  `${TEXT} ${TOKENS} function demo(Copy) { return <Copy style={{ fontSize: sizes.md }} />; }`,
  `${TOKENS} import { Text } from 'somewhere-else'; <Text style={{ fontSize: sizes.md }} />;`,
  "import { BALANCE_TITLE_STYLE } from '@stage-labs/kit/react-native/title'; <Title style={BALANCE_TITLE_STYLE} />;",
  "const fontSize = 'lineHeight'; const style = { [fontSize]: 31 };",
  'function read({ fontSize }: TextStyle) { return fontSize; }',
  'const { fontSize } = style;',
  `${NAMESPACE} const style = { fontSize: tokens.FONT_SIZE.md };`,
  `${NAMESPACE} const style = { fontSize: tokens.fontSize('md') };`,
  `${NAMESPACE} const { FONT_SIZE: sizes, fontSize: sizeOf } = tokens; const style = { fontSize: sizeOf('md') };`,
  `${TOKENS} const { md } = sizes; const style = { fontSize: md };`,
  `${TOKENS} const { md: value } = sizes; const style = { fontSize: value };`,
  `${TOKENS} const [value] = [sizes.md]; const style = { fontSize: value };`,
  `${TOKENS} const { inner: { md } } = { inner: sizes }; const style = { fontSize: md };`,
  "const copy = 'Unsupported font: Calibre';",
  "const css = '.copy { --font: Calibre; }';",
  `${TEXT} ${TOKENS} const base = { body: { fontSize: sizes.md } }; const styles = { ...base, body: { lineHeight: 31 } }; <Copy style={styles.body} />;`,
  `${TEXT} const base = { ...base }; <Copy style={base.body} />;`,
  `${TOKENS} const t0 = sizes.md; ${Array.from({ length: 35 }, (_, i) => `const t${i + 1} = flag ? t${i} : t${i};`).join(' ')} const style = { fontSize: t35 };`,
];

function writeFixture(root, path, code) {
  const file = join(root, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, code);
}

function lintFixtures(root) {
  const require = createRequire(join(ROOT, 'package.json'));
  const config = JSON.parse(readFileSync(join(ROOT, '.oxlintrc.json'), 'utf8'));
  config.jsPlugins = config.jsPlugins.map(plugin => require.resolve(plugin));
  config.options.typeAware = false;
  writeFileSync(join(root, '.oxlintrc.json'), JSON.stringify(config));
  const result = spawnSync(join(ROOT, 'node_modules/.bin/oxlint'), ['--format', 'json', '.'], { cwd: root, encoding: 'utf8', timeout: 10000 });
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout.trim().startsWith('{'), result.stdout || result.stderr).toBe(true);
  const output = JSON.parse(result.stdout);
  return output.diagnostics.filter(d => d.code === RULE);
}

function fixtures() {
  const invalid = new Map(INVALID.map((code, i) => [`apps/stage/components/invalid-${i}.tsx`, code]));
  const valid = new Map(VALID.map((code, i) => [`apps/stage/components/valid-${i}.tsx`, code]));
  for (const dir of ['app', 'lib', 'modules', 'platform']) invalid.set(`apps/stage/${dir}/invalid.ts`, 'const style = { fontSize: 26 };');
  invalid.set('apps/stage/components/landing/invalid.jsx', `${TEXT} <Copy style={{ fontSize: 26 }} />;`);
  valid.set('packages/kit/src/semantic.ts', 'const style = { fontSize: 38 };');
  valid.set('packages/kit/src/markdown.ts', 'const style = { fontSize: Math.round(size * 1.6) };');
  valid.set('apps/stage/test/fixture.spec.ts', 'const style = { fontSize: 38 };');
  return { invalid, valid };
}

test('typography lint rejects app overrides, follows Kit Text aliases and local styles, and preserves Kit/test boundaries', () => {
  const root = mkdtempSync(join(tmpdir(), 'stage-typography-lint-'));
  try {
    const { invalid, valid } = fixtures();
    for (const [path, code] of [...invalid, ...valid]) writeFixture(root, path, code);
    const files = new Set(lintFixtures(root).map(d => d.filename));
    for (const [path, code] of invalid) expect(files.has(path), code).toBe(true);
    expect([...files].sort()).toEqual([...invalid.keys()].sort());
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 15000);

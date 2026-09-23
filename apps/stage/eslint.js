import { existsSync } from 'node:fs';
import { MAX_LINES, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from '@stage-labs/config/eslint/base';

const TEXT_ROLE_HINT = {
  link: 'role="link" (or drop it - default text is already the head colour)',
  danger: 'role="danger"',
  success: 'role="success"',
  sub: 'role="secondary"',
};
const BOX_SURFACE_HINT = {
  bg: 'surface="surface"',
  inputBg: 'surface="raised"',
  rowBg: 'surface="raised"',
  toolbarBg: 'surface="toolbar"',
};
const TEXT_TAGS = new Set(['Text', 'Title', 'Caption']);
const BOX_TAGS = new Set(['Box', 'Row', 'Col']);
const stageThemeNative = {
  rules: {
    'prefer-role-variant': {
      meta: { type: 'suggestion', docs: { description: 'prefer theme-native role/surface variants over per-call color/background palette idents' }, schema: [] },
      create(context) {
        return {
          JSXAttribute(node) {
            const attr = node.name && node.name.name;
            if (attr !== 'color' && attr !== 'background') return;
            const open = node.parent;
            const tag = open && open.name && open.name.name;
            if (!tag) return;
            const val = node.value;
            if (!val || val.type !== 'JSXExpressionContainer') return;
            const expr = val.expression;
            if (!expr || expr.type !== 'Identifier') return;
            const name = expr.name;
            if (attr === 'color' && TEXT_TAGS.has(tag) && TEXT_ROLE_HINT[name]) {
              context.report({ node, message: `theme-native: prefer ${TEXT_ROLE_HINT[name]} over color={${name}} on <${tag}> (color is an override escape hatch).` });
            } else if (attr === 'background' && BOX_TAGS.has(tag) && BOX_SURFACE_HINT[name]) {
              context.report({ node, message: `theme-native: prefer ${BOX_SURFACE_HINT[name]} over background={${name}} on <${tag}> (background is an override escape hatch).` });
            }
          },
        };
      },
    },
  },
};

const SECRET_KEY_CONSTANTS = new Set(['PK_PREFIX', 'LEGACY_PK_KEY']);
const SECRET_VIEM_NAMES = new Set([
  'privateKeyToAccount', 'generatePrivateKey', 'mnemonicToAccount', 'hdKeyToAccount',
]);
const keyringGuardRule = {
  'no-keyring-bypass': {
      meta: {
        type: 'problem',
        docs: { description: 'only lib/zerodev/keyring may import private-key/mnemonic primitives' },
        schema: [],
      },
      create(context) {
        const file = (context.filename ?? context.getFilename?.() ?? '').replace(/\\/g, '/');
        if (file.endsWith('/lib/zerodev/keyring.ts')) return {};
        const fail = (node, what) =>
          context.report({
            node,
            message:
              `Keyring guard: ${what} must only be imported by lib/zerodev/keyring (the single ` +
              'private-key/mnemonic chokepoint). Use the keyring\'s public API instead.',
          });
        return {
          ImportDeclaration(node) {
            const src = node.source.value;
            if (src === '@stage-labs/client/zerodev/derive') {
              for (const s of node.specifiers) {
                const name = s.imported?.name;
                if (name === 'deriveOwner' || name === 'generateWalletMnemonic' || name === 'ownerAddress') {
                  fail(node, `'${name}' from @stage-labs/client/zerodev/derive`);
                }
              }
            } else if (src === '@stage-labs/client/accounts/keys') {
              for (const s of node.specifiers) {
                if (s.imported && SECRET_KEY_CONSTANTS.has(s.imported.name)) {
                  fail(node, `the private-key storage-key constant '${s.imported.name}'`);
                }
              }
            } else if (src === 'viem/accounts') {
              for (const s of node.specifiers) {
                if (s.imported && SECRET_VIEM_NAMES.has(s.imported.name)) {
                  fail(node, `'${s.imported.name}' from viem/accounts`);
                }
              }
            }
          },
        };
      },
    },
};

const NATIVE_ONLY_PACKAGES = new Set(['@xmtp/react-native-sdk']);
const SEAM_EXT = /\.(ts|tsx)$/;
function hasWebSibling(file) {
  if (!SEAM_EXT.test(file) || /\.web\.(ts|tsx)$/.test(file)) return false;
  const base = file.replace(SEAM_EXT, '');
  return existsSync(`${base}.web.ts`) || existsSync(`${base}.web.tsx`);
}
function isTypeOnlyImport(node) {
  if (node.importKind === 'type') return true;
  return node.specifiers.length > 0 && node.specifiers.every((s) => s.importKind === 'type');
}
const nativeSeamRule = {
  'native-only-in-seams': {
    meta: {
      type: 'problem',
      docs: { description: 'value imports of native-only packages belong in a native seam x.ts that has an x.web.ts sibling' },
      schema: [],
    },
    create(context) {
      const file = (context.filename ?? context.getFilename?.() ?? '').replace(/\\/g, '/');
      if (hasWebSibling(file)) return {};
      const check = (node, source) => {
        if (!NATIVE_ONLY_PACKAGES.has(source)) return;
        context.report({
          node,
          message:
            `'${source}' is native-only and crashes the web bundle at load. Use \`import type\` here, ` +
            'or move the value import into a native seam x.ts that has an x.web.ts sibling.',
        });
      };
      return {
        ImportDeclaration(node) {
          if (isTypeOnlyImport(node)) {
            if (node.importKind !== 'type' && NATIVE_ONLY_PACKAGES.has(node.source.value)) {
              context.report({ node, message: `Write \`import type\` for '${node.source.value}': an inline-type-only import can survive as a side-effect import on web.` });
            }
            return;
          }
          check(node, node.source.value);
        },
        ExportNamedDeclaration(node) {
          if (node.source && node.exportKind !== 'type') check(node, node.source.value);
        },
        ExportAllDeclaration(node) {
          if (node.exportKind !== 'type') check(node, node.source.value);
        },
        ImportExpression(node) {
          if (node.source.type === 'Literal') check(node, node.source.value);
        },
        CallExpression(node) {
          const arg = node.arguments[0];
          if (node.callee.type === 'Identifier' && node.callee.name === 'require' && arg && arg.type === 'Literal') check(node, arg.value);
        },
      };
    },
  },
};

const SILENT_IDENTIFIERS = new Set(['undefined']);
const SILENT_LITERALS = new Set([null, false, '', 0]);
function isSilentHandler(fn) {
  if (!fn || (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression')) return false;
  const body = fn.body;
  if (body.type === 'BlockStatement') return body.body.length === 0;
  if (body.type === 'Literal') return SILENT_LITERALS.has(body.value);
  if (body.type === 'Identifier') return SILENT_IDENTIFIERS.has(body.name);
  if (body.type === 'ArrayExpression') return body.elements.length === 0;
  if (body.type === 'ObjectExpression') return body.properties.length === 0;
  if (body.type === 'TSAsExpression') return isSilentHandler({ ...fn, body: body.expression });
  return false;
}
const errorPolicyRule = {
  'no-silent-catch': {
    meta: {
      type: 'problem',
      docs: { description: 'every swallowed error goes through lib/errorPolicy (ignore/ignored/attempt for best-effort, report/reported/recover to log)' },
      schema: [],
    },
    create(context) {
      return {
        CatchClause(node) {
          if (node.body.body.length > 0) return;
          context.report({
            node,
            message: 'Empty catch: use attempt()/ignore()/ignored() from lib/errorPolicy for intentional best-effort work (with a BestEffort reason), or report() to log and continue.',
          });
        },
        CallExpression(node) {
          const callee = node.callee;
          if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier' || callee.property.name !== 'catch') return;
          if (!isSilentHandler(node.arguments[0])) return;
          context.report({
            node,
            message: 'Silent .catch: use .catch(ignored(value, reason)) or ignore(promise, reason) for best-effort work, or .catch(reported(scope)) / .catch(recover(scope, value)) to log, from lib/errorPolicy.',
          });
        },
      };
    },
  },
};

const RN_PRIMITIVE_PATHS = [
  {
    name: 'react-native-safe-area-context',
    importNames: ['useSafeAreaInsets'],
    message:
      "Use useSafeAreaInsets from '@/lib/safeArea' so the desktop title bar counts as a top inset.",
  },
  {
    name: 'react-native',
    importNames: ['View'],
    message:
      "Use Box/Row/Col from '@/components/layout' instead of View for layout containers.",
  },
  {
    name: 'react-native',
    importNames: ['Image'],
    message:
      "Import Image from '@stage-labs/kit/react-native/image' instead of react-native.",
  },
  {
    name: 'react-native',
    importNames: ['TextInput'],
    message:
      "Use Input/Textarea from '@stage-labs/kit/react-native/input' | '@stage-labs/kit/react-native/textarea' instead of react-native TextInput.",
  },
  {
    name: 'react-native',
    importNames: ['ScrollView'],
    message:
      "Use Scroll from '@stage-labs/kit/react-native/scroll' instead of react-native ScrollView.",
  },
  {
    name: 'react-native',
    importNames: ['Pressable'],
    message:
      "Use Pressable from '@stage-labs/kit/react-native/pressable' (or Kit Button) instead of react-native Pressable.",
  },
  {
    name: 'react-native',
    importNames: ['FlatList'],
    message:
      "Use FlatList from '@stage-labs/kit/react-native/flat-list' instead of react-native FlatList.",
  },
];

export function reactNative() {
  return [
    { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'desktop/**'] },
    ...recommended,
    {
      files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'modules/**/*.{ts,tsx}', 'platform/**/*.{ts,tsx}'],
      plugins: { stage: { rules: { ...stageThemeNative.rules, ...keyringGuardRule, ...nativeSeamRule, ...errorPolicyRule } }, ...commentPlugins },
      rules: {
        ...COMMENT_RULES,
        ...FUNCTION_SIZE_RULES,
        'stage/prefer-role-variant': 'warn',
        'stage/no-keyring-bypass': 'error',
        'stage/native-only-in-seams': 'error',
        'stage/no-silent-catch': 'error',
        ...NO_ESCAPE_HATCHES,
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "Property[key.name='fontSize'] > Literal[value=type(number)]",
            message:
              "use a named Kit size token (Text size=\"sm|md|lg|...\" prop, or fontSize('md')/FONT_SIZE.md from '@stage-labs/kit/tokens') instead of a raw fontSize number.",
          },
          {
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='fontSize']",
            message:
              'Kit Text/Title/Caption must size via the `size` prop (size="sm|md|lg|..."), not a fontSize in style. Remove fontSize from the style and pass size= instead.',
          },
          {
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='fontFamily']",
            message:
              'Kit Text/Title/Caption apply Calibre internally - do not set fontFamily in style. Use the `weight` prop (normal/medium/semibold/bold) for the face, or variant="mono" for monospace.',
          },
          {
            selector:
              "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='color']",
            message:
              'Kit Text/Title/Caption must take their colour via the `color` prop (color={pal.text}), not a color in style. Remove color from the style and pass color= instead.',
          },
          {
            selector:
              "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
            message:
              "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
          },
          {
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft)$/]",
            message:
              'Box/Row/Col: use the layout prop instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, padding*->padding (scalar or {x,y,top,right,bottom,left}), margin*->margin (same Spacing shape) (see kit/src/layout.ts).',
          },
          {
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name='backgroundColor']",
            message:
              'Box/Row/Col: use the `surface` variant (surface/raised/sunken/toolbar) or the `background` override prop, not a backgroundColor in style.',
          },
        ],
        'max-lines': MAX_LINES,
        '@typescript-eslint/no-require-imports': 'off',
        'no-restricted-imports': ['error', { paths: RN_PRIMITIVE_PATHS }],
        '@typescript-eslint/no-restricted-imports': [
          'warn',
          {
            paths: [
              {
                name: 'react-native',
                importNames: ['Text'],
                message:
                  "Prefer Text from '@stage-labs/kit/react-native/text' instead of react-native (Kit-only rollout).",
              },
            ],
          },
        ],
      },
    },
    {
      files: ['components/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: RN_PRIMITIVE_PATHS,
            patterns: [
              {
                group: ['**/lib/xmtp', '**/lib/xmtp.*'],
                message:
                  "Import messaging via the '@/modules/messaging' facade barrel, not the lib/xmtp.* internals.",
              },
              {
                group: ['**/lib/accountEpoch'],
                message:
                  "Use useActiveAccount() / AccountManager from '@/modules/messaging', not lib/accountEpoch.",
              },
              {
                group: ['**/lib/channelsCache'],
                message:
                  "Import the channels cache via the '@/modules/messaging' facade barrel, not lib/channelsCache.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ['components/layout/**'],
      rules: {
        'no-restricted-imports': 'off',
        '@typescript-eslint/no-restricted-imports': 'off',
      },
    },
    {
      files: ['components/landing/**', 'components/chrome/PageIntro.tsx', 'components/chrome/PageIntro.model.ts'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
    {
      files: ['lib/safeArea.ts'],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
    {
      files: ['lib/zerodev/keyring.ts', 'lib/xmtp.dbkey.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "CallExpression[callee.object.name='secureStorage'][callee.property.name='set']:not([arguments.2.name=/^(STORE_OPTS|SENTINEL_OPTS)$/])",
            message: 'Secrets are device-bound: every secureStorage.set here must pass STORE_OPTS or SENTINEL_OPTS.',
          },
          {
            selector:
              "CallExpression[callee.object.name='secureStorage'][callee.property.name='get']:not([arguments.1.name=/^(STORE_OPTS|SENTINEL_OPTS)$/])",
            message: 'Secrets are device-bound: every secureStorage.get here must pass STORE_OPTS or SENTINEL_OPTS.',
          },
        ],
      },
    },
    {
      files: ['lib/cryptoShim.ts'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "MemberExpression[object.name='Math'][property.name='random']",
            message: 'The crypto shim must never fall back to Math.random; require a CSPRNG or throw.',
          },
        ],
      },
    },
    {
      files: ['**/*.js'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
      },
    },
  ];
}

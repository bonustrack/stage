import tseslint from "typescript-eslint";

/** Inline plugin: a WARNING (not error) that nudges per-call `color=`/`background=`
 *  on the theme-native Kit primitives toward the semantic variant when the value
 *  is a bare palette-role identifier. It runs as its OWN rule id so it can be a
 *  warning alongside the error-level structural bans (a single `no-restricted-syntax`
 *  can only carry one severity). It deliberately only fires on bare identifiers
 *  whose name is a known role, so escape-hatch one-offs (withAlpha tints, raw hex,
 *  computed expressions, brand swatches, the color-editor page) never warn. */
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
const TEXT_TAGS = new Set(["Text", "Title", "Caption"]);
const BOX_TAGS = new Set(["Box", "Row", "Col"]);
const metroThemeNative = {
  rules: {
    "prefer-role-variant": {
      meta: { type: "suggestion", docs: { description: "prefer theme-native role/surface variants over per-call color/background palette idents" }, schema: [] },
      create(context) {
        return {
          JSXAttribute(node) {
            const attr = node.name && node.name.name;
            if (attr !== "color" && attr !== "background") return;
            const open = node.parent;
            const tag = open && open.name && open.name.name;
            if (!tag) return;
            const val = node.value;
            if (!val || val.type !== "JSXExpressionContainer") return;
            const expr = val.expression;
            if (!expr || expr.type !== "Identifier") return; // bare ident only
            const name = expr.name;
            if (attr === "color" && TEXT_TAGS.has(tag) && TEXT_ROLE_HINT[name]) {
              context.report({ node, message: `theme-native: prefer ${TEXT_ROLE_HINT[name]} over color={${name}} on <${tag}> (color is an override escape hatch).` });
            } else if (attr === "background" && BOX_TAGS.has(tag) && BOX_SURFACE_HINT[name]) {
              context.report({ node, message: `theme-native: prefer ${BOX_SURFACE_HINT[name]} over background={${name}} on <${tag}> (background is an override escape hatch).` });
            }
          },
        };
      },
    },
  },
};

/** ============================================================================
 *  KEYRING GUARD — enforces the single private-key/mnemonic chokepoint.
 *  ============================================================================
 *  Less's hard requirement: ALL secret access goes through lib/zerodev/keyring.
 *  This rule FAILS the build if any file OTHER than the keyring imports the
 *  secret-bearing primitives or the private-key storage-key constants, so a key
 *  leak cannot even compile. Runs as its OWN rule id (not no-restricted-imports)
 *  so it never clashes with the View/Image/messaging import bans, and applies to
 *  every app source file regardless of which flat-config block matched last.
 *
 *  Banned outside the keyring:
 *    - module '@stage-labs/client/zerodev/derive' (mnemonic -> owner signer)
 *    - names PK_PREFIX / LEGACY_PK_KEY from '@stage-labs/client/accounts/keys'
 *      (the expo-secure-store private-key storage-key constants)
 *    - names privateKeyToAccount / generatePrivateKey / mnemonicToAccount /
 *      hdKeyToAccount from 'viem/accounts' (raw key + mnemonic signers)
 *  The pure, secret-free helpers (normalizePk / privateKeyFromMnemonic /
 *  canExportPrivateKey / isValidMnemonic / normalizeMnemonic) stay importable. */
const SECRET_KEY_CONSTANTS = new Set(["PK_PREFIX", "LEGACY_PK_KEY"]);
const SECRET_VIEM_NAMES = new Set([
  "privateKeyToAccount", "generatePrivateKey", "mnemonicToAccount", "hdKeyToAccount",
]);
const keyringGuardRule = {
  "no-keyring-bypass": {
      meta: {
        type: "problem",
        docs: { description: "only lib/zerodev/keyring may import private-key/mnemonic primitives" },
        schema: [],
      },
      create(context) {
        const file = (context.filename ?? context.getFilename?.() ?? "").replace(/\\/g, "/");
        // The keyring itself is the ONE allowed importer.
        if (file.endsWith("/lib/zerodev/keyring.ts")) return {};
        const fail = (node, what) =>
          context.report({
            node,
            message:
              `Keyring guard: ${what} must only be imported by lib/zerodev/keyring (the single ` +
              `private-key/mnemonic chokepoint). Use the keyring's public API instead.`,
          });
        return {
          ImportDeclaration(node) {
            const src = node.source.value;
            if (src === "@stage-labs/client/zerodev/derive") {
              // deriveOwner / generateWalletMnemonic actually derive from the secret.
              for (const s of node.specifiers) {
                const name = s.imported?.name;
                if (name === "deriveOwner" || name === "generateWalletMnemonic" || name === "ownerAddress") {
                  fail(node, `'${name}' from @stage-labs/client/zerodev/derive`);
                }
              }
            } else if (src === "@stage-labs/client/accounts/keys") {
              for (const s of node.specifiers) {
                if (s.imported && SECRET_KEY_CONSTANTS.has(s.imported.name)) {
                  fail(node, `the private-key storage-key constant '${s.imported.name}'`);
                }
              }
            } else if (src === "viem/accounts") {
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

export default tseslint.config(
  // nodejs-assets/ is the embedded-Node host (runs inside nodejs-mobile, not
  // Hermes). It's node-only JS with its own runtime/globals + an N-API prover;
  // it is excluded from the Metro bundle (see metro.config.js) and built into
  // the native binary separately, so the app's TS/RN lint rules don't apply.
  { ignores: ["node_modules/**", ".expo/**", "dist/**", "nodejs-assets/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "modules/**/*.{ts,tsx}"],
    plugins: { metro: { rules: { ...metroThemeNative.rules, ...keyringGuardRule } } },
    rules: {
      // THEME-NATIVE: WARNING nudging per-call color=/background= palette idents
      // toward the semantic role/surface variant (escape-hatch one-offs never fire).
      "metro/prefer-role-variant": "warn",
      // KEYRING GUARD (ERROR): only lib/zerodev/keyring may import the private-key /
      // mnemonic primitives + storage-key constants. A bypass fails the build.
      "metro/no-keyring-bypass": "error",
      // Strong typing: ban `any`. Use `unknown` + narrowing, real interfaces,
      // generics, or library types instead.
      "@typescript-eslint/no-explicit-any": "error",
      // Typography: three ERRORs keep text sizing on the named Kit scale and
      // the font family inside the Kit content components.
      // (1) No raw numeric `fontSize` anywhere - use a named step
      //     (fontSize('md')/FONT_SIZE.md), or the Kit `size` prop.
      // (2) No `fontSize` in a style/textStyle on the Kit CONTENT components
      //     (Text/Title/Caption) - those MUST size via their `size` prop so the
      //     prop stays authoritative (a style fontSize would override it).
      //     Non-content surfaces (Input/Textarea/markdown) have no size prop and
      //     keep fontSize('name') from the scale.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "Property[key.name='fontSize'] > Literal[value=type(number)]",
          message:
            "use a named Kit size token (Text size=\"sm|md|lg|...\" prop, or fontSize('md')/FONT_SIZE.md from '@metro-labs/kit/tokens') instead of a raw fontSize number.",
        },
        {
          // Kit CONTENT components (Text/Title/Caption) must size via their named
          // `size` PROP (size="md"), never a fontSize in the style/textStyle
          // escape-hatch. A style fontSize would silently override the prop and
          // re-introduce magic sizing, so it is banned outright on these tags.
          // Non-content surfaces (Input/Textarea text style, markdown style maps)
          // have no size prop and keep using fontSize('name') from the scale -
          // they are not matched here.
          selector:
            "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='fontSize']",
          message:
            "Kit Text/Title/Caption must size via the `size` prop (size=\"sm|md|lg|...\"), not a fontSize in style. Remove fontSize from the style and pass size= instead.",
        },
        {
          // (3) Kit CONTENT components apply the Calibre font family INTERNALLY
          //     (chosen by the `weight` prop: normal/medium -> Calibre-Medium,
          //     semibold/bold -> Calibre-Semibold; only those two faces are
          //     bundled). Callers must NOT set fontFamily in the style/textStyle
          //     escape-hatch - it is redundant and re-introduces magic styling.
          //     Use weight= for the face, or variant="mono" for monospace.
          //     Non-content surfaces (Input/Textarea text style, markdown style
          //     maps) have no weight prop and keep an explicit fontFamily - they
          //     are not matched here.
          selector:
            "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='fontFamily']",
          message:
            "Kit Text/Title/Caption apply Calibre internally - do not set fontFamily in style. Use the `weight` prop (normal/medium/semibold/bold) for the face, or variant=\"mono\" for monospace.",
        },
        {
          // (4) Kit CONTENT components take their text colour via the `color`
          //     PROP (color={pal.text}), never a `color` in the style/textStyle
          //     escape-hatch. A style color would bury the colour decision in
          //     styling instead of the component params, so it is banned on
          //     these tags. Non-content surfaces have no color prop and keep an
          //     explicit style color - they are not matched here.
          selector:
            "JSXElement[openingElement.name.name=/^(Text|Title|Caption)$/] JSXAttribute[name.name=/^(style|textStyle)$/] Property[key.name='color']",
          message:
            "Kit Text/Title/Caption must take their colour via the `color` prop (color={pal.text}), not a color in style. Remove color from the style and pass color= instead.",
        },
        {
          // Layout: a `<Box>` is direction-neutral - it must NOT set `flex` or
          // `flexDirection` in its style. Use the Row/Col primitives instead
          // (Row = flexDirection 'row', Col = column = the default View axis),
          // and pass flex-grow via the `flex` PROP (<Col flex={1}>), never a
          // style flex. Only `<Box>` is matched - Row/Col legitimately set
          // flexDirection internally and are exempt.
          selector:
            "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
          message:
            "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
        },
        {
          // Layout params: Box/Row/Col expose first-class props for alignment,
          // distribution, gap, padding, and margin (see kit/src/layout.ts). The
          // raw RN style equivalents must NOT be set inline in the element's own
          // top-level `style={{...}}` - pass the prop so layout stays
          // declarative and the single mapper owns the prop->style translation:
          //   alignItems -> align, justifyContent -> justify, gap -> gap,
          //   padding* -> padding (scalar or {x,y,top,right,bottom,left}),
          //   margin* -> margin (same ChatKit Spacing shape).
          // Scoped to the DIRECT-child style object literal of Box/Row/Col only
          // (same chain as the Box flex rule above), so nested objects and child
          // elements are never matched. Overlapping-side combos that one prop
          // can't express (e.g. padding + paddingTop) may keep a key in style.
          selector:
            "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft)$/]",
          message:
            "Box/Row/Col: use the layout prop instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, padding*->padding (scalar or {x,y,top,right,bottom,left}), margin*->margin (same Spacing shape) (see kit/src/layout.ts).",
        },
        {
          // THEME-NATIVE: Box/Row/Col take their fill via the semantic `surface`
          // variant (surface/raised/sunken/toolbar) or the `background` override
          // prop - NEVER a `backgroundColor` in the element's own style. A style
          // backgroundColor buries the surface decision in styling and dodges the
          // theme-native role resolution, so it is banned on these tags.
          selector:
            "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer ObjectExpression > Property[key.name='backgroundColor']",
          message:
            "Box/Row/Col: use the `surface` variant (surface/raised/sunken/toolbar) or the `background` override prop, not a backgroundColor in style.",
        },
      ],
      // `error`: cap files at 400 lines. Split a file rather than crossing it.
      "max-lines": ["error", { max: 400, skipBlankLines: false, skipComments: false }],
      /** React Native bundles assets via require() — exempt. */
      "@typescript-eslint/no-require-imports": "off",
      // Steer layout containers to the Box/Row/Col primitives instead of raw View.
      // Only `View` is restricted — ScrollView, Pressable, Animated.View, etc. are fine.
      // `error`: all holdouts have been migrated to Box/Row/Col. Where a raw View
      // is genuinely required (onLayout/ref measurement, overlays, MaskedView
      // children, etc.), add a targeted
      // `// eslint-disable-next-line no-restricted-imports` at the import site.
      // ERROR: raw RN primitives that have a Kit equivalent AND are fully
      // migrated in apps/app. View -> Box/Row/Col; Image -> @metro-labs/kit/image.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["View"],
              message:
                "Use Box/Row/Col from '@/components/layout' instead of View for layout containers.",
            },
            {
              name: "react-native",
              importNames: ["Image"],
              message:
                "Import Image from '@metro-labs/kit/image' instead of react-native.",
            },
            {
              name: "react-native",
              importNames: ["TextInput"],
              message:
                "Use Input/Textarea from '@metro-labs/kit/input' | '@metro-labs/kit/textarea' instead of react-native TextInput.",
            },
            {
              name: "react-native",
              importNames: ["ScrollView"],
              message:
                "Use Scroll from '@metro-labs/kit/scroll' instead of react-native ScrollView.",
            },
            {
              name: "react-native",
              importNames: ["Pressable"],
              message:
                "Use Pressable from '@metro-labs/kit/pressable' (or Kit Button) instead of react-native Pressable.",
            },
            {
              name: "react-native",
              importNames: ["FlatList"],
              message:
                "Use FlatList from '@metro-labs/kit/flat-list' instead of react-native FlatList.",
            },
          ],
        },
      ],
      // WARN: raw RN primitives not yet migrated. Text is the last remaining
      // Kit-only-rollout holdout; flip it to ERROR (move to the rule above)
      // once its apps/app file count hits 0. Runs as a separate
      // typescript-eslint rule so ERROR + WARN severities coexist.
      "@typescript-eslint/no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Text"],
              message:
                "Prefer Text from '@metro-labs/kit/text' instead of react-native (Kit-only rollout).",
            },
          ],
        },
      ],
    },
  },
  {
    // Messaging boundary: component code must import the XMTP messaging surface
    // through the `modules/messaging` facade, never by reaching into the
    // `lib/xmtp.*` internals directly. The facade barrel itself and the lib
    // internals are exempt (they aren't under components/). This re-declares the
    // full no-restricted-imports rule (View + the messaging pattern) because a
    // later flat-config block fully overrides an earlier one for matched files.
    files: ["components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["View"],
              message:
                "Use Box/Row/Col from '@/components/layout' instead of View for layout containers.",
            },
            {
              name: "react-native",
              importNames: ["Image"],
              message:
                "Import Image from '@metro-labs/kit/image' instead of react-native.",
            },
            {
              name: "react-native",
              importNames: ["TextInput"],
              message:
                "Use Input/Textarea from '@metro-labs/kit/input' | '@metro-labs/kit/textarea' instead of react-native TextInput.",
            },
          ],
          patterns: [
            {
              // lib/xmtp.* covers the client lifecycle + the xmtp.state caches
              // (feedCache / activeFeedLines / inboxEthCache).
              group: ["**/lib/xmtp", "**/lib/xmtp.*"],
              message:
                "Import messaging via the '@/modules/messaging' facade barrel, not the lib/xmtp.* internals.",
            },
            {
              // The account-switch epoch signal: use useActiveAccount() /
              // AccountManager from the facade, not lib/accountEpoch directly.
              group: ["**/lib/accountEpoch"],
              message:
                "Use useActiveAccount() / AccountManager from '@/modules/messaging', not lib/accountEpoch.",
            },
            {
              // The channels-list cache: import the cache surface from the facade.
              group: ["**/lib/channelsCache"],
              message:
                "Import the channels cache via the '@/modules/messaging' facade barrel, not lib/channelsCache.",
            },
          ],
        },
      ],
    },
  },
  {
    // The Box/Row/Col primitives wrap View — they must be allowed to import it.
    files: ["components/layout/**"],
    rules: {
      "no-restricted-imports": "off",
      "@typescript-eslint/no-restricted-imports": "off",
    },
  },
  {
    // Build-config files (metro.config.js, expo config plugins) are CommonJS —
    // require() is the correct module syntax there, and they aren't app source.
    files: ["**/*.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);

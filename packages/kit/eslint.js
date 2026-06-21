import tseslint from 'typescript-eslint';
import { MAX_LINES, recommended, NO_ESCAPE_HATCHES, commentPlugins, COMMENT_RULES, FUNCTION_SIZE_RULES } from '@stage-labs/config/eslint/base';

function kitVueBlock({ vueParser, vuePlugin, rootDir, project }) {
  return {
    files: ['src/**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        project,
        tsconfigRootDir: rootDir,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: { vue: vuePlugin, '@typescript-eslint': tseslint.plugin, ...commentPlugins },
    rules: {
      ...NO_ESCAPE_HATCHES,
      ...COMMENT_RULES,
      ...vuePlugin.configs['flat/recommended'][0].rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-multiple-template-root': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      'vue/attributes-order': 'off',
      'vue/html-indent': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/attribute-hyphenation': 'off',
      'max-lines': MAX_LINES,
      ...FUNCTION_SIZE_RULES,
    },
  };
}

export function kitEslint(vueOptions) {
  return [
    { ignores: ['node_modules/**', 'dist/**', 'src/heroicons.data.ts'] },
    ...recommended,
    ...(vueOptions ? [kitVueBlock(vueOptions)] : []),
    {
      files: ['src/**/*.{ts,tsx}'],
      plugins: commentPlugins,
      rules: {
        ...NO_ESCAPE_HATCHES,
        ...COMMENT_RULES,
        ...FUNCTION_SIZE_RULES,
        'max-lines': MAX_LINES,
        'no-restricted-syntax': [
          'error',
          {
            selector:
              "JSXOpeningElement[name.name='Box'] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(flex|flexDirection)$/]",
            message:
              "Box must not set flex/flexDirection in style. Use Row (flexDirection:'row') or Col (column, the default), and pass flex-grow via the `flex` prop (<Col flex={1}>) instead of a style flex.",
          },
          {
            selector:
              "JSXOpeningElement[name.name=/^(Box|Row|Col)$/] > JSXAttribute[name.name='style'] > JSXExpressionContainer > ObjectExpression > Property[key.name=/^(alignItems|justifyContent|gap|flex|padding|paddingHorizontal|paddingVertical|paddingTop|paddingRight|paddingBottom|paddingLeft|margin|marginHorizontal|marginVertical|marginTop|marginRight|marginBottom|marginLeft|backgroundColor|borderRadius|width|height|minWidth|minHeight|maxWidth|maxHeight|aspectRatio)$/]",
            message:
              'Box/Row/Col: use the ChatKit layout param instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, flex->flex, padding*->padding, margin*->margin (Spacing), backgroundColor->background, borderRadius->radius (token), width/height/min*/max*/aspectRatio->the same-named sizing param (see ./layout.ts). Props with no ChatKit param (borderWidth/borderColor/position/overflow/opacity/shadow/zIndex/transform) stay in style.',
          },
        ],
      },
    },
    {
      files: [
        'src/button.styles.ts',
        'src/react-native/card.tsx',
        'src/control.styles.ts',
        'src/react-native/list-view.tsx',
        'src/react-native/select.tsx',
      ],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "Property[key.name='fontSize'] > Literal[value=type(number)]",
            message:
              "Use a named Kit size token (FONT_SIZE.md / fontSize('md') from './tokens') instead of a raw fontSize number.",
          },
        ],
      },
    },
    {
      files: ['src/react-native/card.tsx', 'src/react-native/list-view.tsx'],
      rules: {
        'no-restricted-syntax': [
          'error',
          {
            selector: "Property[key.name='fontSize'] > Literal[value=type(number)]",
            message:
              "Use a named Kit size token (FONT_SIZE.md / fontSize('md') from './tokens') instead of a raw fontSize number.",
          },
          {
            selector: 'Literal[value=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/]',
            message:
              "Use a token from './tokens' (schemePalette()/colors/resolveColorToken) instead of a raw hex colour.",
          },
        ],
      },
    },
  ];
}

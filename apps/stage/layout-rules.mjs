const COLUMN_FLEX_KEYS = new Set(['flex', 'flexDirection']);
const KIT_LAYOUT_KEYS = new Set([
  'alignItems',
  'justifyContent',
  'gap',
  'flex',
  'padding',
  'paddingHorizontal',
  'paddingVertical',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'margin',
  'marginHorizontal',
  'marginVertical',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'backgroundColor',
  'borderRadius',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'aspectRatio',
]);
const BOX_TAGS = new Set(['Row', 'Column']);
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const COLUMN_FLEX_MESSAGE =
  'Column must not set flex/flexDirection in style. Use Row for a row, and pass flex-grow via the A2UI `weight` prop (<Column weight={1}>) instead of a style flex.';
const KIT_LAYOUT_MESSAGE =
  'Row/Column: use the Kit layout param instead of a style entry - alignItems->align, justifyContent->justify, gap->gap, flex->flex, padding*->padding, margin*->margin (Spacing), backgroundColor->background, borderRadius->radius (token), width/height/min*/max*/aspectRatio->the same-named sizing param (see ./layout.ts). Props with no Kit param (borderWidth/borderColor/position/overflow/opacity/shadow/zIndex/transform) stay in style.';
const FONT_SIZE_MESSAGE = "Use a named Kit size token (FONT_SIZE.md / fontSize('md') from './tokens') instead of a raw fontSize number.";
const HEX_MESSAGE = "Use a token from './tokens' (schemePalette()/colors/resolveColorToken) instead of a raw hex colour.";

function styleBoxTag(container) {
  const attribute = container?.parent;
  if (container?.type !== 'JSXExpressionContainer' || attribute?.type !== 'JSXAttribute' || attribute.name?.name !== 'style') return null;
  const opening = attribute.parent;
  return opening?.type === 'JSXOpeningElement' ? (opening.name?.name ?? null) : null;
}

function styleTagsAround(object, nested) {
  const tags = new Set();
  for (let node = object.parent; node; node = nested ? node.parent : null) {
    const tag = styleBoxTag(node);
    if (tag !== null) tags.add(tag);
  }
  return tags;
}

function styleKeyRule(tagged, keys, message) {
  return {
    meta: { type: 'suggestion', schema: [{ type: 'object', properties: { nested: { type: 'boolean' } }, additionalProperties: false }] },
    create(context) {
      const nested = context.options[0]?.nested === true;
      return {
        Property(node) {
          if (node.parent?.type !== 'ObjectExpression' || node.key?.type !== 'Identifier') return;
          if (!keys.has(node.key.name)) return;
          const tags = styleTagsAround(node.parent, nested);
          if ([...tags].some((tag) => tagged.has(tag))) context.report({ node, message });
        },
      };
    },
  };
}

const literalRule = (matches, message) => ({
  meta: { type: 'suggestion', schema: [] },
  create(context) {
    return {
      Literal(node) {
        if (matches(node)) context.report({ node, message });
      },
    };
  },
});

export const layoutRules = {
  'no-column-flex-style': styleKeyRule(new Set(['Column']), COLUMN_FLEX_KEYS, COLUMN_FLEX_MESSAGE),
  'kit-layout-style': styleKeyRule(BOX_TAGS, KIT_LAYOUT_KEYS, KIT_LAYOUT_MESSAGE),
  'kit-font-size-token': literalRule(
    (node) =>
      typeof node.value === 'number' &&
      node.parent?.type === 'Property' &&
      node.parent.key?.name === 'fontSize' &&
      node.parent.value === node,
    FONT_SIZE_MESSAGE,
  ),
  'kit-color-token': literalRule((node) => typeof node.value === 'string' && HEX_COLOR.test(node.value), HEX_MESSAGE),
};

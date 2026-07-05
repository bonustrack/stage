export interface LinkifyRule {
  validate(text: string, pos: number): number;
}

export interface LinkifyLike {
  add(schema: string, rule: LinkifyRule): unknown;
}

export const DEEP_LINK_SCHEMAS = ['metro:', 'stage:'] as const;

export const deepLinkRule: LinkifyRule = {
  validate(text: string, pos: number): number {
    const m = /^\/\/[^\s]+/.exec(text.slice(pos));
    return m ? m[0].length : 0;
  },
};

export function registerDeepLinkSchemas(linkify: LinkifyLike): void {
  for (const schema of DEEP_LINK_SCHEMAS) {
    linkify.add(schema, deepLinkRule);
  }
}

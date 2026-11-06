import { STAGE_SCHEMES, trimTrailingPunctuation } from '../routing/stageLinks';

export interface LinkifyRule {
  validate(text: string, pos: number): number;
}

export interface LinkifyLike {
  add(schema: string, rule: LinkifyRule): unknown;
}

const deepLinkRule: LinkifyRule = {
  validate(text: string, pos: number): number {
    const m = /^\/\/[^\s]+/.exec(text.slice(pos));
    return m ? trimTrailingPunctuation(m[0]).length : 0;
  },
};

export function registerDeepLinkSchemas(linkify: LinkifyLike): void {
  for (const scheme of STAGE_SCHEMES) {
    linkify.add(`${scheme}:`, deepLinkRule);
  }
}

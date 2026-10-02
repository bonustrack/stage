import { createRequire } from 'node:module';
import { describe, expect, test } from 'bun:test';
import type { MarkdownIt } from 'react-native-markdown-display';
import { keepIndent, literalStars, taskLists, taskStateOf } from '../components/bubble/markdown.model';
import { registerDeepLinkSchemas } from '@stage-labs/client/text/markdown';
import { stageChannelIdOf } from '@stage-labs/client/xmtp/line';

const createParser = createRequire(import.meta.url)('markdown-it') as (options: object) => MarkdownIt;
const md = createParser({ typographer: false, linkify: true, breaks: true })
  .use(literalStars).use(taskLists).use(keepIndent);
registerDeepLinkSchemas(md.linkify);

function inline(text: string): string {
  return md.renderInline(text);
}

describe('literalStars', () => {
  test('keeps stars that are not emphasis as typed', () => {
    expect(inline('2 * 3 * 4 = 24')).toBe('2 * 3 * 4 = 24');
    expect(inline('2*3*4 = 24')).toBe('2*3*4 = 24');
    expect(inline('arn:aws:iam::*:role/x')).toBe('arn:aws:iam::*:role/x');
    expect(inline('{"Resource":"*"},{"Resource":"arn:aws:iam::*:role/metro-box"}'))
      .toBe('{&quot;Resource&quot;:&quot;*&quot;},{&quot;Resource&quot;:&quot;arn:aws:iam::*:role/metro-box&quot;}');
    expect(inline('src/**/*.ts and lib/**/*.js')).toBe('src/**/*.ts and lib/**/*.js');
  });

  test('still renders real emphasis', () => {
    expect(inline('*italic*, **bold** and ***both***')).toBe('<em>italic</em>, <strong>bold</strong> and <em><strong>both</strong></em>');
    expect(inline('(*a*) "**b**": _c_')).toBe('(<em>a</em>) &quot;<strong>b</strong>&quot;: <em>c</em>');
    expect(inline('**Note:** read *this*.')).toBe('<strong>Note:</strong> read <em>this</em>.');
  });
});

describe('channel URLs in the actual markdown parser', () => {
  const conv = '47bf58a8f56cad829b2263797a7e25e4';
  const urls = [`stage://channel/${conv}`, `stage://xmtp/${conv}`, `https://stage.box/#/channel/${conv}`];

  test('linkifies channel forms with punctuation kept outside the link', () => {
    for (const url of urls) {
      const tokens = md.parseInline(`join (${url}).`, {}).flatMap(t => t.children ?? []);
      const hrefs = tokens.filter(t => t.type === 'link_open').map(t => t.attrGet('href'));
      expect(hrefs).toEqual([url]);
      expect(hrefs.map(href => stageChannelIdOf(href ?? ''))).toEqual([conv]);
      expect(md.renderInline(`join (${url}).`)).toContain('</a>).');
    }
  });

  test('keeps Markdown formatting and does not linkify code', () => {
    for (const url of urls) {
      expect(inline(`**join** [a channel](${url})`)).toContain(`<strong>join</strong> <a href="${url}">a channel</a>`);
      expect(inline(`\`${url}\``)).toBe(`<code>${url}</code>`);
    }
  });
});

describe('taskLists', () => {
  const items = (source: string): { task: string | undefined; text: string }[] => {
    const tokens = md.parse(source, {});
    return tokens.flatMap((token, index) => {
      if (token.type !== 'list_item_open') return [];
      const content = tokens[index + 2]?.content ?? '';
      return [{ task: taskStateOf(Object.fromEntries(token.attrs ?? [])), text: content }];
    });
  };

  test('marks todo and done items and drops the brackets', () => {
    expect(items('- [ ] Task not done\n- [x] Task done\n- [X] Also done')).toEqual([
      { task: 'todo', text: 'Task not done' },
      { task: 'done', text: 'Task done' },
      { task: 'done', text: 'Also done' },
    ]);
  });

  test('leaves plain items and look-alikes alone', () => {
    expect(items('- Bullet\n- [link](https://stage.box)\n- [ ]\n- [y] no')).toEqual([
      { task: undefined, text: 'Bullet' },
      { task: undefined, text: '[link](https://stage.box)' },
      { task: undefined, text: '[ ]' },
      { task: undefined, text: '[y] no' },
    ]);
  });

  test('reads nested and ordered task items', () => {
    expect(items('1. [x] Ship\n   - [ ] Nested')).toEqual([
      { task: 'done', text: 'Ship' },
      { task: 'todo', text: 'Nested' },
    ]);
  });
});

describe('keepIndent', () => {
  const pad = (n: number): string => '\u00a0'.repeat(n);
  const render = (source: string): string => md.render(source);

  test('keeps the indent of lines inside a paragraph', () => {
    expect(render('Plan\n  step one\n    detail')).toBe(`<p>Plan<br>\n${pad(2)}step one<br>\n${pad(4)}detail</p>\n`);
    expect(render('a  \n   b')).toBe(`<p>a<br>\n${pad(3)}b</p>\n`);
  });

  test('keeps the indent of a first line and after a blank line, with no code block', () => {
    expect(render('  first\n\n    second')).toBe(`<p>${pad(2)}first</p>\n<p>${pad(4)}second</p>\n`);
    expect(render('\tTabbed')).toBe(`<p>${pad(4)}Tabbed</p>\n`);
  });

  test('keeps sub-bullets typed with spaces or an ideographic space', () => {
    expect(render('• Parent\n  ◦ Child\n    ◦ Grandchild')).toBe(`<p>• Parent<br>\n${pad(2)}◦ Child<br>\n${pad(4)}◦ Grandchild</p>\n`);
    expect(render('• Parent\n\u3000◦ Child')).toBe('<p>• Parent<br>\n\u3000◦ Child</p>\n');
  });

  test('keeps Markdown lists, nesting and spacing between words', () => {
    expect(render('- a\n  - b\n- c')).toBe('<ul>\n<li>a\n<ul>\n<li>b</li>\n</ul>\n</li>\n<li>c</li>\n</ul>\n');
    expect(render('1. one\n2. two')).toBe('<ol>\n<li>one</li>\n<li>two</li>\n</ol>\n');
    expect(render('- item\n  more')).toBe('<ul>\n<li>item<br>\nmore</li>\n</ul>\n');
    expect(render('a    b')).toBe('<p>a    b</p>\n');
  });

  test('leaves code untouched', () => {
    expect(render('```\n  indented()\n```')).toBe('<pre><code>  indented()\n</code></pre>\n');
    expect(render('use `  x`')).toBe('<p>use <code>  x</code></p>\n');
  });

  test('renders the hourly summary format with its links and sub-bullets', () => {
    const conv = 'fda13c194b1bc848b43e60805a57a10b';
    const html = render(`Follow-up 18:15\nWaiting on you\n• https://stage.box/#/channel/${conv}\n  ◦ Install the new dev APK and test\nOther open issues: no change since 17:15`);
    expect(html).toBe(`<p>Follow-up 18:15<br>\nWaiting on you<br>\n• <a href="https://stage.box/#/channel/${conv}">https://stage.box/#/channel/${conv}</a><br>\n${pad(2)}◦ Install the new dev APK and test<br>\nOther open issues: no change since 17:15</p>\n`);
  });
});

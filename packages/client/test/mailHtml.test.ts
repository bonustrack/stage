import { describe, expect, test } from 'bun:test';
import { hasRemoteImages, mailHtmlBlocks, mailTextBlocks, type MailBlock } from '../src/mail/mailHtml';

const plain = (blocks: MailBlock[]): string[] =>
  blocks.map((block) => (block.type === 'text' ? block.spans.map((span) => span.text).join('') : `[${block.type}]`));

describe('mailHtmlBlocks', () => {
  test('drops scripts, styles, head, hidden preheaders and every attribute but safe links', () => {
    const blocks = mailHtmlBlocks([
      '<html><head><title>T</title><style>p { color: red }</style></head><body>',
      '<div style="display:none">preheader</div><span hidden>secret</span>',
      '<script>alert(1)</script><p onclick="steal()" style="color:red">Hi <a href="https://ok.example/x">there</a></p>',
      '<p><a href="javascript:alert(1)">bad</a> <a href=" java\tscript:x">tab</a> <a href="mailto:a@b.c">mail</a></p>',
      '<iframe src="https://evil.example"></iframe><object><param name=x>obj</object><svg><text>svg</text></svg>',
      '</body></html>',
    ].join(''));
    expect(plain(blocks)).toEqual(['Hi there', 'bad tab mail']);
    const spans = blocks.flatMap((block) => (block.type === 'text' ? block.spans : []));
    expect(spans.filter((span) => span.href !== undefined).map((span) => span.href)).toEqual(['https://ok.example/x', 'mailto:a@b.c']);
    expect(JSON.stringify(blocks)).not.toContain('steal');
  });

  test('keeps structure: headings, bold, lists, quotes, rules and line breaks', () => {
    const blocks = mailHtmlBlocks(
      '<h2>Title</h2><p>One<br>two <strong>bold</strong> <em>it</em></p><ul><li>a</li><li>b</li></ul>'
      + '<ol start="4"><li>d</li></ol><blockquote><p>quoted</p></blockquote><hr><pre>  x  y</pre>',
    );
    expect(plain(blocks)).toEqual(['Title', 'One\ntwo bold it', 'a', 'b', 'd', 'quoted', '[rule]', 'x  y']);
    const text = blocks.filter((block) => block.type === 'text');
    expect(text.map((block) => [block.heading, block.bullet, block.quote, block.pre])).toEqual([
      [2, null, 0, false], [0, null, 0, false], [0, '•', 0, false], [0, '•', 0, false], [0, '4.', 0, false],
      [0, null, 1, false], [0, null, 0, true],
    ]);
    expect(text[1]?.spans.find((span) => span.text === 'bold')?.bold).toBe(true);
    expect(text[1]?.spans.find((span) => span.text === 'it')?.italic).toBe(true);
  });

  test('marks remote images, resolves cid images and drops tracking pixels and unsafe sources', () => {
    const blocks = mailHtmlBlocks(
      '<img src="https://img.example/a.png" width="600" height="300" alt="Banner">'
      + '<img src="cid:logo%40x"><img src="https://t.example/p.gif" width="1" height="1">'
      + '<img src="javascript:x"><img src="data:image/svg+xml;base64,AAA"><img src="data:image/png;base64,AAA">',
      new Map([['logo@x', 'data:image/png;base64,BBB']]),
    );
    expect(blocks).toEqual([
      { type: 'image', src: 'https://img.example/a.png', remote: true, alt: 'Banner', width: 600, height: 300 },
      { type: 'image', src: 'data:image/png;base64,BBB', remote: false, alt: '', width: null, height: null },
      { type: 'image', src: 'data:image/png;base64,AAA', remote: false, alt: '', width: null, height: null },
    ]);
    expect(hasRemoteImages(blocks)).toBe(true);
    expect(hasRemoteImages(blocks.slice(1))).toBe(false);
  });

  test('decodes entities and strips invisible padding', () => {
    expect(plain(mailHtmlBlocks('<p>Tom &amp; Jerry &eacute;&Eacute; &#8364;&#x41; &nbsp;&zwnj;&#847;x &unknown; AT&T</p>')))
      .toEqual(['Tom & Jerry éÉ €A \u00a0x &unknown; AT&T']);
  });

  test('stays linear on hostile markup', () => {
    const started = Date.now();
    mailHtmlBlocks('<a "'.repeat(50_000) + '<div '.repeat(50_000) + '<!--'.repeat(10_000));
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('mailTextBlocks', () => {
  test('splits paragraphs, keeps line breaks and links bare URLs', () => {
    const blocks = mailTextBlocks('Hi,\r\nsee https://example.com/a.\r\n\r\n\r\nBye');
    expect(plain(blocks)).toEqual(['Hi,\nsee https://example.com/a.', 'Bye']);
    const first = blocks[0];
    expect(first?.type === 'text' ? first.spans.map((span) => span.href ?? null) : []).toEqual([null, 'https://example.com/a', null]);
  });
});

import type { Story } from '../gallery/story';
import { Markdown, type MarkdownProps } from '../src/react-native/markdown';
import { bool, color, text, useDark } from './_controls';

export default { title: 'Markdown' };

const SAMPLE = `# Release notes

Stage **2.4** ships *faster sync*, ~~legacy exports~~ are gone, and the \`stage\` CLI learned a new trick. Read the [full changelog](https://stage.box).

## Highlights

1. Sync starts in under a second
2. Group channels support **threads**
3. Agents can be added as contacts

### Things to try

- Type \`/poll\` in any channel
- Pin a message with a long press
  - Nested items indent
  - As deep as you like
- Drag files onto the composer

> Privacy is not a feature.
> It is the default.

\`\`\`ts
const client = await createClient({ env: 'production' });
await client.conversations.sync();
\`\`\`

| Platform | Status | Notes |
| --- | --- | --- |
| iOS | Beta | TestFlight |
| Android | Live | Play Store |
| Web | Live | stage.box |

---

Questions? Ping **@support** or reply here.`;

export const Controls: Story<MarkdownProps> = (args) => <Markdown {...args} dark={useDark()} />;
Controls.args = { value: SAMPLE, streaming: false };
Controls.argTypes = { value: text, streaming: bool, color, linkColor: color };

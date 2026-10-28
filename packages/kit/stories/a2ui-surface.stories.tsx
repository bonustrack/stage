import { useMemo, useState } from 'react';
import type { Story } from '../gallery/story';
import { createA2uiClient } from '../src/a2ui/client';
import type { JsonObject, JsonValue, RendererMessage } from '../src/a2ui/protocol';
import { MEDIA_RENDERERS } from '../src/react-native/a2ui-media';
import { A2uiSurface } from '../src/react-native/a2ui-surface';
import { Column } from '../src/react-native/column';
import { Text } from '../src/react-native/text';
import contactForm from '../test/a2ui/cases/contact_form_example.jsonl?raw';
import { BASIC_GALLERY, DASHBOARD_BLOCK, KANBAN, PAGES, PAYMENT_REQUEST, THEME_PICKER } from './a2ui-samples';

export default { title: 'A2UI Surface' };

function useSurface(messages: string | JsonValue[]): { client: ReturnType<typeof createA2uiClient>; log: string[] } {
  const [log, setLog] = useState<string[]>([]);
  const client = useMemo(() => {
    const created = createA2uiClient({
      send: (message: RendererMessage, metadata) => {
        setLog((prev) => [JSON.stringify(metadata === undefined ? message : { message, metadata }), ...prev].slice(0, 6));
      },
      onDiagnostic: (d) => { setLog((prev) => [`diagnostic ${d.code}: ${d.message}`, ...prev].slice(0, 6)); },
      openUrl: (url) => { window.open(url, '_blank', 'noopener,noreferrer'); },
    });
    if (typeof messages === 'string') created.receive(messages);
    else for (const message of messages) created.receive(message);
    return created;
  }, [messages]);
  return { client, log };
}

function Playground({ messages, surfaceId }: { messages: string | JsonValue[]; surfaceId: string }): React.ReactElement {
  const { client, log } = useSurface(messages);
  return (
    <Column gap={16} maxWidth={520}>
      <A2uiSurface client={client} surfaceId={surfaceId} renderers={MEDIA_RENDERERS} />
      <Column gap={4}>
        <Text size="sm" color="secondary">Renderer to agent</Text>
        {log.length === 0 ? <Text size="xs" color="muted">Interact with the surface to see messages.</Text> : null}
        {log.map((line, i) => <Text key={`${i}:${line}`} size="2xs" fontFamily="mono" selectable>{line}</Text>)}
      </Column>
    </Column>
  );
}

export const KitPaymentRequest: Story = () => <Playground messages={PAYMENT_REQUEST} surfaceId="payment_request" />;

export const KitKanban: Story = () => <Playground messages={KANBAN} surfaceId="kanban" />;

export const KitThemePicker: Story = () => <Playground messages={THEME_PICKER} surfaceId="theme_picker" />;

export const KitPages: Story = () => <Playground messages={PAGES} surfaceId="pages" />;

export const KitDashboardBlock: Story = () => <Playground messages={DASHBOARD_BLOCK} surfaceId="dashboard_block" />;

export const BasicCatalog: Story = () => <Playground messages={BASIC_GALLERY} surfaceId="basic_gallery" />;

const CONTACT_FORM = contactForm.split('\n').filter((line) => line.trim() !== '' && !line.includes('deleteSurface')).join('\n');

export const OfficialContactForm: Story = () => <Playground messages={CONTACT_FORM} surfaceId="contact_form_1" />;

export const Controls: Story<{ json: string }> = ({ json }) => {
  const parsed = useMemo((): JsonObject[] => {
    try {
      const value = JSON.parse(json) as JsonValue;
      return Array.isArray(value) ? (value as JsonObject[]) : [];
    } catch {
      return [];
    }
  }, [json]);
  return <Playground messages={parsed} surfaceId="playground" />;
};
Controls.args = {
  json: JSON.stringify([
    { version: 'v1.0', createSurface: { surfaceId: 'playground', catalogId: 'https://kit.stage.box/a2ui/v1_0/catalog.json', components: [{ id: 'root', component: 'Text', text: 'Edit the **JSON** control.', size: 'xl' }] } },
  ]),
};
Controls.argTypes = { json: { control: { type: 'text' } } };

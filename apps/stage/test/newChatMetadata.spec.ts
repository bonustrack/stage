import { describe, expect, test } from 'bun:test';
import { createGroupWith } from '@stage-labs/client/xmtp/groups';
import { resolveHref } from 'expo-router/build/link/href';
import {
  groupedChatMetadata, memberChatMetadata, newChatAppData, newChatMetadata, newChatParams, NO_NEW_CHAT_METADATA,
} from '../components/home/newChatMetadata.model';

const alice = `0x${'1'.repeat(40)}`;
const bob = `0x${'2'.repeat(40)}`;

describe('grouped new chat metadata', () => {
  test('keeps category and status display casing from list and board headers', () => {
    expect(groupedChatMetadata('category', 'category:stage', 'Stage').category).toBe('Stage');
    expect(groupedChatMetadata('status', 'status:In progress', 'In progress').status).toBe('In progress');
  });

  test('preserves labels without turning status into a label', () => {
    expect(groupedChatMetadata('label', 'label:Urgent', 'Urgent').labels).toEqual(['Urgent']);
    expect(groupedChatMetadata('status', 'status:Done', 'Done').labels).toEqual([]);
  });

  test('reads assignees from their address key, never their display name', () => {
    expect(groupedChatMetadata('assignee', `assignee:${alice}`, 'Alice').assigned).toEqual([alice]);
    expect(groupedChatMetadata('assignee', 'assignee:not-an-address', 'Alice').assigned).toEqual([]);
  });

  test('unset buckets and the direct-message section produce no metadata', () => {
    for (const by of ['category', 'status', 'label', 'assignee'] as const) {
      for (const key of ['none', 'dm', `${by}:`]) {
        expect(newChatAppData(groupedChatMetadata(by, key, `No ${by}`))).toBeUndefined();
      }
    }
  });

  test('a real value named like an unset bucket is still valid', () => {
    expect(groupedChatMetadata('category', 'category:no category', 'No category').category).toBe('No category');
  });

  test('route metadata is normalized, bounded and deduplicated', () => {
    expect(newChatMetadata({ category: '  Stage  ', status: ' In   progress ', labels: ['UI', 'ui', ''], assigned: [alice, alice, 'Alice'] }))
      .toEqual({ category: 'Stage', status: 'In progress', labels: ['UI'], assigned: [alice] });
    expect(newChatMetadata({ category: ['Stage', 'Metro'], status: 'a'.repeat(40) }).category).toBeNull();
    expect(newChatMetadata({ status: 'a'.repeat(40) }).status).toHaveLength(24);
  });

  test('supports a single label or assignee in route params', () => {
    expect(newChatMetadata({ labels: 'UI', assigned: alice })).toEqual({ ...NO_NEW_CHAT_METADATA, labels: ['UI'], assigned: [alice] });
  });

  test('round trips all selected metadata through routing and one appData payload', () => {
    const metadata = { category: 'Stage', status: 'To-do', labels: ['UI', 'Mobile'], assigned: [alice] };
    expect(newChatMetadata(newChatParams(metadata))).toEqual(metadata);
    expect(JSON.parse(newChatAppData(metadata) ?? '')).toEqual({ v: 1, ...metadata });
  });

  test('preserves arrays and literal commas through the real router href serializer', () => {
    const metadata = { category: 'Stage', status: 'To-do', labels: ['UI,Mobile', 'Design'], assigned: [alice, bob] };
    const href = resolveHref({ pathname: '/new', params: newChatParams(metadata) });
    const params = Object.fromEntries(new URL(href, 'https://stage.box').searchParams);
    expect(newChatMetadata(params)).toEqual(metadata);
  });

  test('ordinary and cleared new chat have no appData', () => {
    expect(newChatMetadata({})).toEqual(NO_NEW_CHAT_METADATA);
    expect(newChatMetadata(newChatParams(NO_NEW_CHAT_METADATA))).toEqual(NO_NEW_CHAT_METADATA);
    expect(newChatAppData(NO_NEW_CHAT_METADATA)).toBeUndefined();
  });

  test('new route values explicitly clear previous fields in a reused tab route', () => {
    const previous = newChatParams({ category: 'Stage', status: 'To-do', labels: ['UI'], assigned: [alice] });
    expect(newChatMetadata({ ...previous, ...newChatParams(NO_NEW_CHAT_METADATA) })).toEqual(NO_NEW_CHAT_METADATA);
    expect(newChatMetadata({ ...previous, ...newChatParams(groupedChatMetadata('label', 'label:Mobile', 'Mobile')) }))
      .toEqual({ ...NO_NEW_CHAT_METADATA, labels: ['Mobile'] });
  });

  test('only selected members or self can remain assigned', () => {
    const metadata = { ...NO_NEW_CHAT_METADATA, assigned: [alice, bob] };
    expect(memberChatMetadata(metadata, [alice.toUpperCase()], null).assigned).toEqual([alice]);
    expect(memberChatMetadata(metadata, [], bob).assigned).toEqual([bob]);
    expect(memberChatMetadata(metadata, [], null).assigned).toEqual([]);
  });

  test('sends metadata once as part of channel creation with no update step', async () => {
    const appData = newChatAppData({ ...NO_NEW_CHAT_METADATA, category: 'Stage', status: 'To-do' });
    const calls: { members: string[]; appData: string | undefined }[] = [];
    const result = await createGroupWith([alice], id => `test:${id}`, async members => {
      calls.push({ members, appData });
      return { id: 'synthetic' };
    }, async () => 'synthetic-inbox');
    expect(result).toEqual({ line: 'test:synthetic', id: 'synthetic' });
    expect(calls).toEqual([{ members: [alice], appData: '{"v":1,"category":"Stage","status":"To-do"}' }]);
  });
});

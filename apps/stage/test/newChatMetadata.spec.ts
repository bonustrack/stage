import { describe, expect, test } from 'bun:test';
import { createGroupWith } from '@stage-labs/client/xmtp/groups';
import { resolveHref } from 'expo-router/build/link/href';
import {
  groupedChatMetadata, memberChatMetadata, newChatAppData, newChatMetadata, newChatParams, NO_NEW_CHAT_FIELDS,
  NO_NEW_CHAT_METADATA, parseNewChatFields, renamedNewChatFields,
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
    expect(groupedChatMetadata('category', 'category:no project', 'No project').category).toBe('No project');
  });

  test('the route carries status, labels and assignees, normalized and deduplicated, but never the project', () => {
    expect(newChatMetadata({ category: 'Stage', status: ' To-do ', labels: ['UI', 'ui', ''], assigned: [alice, alice, 'Alice'] }))
      .toEqual({ ...NO_NEW_CHAT_METADATA, status: 'To-do', labels: ['UI'], assigned: [alice] });
    expect(newChatParams({ category: 'Stage', status: 'To-do', labels: ['UI'], assigned: [alice] }))
      .toEqual({ status: 'To-do', labels: 'UI', assigned: alice });
  });

  test('supports a single label or assignee in route params', () => {
    expect(newChatMetadata({ labels: 'UI', assigned: alice })).toEqual({ ...NO_NEW_CHAT_METADATA, labels: ['UI'], assigned: [alice] });
  });

  test('round trips status, labels and assignees through routing and sends everything in one appData payload', () => {
    const metadata = { category: 'Stage', status: 'To-do', labels: ['UI', 'Mobile'], assigned: [alice] };
    expect(newChatMetadata(newChatParams(metadata))).toEqual({ ...metadata, category: null });
    expect(JSON.parse(newChatAppData(metadata) ?? '')).toEqual({ v: 1, ...metadata });
  });

  test('preserves arrays and literal commas through the real router href serializer', () => {
    const metadata = { ...NO_NEW_CHAT_METADATA, status: 'In review', labels: ['UI,Mobile', 'Design'], assigned: [alice, bob] };
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

describe('project for the next new chat', () => {
  test('a status header opens the new chat with its status and other headers with none', () => {
    expect(newChatMetadata(newChatParams(groupedChatMetadata('status', 'status:In review', 'In review'))).status).toBe('In review');
    expect(newChatMetadata(newChatParams(groupedChatMetadata('status', 'status:', 'No status'))).status).toBeNull();
    expect(newChatMetadata(newChatParams(groupedChatMetadata('category', 'category:metro', 'Metro'))).status).toBeNull();
  });

  test('the remembered project reaches the new channel appData', () => {
    const metadata = { ...newChatMetadata({ labels: 'UI' }), category: 'Stage', status: null };
    expect(newChatAppData(metadata)).toBe('{"v":1,"category":"Stage","labels":["UI"]}');
  });

  test('a renamed or deleted board column updates the remembered project only when it matches', () => {
    const fields = { category: 'FDE' };
    expect(renamedNewChatFields(fields, 'fde', 'Clients')).toEqual({ category: 'Clients' });
    expect(renamedNewChatFields(fields, 'FDE', null)).toEqual({ category: null });
    expect(renamedNewChatFields(fields, 'Metro', 'Ops')).toBe(fields);
    expect(renamedNewChatFields(NO_NEW_CHAT_FIELDS, 'FDE', 'Clients')).toBe(NO_NEW_CHAT_FIELDS);
  });

  test('the stored project round trips, is normalized like channel fields and drops an old remembered status', () => {
    expect(parseNewChatFields(JSON.stringify({ category: 'Stage' }))).toEqual({ category: 'Stage' });
    expect(parseNewChatFields(JSON.stringify({ category: 'Stage', status: 'To-do' }))).toEqual({ category: 'Stage' });
    expect(parseNewChatFields(JSON.stringify({ category: '  Stage ' }))).toEqual({ category: 'Stage' });
    expect(parseNewChatFields(JSON.stringify({ category: 'a'.repeat(40) }))).toEqual({ category: 'a'.repeat(24) });
    expect(parseNewChatFields('{}')).toEqual(NO_NEW_CHAT_FIELDS);
    expect(parseNewChatFields(JSON.stringify({ category: 7, status: '' }))).toEqual(NO_NEW_CHAT_FIELDS);
    expect(parseNewChatFields('not json')).toBeUndefined();
    expect(parseNewChatFields('[]')).toBeUndefined();
  });
});

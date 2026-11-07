import { useEffect, useReducer, useRef, useState } from 'react';
import type { GroupKey } from '@stage-labs/client/xmtp/sync/homeView';
import { errorMessage } from '@stage-labs/client/errors';
import { getAccountEpoch } from '../../../lib/accountEpoch';
import { createGroup } from '../../../lib/xmtp.groups';
import { schedulePushTopicRefresh } from '../../../lib/pushRegister';
import { useActiveAccountRecord } from '../../../lib/messaging/account';
import { boardChannelCreations, boardChannelDraft, boardChannelNameProblem, type BoardPendingChannel } from './BoardNewChannel.model';
import type { BoardColumn } from './BoardScreen.model';
import type { CachedRow } from '../../../lib/cachedRows.model';

interface CreationProps {
  by: GroupKey;
  column: BoardColumn<CachedRow>;
  rowIds: ReadonlySet<string>;
  onClose: () => void;
}

export function useBoardChannelCreation({ by, column, rowIds, onClose }: CreationProps) {
  const account = useActiveAccountRecord();
  const [name, setName] = useState('');
  const nameRef = useRef('');
  const nextId = useRef(0);
  const running = useRef(new Set<number>());
  const epoch = useRef(getAccountEpoch()).current;
  const [state, dispatch] = useReducer(boardChannelCreations, { pending: [], createdIds: new Set<string>() });
  const problem = boardChannelNameProblem(name);
  useEffect(() => {
    if (state.pending.length > 0) dispatch({ type: 'confirm', ids: rowIds });
  }, [rowIds, state.pending]);
  const changeName = (value: string): void => {
    nameRef.current = value;
    setName(value);
  };
  const run = async (pending: BoardPendingChannel): Promise<void> => {
    if (running.current.has(pending.id) || getAccountEpoch() !== epoch) return;
    running.current.add(pending.id);
    schedulePushTopicRefresh(10_000);
    try {
      const created = await createGroup(pending.members, pending.appData, pending.name);
      if (getAccountEpoch() !== epoch) return;
      dispatch({ type: 'created', id: pending.id, convId: created.id });
    } catch (err) {
      if (getAccountEpoch() === epoch) dispatch({ type: 'failed', id: pending.id, error: errorMessage(err) });
    } finally {
      running.current.delete(pending.id);
    }
  };
  const submit = (): void => {
    if (account === null || boardChannelNameProblem(nameRef.current) !== null || getAccountEpoch() !== epoch) return;
    const draft = boardChannelDraft(by, column.key, column.label, nameRef.current, account.address);
    nextId.current += 1;
    const pending = { ...draft, id: nextId.current, existingIds: rowIds, convId: null, error: null };
    changeName('');
    dispatch({ type: 'submit', pending });
    onClose();
    void run(pending);
  };
  const retry = (pending: BoardPendingChannel): void => {
    if (pending.error === null || running.current.has(pending.id) || getAccountEpoch() !== epoch) return;
    dispatch({ type: 'retry', id: pending.id, existingIds: rowIds });
    void run(pending);
  };
  return {
    name,
    changeName,
    editorKey: nextId.current,
    state,
    pending: state.pending.filter((p) => p.convId === null || !rowIds.has(p.convId)),
    note: name.trim() === '' ? null : problem,
    disabled: account === null || problem !== null,
    close: (): void => {
      changeName('');
      onClose();
    },
    submit,
    retry,
    dismiss: (id: number): void => {
      dispatch({ type: 'dismiss', id });
    },
  };
}

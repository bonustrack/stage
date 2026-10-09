import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { shortAddress } from '@stage-labs/client/identity/format';
import { IconAudio } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconAudio';
import { IconFileBend } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFileBend';
import { IconFileText } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFileText';
import { IconFolder1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFolder1';
import { IconImages1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconImages1';
import { IconVideo } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconVideo';
import { Box, Col, Row, LIST_TOP_GAP, PAGE_GUTTER, VirtualList } from '../layout';
import { RetryNotice } from '../chrome/RetryNotice';
import { StackHeader } from '../chrome/StackHeader';
import { LabelChip } from '../LabelChip';
import { SearchTopnavBar } from '../SearchTopnavBar';
import { capabilities } from '../../lib/capabilities';
import { report } from '../../lib/errorPolicy';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useOwnDeletes } from '../../lib/ownDeletes';
import { getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { SETTINGS_ROUTE } from '../../lib/routes';
import { useSafeAreaInsets } from '../../lib/safeArea';
import {
  forgetStorageFile, retryStorage, storageChatOf, storageFileGone, useStorage, type StorageState,
} from '../../lib/storage';
import { fileKey, type StoredFile } from '../../lib/storageIndex.model';
import { usePalette } from '../../lib/theme';
import { FileUnavailableError, openStoredFile } from './storageOpen';
import {
  STORAGE_FILTERS, chatLabelOf, storageRows, storageStatusLabel, type StorageFilter, type StorageKind, type StorageRow,
} from './StorageScreen.model';

const KIND_ICONS: Readonly<Record<StorageKind, typeof IconFileBend>> = {
  image: IconImages1, document: IconFileText, audio: IconAudio, video: IconVideo, other: IconFileBend,
};
const ROW_PADDING = { paddingTop: 10, paddingBottom: 10, paddingLeft: PAGE_GUTTER, paddingRight: PAGE_GUTTER };
const CHAT_STALE_MS = 5 * 60_000;
const UNAVAILABLE = 'No longer available';
const OPEN_FAILED = 'Could not open this file. It may no longer be available.';

function useChatLabel(convId: string): string {
  const epoch = useAccountEpoch();
  const { data } = useQuery({
    queryKey: ['storageChat', epoch, convId], queryFn: () => storageChatOf(convId), staleTime: CHAT_STALE_MS, retry: false,
  });
  const peer = data?.peerAddress ?? null;
  usePeerProfiles([peer]);
  return chatLabelOf(data, peer === null ? undefined : getPeerName(peer), shortAddress);
}

function useGoneCheck(messageId: string): void {
  const epoch = useAccountEpoch();
  const { data: gone } = useQuery({
    queryKey: ['storageGone', epoch, messageId], queryFn: () => storageFileGone(messageId), staleTime: Infinity, retry: false,
  });
  useEffect(() => { if (gone === true) forgetStorageFile(messageId); }, [gone, messageId]);
}

function FileRow({ row, opening, unavailable, onOpen }: {
  row: StorageRow; opening: boolean; unavailable: boolean; onOpen: (file: StoredFile) => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const { text: fg } = usePalette();
  const chat = useChatLabel(row.file.convId);
  useGoneCheck(row.file.messageId);
  const detail = unavailable ? UNAVAILABLE : [row.detail, chat].filter(Boolean).join(' · ');
  return (
    <ListViewItem align="center" gap={12} dark={dark} padding={ROW_PADDING} onPress={() => { onOpen(row.file); }}>
      <Box width={44} height={44} radius="md" align="center" justify="center" surface="raised">
        {opening ? <Spinner size={20} color={fg} /> : <Glyph icon={KIND_ICONS[row.kind]} size={24} color={fg} />}
      </Box>
      <Col flex={1} minWidth={0} gap={2}>
        <Text value={row.file.name} size="xs" weight="semibold" color="link" truncate />
        <Text value={detail} size="2xs" color={unavailable ? 'danger' : 'secondary'} truncate />
      </Col>
    </ListViewItem>
  );
}

function TypeChips({ filter, onFilter }: { filter: StorageFilter; onFilter: (filter: StorageFilter) => void }): React.ReactElement {
  return (
    <Scroll horizontal showsHorizontalScrollIndicator={false}>
      <Row gap={8} padding={{ x: PAGE_GUTTER }}>
        {STORAGE_FILTERS.map(option => (
          <Pressable key={option.value} accessibilityRole="button" onPress={() => { onFilter(option.value); }}>
            <LabelChip label={option.label} selected={option.value === filter} />
          </Pressable>
        ))}
      </Row>
    </Scroll>
  );
}

function StatusLine({ storage, hidden }: { storage: StorageState; hidden: ReadonlySet<string> }): React.ReactElement | null {
  const { sub } = usePalette();
  const text = storageStatusLabel(storage, hidden);
  if (text === '') return null;
  return (
    <Row align="center" gap={8} padding={{ x: PAGE_GUTTER }}>
      {storage.scanning ? <Spinner size={14} color={sub} /> : null}
      <Caption value={text} color="secondary" />
    </Row>
  );
}

function ListHeader({ query, onQuery, filter, onFilter, storage, hidden }: {
  query: string; onQuery: (query: string) => void; filter: StorageFilter; onFilter: (filter: StorageFilter) => void;
  storage: StorageState; hidden: ReadonlySet<string>;
}): React.ReactElement {
  const { link: head, sub, border } = usePalette();
  return (
    <Col gap={12} padding={{ top: LIST_TOP_GAP, bottom: 8 }}>
      <SearchTopnavBar field inline persistent query={query} setQuery={onQuery} onClose={() => { onQuery(''); }}
        head={head} sub={sub} border={border} placeholder="Search files" />
      <TypeChips filter={filter} onFilter={onFilter} />
      <StatusLine storage={storage} hidden={hidden} />
    </Col>
  );
}

function EmptyList({ storage, filtered }: { storage: StorageState; filtered: boolean }): React.ReactElement | null {
  const { sub } = usePalette();
  if (storage.failed && !storage.scanning && storage.files.length === 0) {
    return <RetryNotice message="Could not read your chats. Check your connection and try again." onRetry={retryStorage} />;
  }
  if (!storage.loaded || (storage.firstScan && storage.files.length === 0)) {
    return <Row justify="center" padding={{ y: 48 }}><Spinner size={24} color={sub} /></Row>;
  }
  const title = filtered ? 'No matching files' : 'No files yet';
  const note = filtered ? 'Try another name or type.' : 'Files you send in your chats show up here.';
  return (
    <Col align="center" gap={6} padding={{ x: PAGE_GUTTER, top: 48 }}>
      <Glyph icon={IconFolder1} size={32} color={sub} />
      <Text value={title} size="xs" weight="semibold" color="link" textAlign="center" />
      <Text value={note} size="2xs" color="secondary" textAlign="center" />
    </Col>
  );
}

function Footnote({ show }: { show: boolean }): React.ReactElement | null {
  if (!show) return null;
  return (
    <Caption color="secondary" style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 16 }}
      value="Found on this device in the messages you sent. Files stay encrypted, and only your chats hold their keys." />
  );
}

function withoutKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  return keys.has(key) ? new Set([...keys].filter(k => k !== key)) : keys;
}

function useFileOpener(): { opening: string | null; unavailable: ReadonlySet<string>; open: (file: StoredFile) => void } {
  const busy = useRef(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<ReadonlySet<string>>(new Set());
  const open = useCallback((file: StoredFile): void => {
    if (busy.current) return;
    busy.current = true;
    const key = fileKey(file);
    setOpening(key);
    openStoredFile(file)
      .then(() => { setUnavailable(prev => withoutKey(prev, key)); })
      .catch((err: unknown) => {
        if (!(err instanceof FileUnavailableError)) report('storage.openFile', err);
        setUnavailable(prev => new Set(prev).add(key));
        capabilities.toast(OPEN_FAILED);
      })
      .finally(() => {
        busy.current = false;
        setOpening(null);
      });
  }, []);
  return { opening, unavailable, open };
}

function StorageBody(): React.ReactElement {
  const storage = useStorage();
  const hidden = useOwnDeletes();
  const insets = useSafeAreaInsets();
  const { bg } = usePalette();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StorageFilter>('all');
  const { opening, unavailable, open } = useFileOpener();
  const rows = useMemo(() => storageRows(storage.files, { query, filter, hidden }, Date.now()), [storage.files, query, filter, hidden]);
  const renderItem = useCallback(({ item }: { item: StorageRow }): React.ReactElement => (
    <FileRow row={item} opening={opening === item.key} unavailable={unavailable.has(item.key)} onOpen={open} />
  ), [opening, unavailable, open]);
  return (
    <Col surface="surface" flex={1}>
      <StackHeader title="Storage" backTo={SETTINGS_ROUTE} />
      <VirtualList
        data={rows}
        keyExtractor={row => row.key}
        renderItem={renderItem}
        extraData={`${opening ?? ''}:${unavailable.size}`}
        estimatedItemSize={64}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: bg }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 + insets.bottom }}
        ListHeaderComponent={<ListHeader query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} storage={storage} hidden={hidden} />}
        ListEmptyComponent={<EmptyList storage={storage} filtered={query.trim() !== '' || filter !== 'all'} />}
        ListFooterComponent={<Footnote show={rows.length > 0} />}
      />
    </Col>
  );
}

export function StorageScreen(): React.ReactElement {
  return <StorageBody key={useAccountEpoch()} />;
}

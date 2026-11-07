import { memo, useCallback } from 'react';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { MessagingSetupBanner } from './MessagingSetupBanner';
import { ChannelRow } from '../chatRow/ChannelRow';
import { chatRowProps, rowMenuOpener, type RowMenu } from '../chatRow/chatRow';
import type { ChannelFields } from '../../lib/channelFields.model';
import { DragCell, PinnedRow, SectionHandle, type HomeDrag } from './listDrag';
import { useSortableActive } from '@stage-labs/kit/react-native/sortable';
import { GroupHeader, useGroupHover } from './GroupHeader';
import { isGroupHeader, type HomeListItem } from './groups.model';
import { toggleGroupCollapsed } from '../../lib/channelGroups';
import { resetXmtpDatabase } from '../../lib/deviceAccount';
import { getDraft } from '../../lib/drafts';
import { conversationLinkOf, isActiveConversationPath } from '../../lib/links';
import type { CachedRow as RowT } from '../../lib/cachedRows.model';
import { DANGER } from '../../lib/theme';
import { capabilities } from '../../lib/capabilities';
import { Button } from '@stage-labs/kit/react-native/button';
import { rowDataSet } from './rowArrows';
import { Column } from '../layout';

interface ChannelRowItemProps {
  item: RowT;
  router: { push: (to: { pathname: string; params: { convId: string } }) => void };
  setRowMenu: (m: RowMenu) => void;
  query?: string;
  profilesVersion: number;
  pinned: boolean;
  draftText: string;
  active: boolean;
  current: boolean;
  drag: HomeDrag;
  fields: ChannelFields;
}

function ChannelRowItemBase({
  item,
  router,
  setRowMenu,
  query,
  pinned,
  draftText,
  active,
  current,
  drag,
  fields,
}: ChannelRowItemProps): React.ReactElement {
  const openMenu = rowMenuOpener(item.convId, setRowMenu);
  const dragActive = useSortableActive();
  const row = (
    <ChannelRow
      {...chatRowProps(item, { pinned, fields, draftText })}
      mark={rowDataSet(item.convId)}
      active={active}
      highlightQuery={query}
      onPress={() => {
        if (!current) router.push(conversationLinkOf(item.convId, item.peerAddress));
      }}
      onLongPress={(anchor) => {
        if (!dragActive()) openMenu(anchor);
      }}
    />
  );
  return pinned ? (
    <PinnedRow drag={drag} convId={item.convId} onHold={openMenu}>
      {row}
    </PinnedRow>
  ) : (
    row
  );
}

const ChannelRowItem = memo(ChannelRowItemBase);

export function useChannelRowRenderer(
  router: { push: (to: { pathname: string; params: { convId: string } }) => void },
  setRowMenu: (m: RowMenu) => void,
  deps: {
    channelProfilesVersion: number;
    draftsVersion: number;
    pinned: readonly string[];
    query?: string;
    activePath: string;
    menuConvId?: string;
    drag: HomeDrag;
    fields: ChannelFields;
    items: readonly HomeListItem[];
  },
): ({ item }: { item: HomeListItem }) => React.ReactElement {
  const { channelProfilesVersion, draftsVersion, pinned, query, activePath, menuConvId, drag, fields } = deps;
  const { hoveredGroup, wrapItem } = useGroupHover(deps.items);
  return useCallback(
    ({ item }: { item: HomeListItem }): React.ReactElement => {
      if (isGroupHeader(item)) {
        const header = (
          <GroupHeader
            header={item.header}
            onToggle={toggleGroupCollapsed}
            sectionHovered={hoveredGroup === item.header.key}
            wrapToggle={(node) => (drag.model.sectionKeys.has(item.convId) ? <SectionHandle>{node}</SectionHandle> : node)}
          />
        );
        return wrapItem(
          item,
          <DragCell drag={drag} item={item}>
            {header}
          </DragCell>,
        );
      }
      const current = isActiveConversationPath(activePath, item.convId, item.peerAddress);
      return wrapItem(
        item,
        <DragCell drag={drag} item={item} onHold={rowMenuOpener(item.convId, setRowMenu)}>
          <ChannelRowItem
            item={item}
            router={router}
            setRowMenu={setRowMenu}
            query={query}
            profilesVersion={channelProfilesVersion}
            pinned={pinned.includes(item.convId)}
            draftText={getDraft(item.convId)}
            active={menuConvId === item.convId || current}
            current={current}
            drag={drag}
            fields={fields}
          />
        </DragCell>,
      );
    },
    [
      router,
      setRowMenu,
      channelProfilesVersion,
      draftsVersion,
      pinned,
      query,
      activePath,
      menuConvId,
      drag,
      fields,
      hoveredGroup,
      wrapItem,
    ],
  );
}

const RESET_TITLE = 'Reset local database';
const RESET_MESSAGE =
  'Wipes the local XMTP database of this account only. The account and its keys stay, ' +
  'but messages stored on this device are gone and a new device slot is used. An account supports ten.';

function confirmReset(): void {
  void resetXmtpDatabase({ title: RESET_TITLE, message: RESET_MESSAGE });
}

export function HomeError({ error, dark, fg }: { error: string; dark: boolean; fg: string }): React.ReactElement {
  return (
    <Column padding={24} weight={1} align="center" justify="center" surface="surface">
      <Text size="xs" color={fg} style={{ textAlign: 'center', marginBottom: 16 }}>
        {error}
      </Text>
      <Button
        label="Reload"
        size="lg"
        pill
        color="primary"
        variant="solid"
        dark={dark}
        style={{ alignSelf: 'center', marginBottom: 12 }}
        onPress={() => {
          capabilities.reload();
        }}
      />
      <Pressable
        onPress={confirmReset}
        style={({ pressed }) => ({
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 999,
          backgroundColor: pressed ? '#5c2231' : 'transparent',
          borderWidth: 1,
          borderColor: dark ? '#5c2231' : '#e9bbc4',
        })}
      >
        <Text size="xs" color={DANGER}>
          {RESET_TITLE}
        </Text>
      </Pressable>
    </Column>
  );
}

export function HomeLoading({ head }: { head: string }): React.ReactElement {
  return (
    <Column weight={1} align="center" justify="center">
      <Spinner size={28} color={head} />
    </Column>
  );
}

export function HomeSpinner({ head }: { head: string }): React.ReactElement {
  return (
    <Column weight={1} surface="surface">
      <MessagingSetupBanner />
      <HomeLoading head={head} />
    </Column>
  );
}

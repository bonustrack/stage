import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { avatarRenderUrl } from '@stage-labs/client/profile/avatar';
import { canEditGroup } from '@stage-labs/client/xmtp/groups';
import { ProfileCoverBar, ProfileCoverMenu, PROFILE_AVATAR_SIZE, ProfileCover } from '../ProfileCover';
import { ImageViewer } from '../ImageViewer';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { cachedSelfEthAddress, selfEthAddress } from '../../lib/xmtp.client';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useEffectiveColorScheme, DANGER, usePalette } from '../../lib/theme';
import { profileLinkOf } from '../../lib/links';
import { reported } from '../../lib/errorPolicy';
import { channelProfileMenuItems, memberRowModel, type ChannelMemberRole, type MemberRowBadge } from './channel.parts.model';
import { ChannelAssignees, ChannelMembersSection } from '../conversation/MemberListSidebar';
import { EditChannelModal } from './EditChannelModal';
import { useChannelDetail } from './channel.detail';
import { ChannelFields, ChannelLabels, useLiveChannelLabels } from './channel.labels';
import { Badge } from '@stage-labs/kit/react-native/badge';
import { Image } from '@stage-labs/kit/react-native/image';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { Button } from '@stage-labs/kit/react-native/button';
import { MEMBER_OWNER_BG, MEMBER_OWNER_FG } from '../../lib/uiColors';
import { stampAvatarUrl, channelStampSeed } from '@stage-labs/kit/avatar';
import { IconTrashCan } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconTrashCan';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Eyebrow } from '../Eyebrow';
import { TitleText } from '../TitleText';
import { channelTitle } from '../conversation/convTitle';
import { Column, VirtualList, Row, PAGE_GUTTER } from '../layout';
import { Text } from '@stage-labs/kit/react-native/text';

function ChannelProfileHeader({ imageUrl, channelId, insetTop, onView, children }: {
  imageUrl: string; channelId: string; insetTop: number; onView: () => void; children: ReactNode;
}): React.ReactElement {
  const { bg, border: rowBg } = usePalette();
  const fallbackUri = channelId ? stampAvatarUrl(channelStampSeed(channelId), PROFILE_AVATAR_SIZE) : '';
  return (
    <ProfileCover
      insetTop={insetTop}
      avatar={
        <Pressable onPress={onView} disabled={!imageUrl} hitSlop={8}>
          <Image fit="cover"
            url={imageUrl ? avatarRenderUrl(imageUrl) : fallbackUri}
            style={{
              width: PROFILE_AVATAR_SIZE, height: PROFILE_AVATAR_SIZE, borderRadius: Math.round(PROFILE_AVATAR_SIZE * 0.12),
              backgroundColor: rowBg, borderWidth: 3, borderColor: bg,
            }}
          />
        </Pressable>
      }
    >
      {children}
    </ProfileCover>
  );
}

function ChannelTitle({ name, description }: { name: string | null; description: string }): React.ReactElement {
  const { link: head, text: fg } = usePalette();
  const about = description.trim();
  return (
    <>
      <Column padding={{ x: PAGE_GUTTER, top: 14, bottom: 16 }}>
        <TitleText title={channelTitle(name)} fontWeight="semibold" size="2xl" color={head} style={{ textAlign: 'left' }}/>
      </Column>
      {about ? (
        <Column padding={{ x: PAGE_GUTTER, bottom: 16 }}>
          <Eyebrow>DESCRIPTION</Eyebrow>
          <Text size="xs" color={fg} style={{ marginTop: 6 }}>{about}</Text>
        </Column>
      ) : null}
    </>
  );
}

function MemberBadge({ badge, border, sub, dark }: {
  badge: MemberRowBadge; border: string; sub: string; dark: boolean;
}): React.ReactElement {
  const owner = badge.role === 'owner';
  return (
    <Badge
      label={badge.label}
      fontWeight="medium"
      color={owner ? MEMBER_OWNER_FG : sub}
      background={owner ? MEMBER_OWNER_BG : border}
      dark={dark}
    />
  );
}

function MemberRow({
  item, isSelf, isRemovingThis, role, name, dark, onPress, onRemove,
}: {
  item: string; isSelf: boolean; isRemovingThis: boolean;
  role: ChannelMemberRole; name: string | null | undefined;
  dark: boolean; onPress: () => void; onRemove: () => void;
}): React.ReactElement {
  const { text: sub, border } = usePalette();
  const model = memberRowModel({ shortAddress: shortAddress(item), name, isSelf, role });
  return (
    <Column style={{ opacity: isRemovingThis ? 0.5 : 1 }}>
      <ListViewItem
        align="center"
        gap={12}
        dark={dark}
        padding={{ paddingTop: 14, paddingRight: 14, paddingBottom: 14, paddingLeft: 14 }}
        border={{ bottom: { width: 1, color: border } }}
        pressedBackground={border}
        onPress={() => {
          if (!isRemovingThis) onPress();
        }}
      >
        <Row align="center" gap={12} weight={1}>
          <Image fit="cover" url={stampAvatarUrl(item, 40)} size={40} radius="full" background={border} />
          <Column gap={2} weight={1}>
            <Text size="xs" text={model.displayName} fontWeight="semibold" truncate />
            {model.addressLine === undefined ? null : (
              <Text size="md" variant="caption" text={model.addressLine} color="secondary" truncate />
            )}
          </Column>
          {model.badge === undefined ? null : (
            <MemberBadge badge={model.badge} border={border} sub={sub} dark={dark} />
          )}
          {isSelf ? null : (
            <Button
              color="primary"
              variant="ghost"
              uniform
              size="xs"
              radius={999}
              dark={dark}
              tintFg={DANGER}
              tintPressedBg={dark ? '#3a1820' : '#fbe3e8'}
              iconStart={<Glyph icon={IconTrashCan} size={18} color={DANGER} dark={dark} />}
              onPress={() => {
                if (!isRemovingThis) onRemove();
              }}
            />
          )}
        </Row>
      </ListViewItem>
    </Column>
  );
}

export function ChannelProfile({ convId }: { convId: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dark = useEffectiveColorScheme() === 'dark';
  const g = useChannelDetail(convId);
  const labels = useLiveChannelLabels(convId);
  const [selfAddress, setSelfAddress] = useState<string>('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const cached = cachedSelfEthAddress();
    if (cached) { setSelfAddress(cached.toLowerCase()); return; }
    void selfEthAddress().then(addr => {
      if (addr) setSelfAddress(addr.toLowerCase());
    }).catch(reported('channel.selfAddress'));
  }, []);

  return (
    <Column surface="surface" weight={1}>
      <ProfileCoverBar
        insetTop={insets.top}
        trailing={
          <ProfileCoverMenu
            items={channelProfileMenuItems(canEditGroup(g.rights))} loading={g.leaving}
            onSelect={(id) => { if (id === 'edit') setEditOpen(true); else void g.leaveChannel(); }}
          />
        }
      />
      <ChannelProfileHeader
        insetTop={insets.top} imageUrl={g.imageUrl} channelId={convId}
        onView={() => { setViewerOpen(true); }}
      >
        <ChannelTitle name={g.name} description={g.description} />
      </ChannelProfileHeader>
      <ChannelMembersSection convId={convId} count={g.members.length}/>
      <VirtualList
        data={g.members}
        extraData={g.memberNames}
        keyExtractor={addr => addr.toLowerCase()}
        ListFooterComponent={<><ChannelAssignees convId={convId}/><ChannelFields convId={convId}/><ChannelLabels convId={convId} labels={labels}/></>}
        renderItem={({ item }) => (
          <MemberRow
            item={item}
            isSelf={item.toLowerCase() === selfAddress}
            isRemovingThis={g.removing === item.toLowerCase()}
            role={g.memberRoles[item]}
            name={g.memberNames[item]}
            dark={dark}
            onPress={() => { router.push(profileLinkOf(item)); }}
            onRemove={() => { void g.removeMember(item); }}
          />
        )}
      />
      <EditChannelModal
        visible={editOpen}
        onClose={() => { setEditOpen(false); }}
        convId={convId} name={g.name} description={g.description} imageUrl={g.imageUrl} rights={g.rights}
        labels={labels}
      />
      <ImageViewer
        uri={g.imageUrl ? avatarRenderUrl(g.imageUrl) : ''}
        visible={viewerOpen}
        onClose={() => { setViewerOpen(false); }}
      />
    </Column>
  );
}

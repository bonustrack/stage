import { useRouter } from 'expo-router';
import { DROPDOWN_MENU, DropdownMenuSeparator } from '@stage-labs/kit/react-native/menu';
import { PickerRow } from '../conversation/SidebarSection';
import { AppIcon } from '../widgets';
import { CHANNEL_FIELDS, visibleChannelFieldCount } from './fields.model';
import { toggleChannelField, useChannelFields } from '../../lib/channelFields';
import { useOpenNewChat } from './newChatFocus';
import { HoverIconButton } from '../hover';
import { CHANNELS_OVERFLOW_ITEMS, VIEW_ITEM, homeSortMenu, homeViewEdit, homeViewMenu } from './model';
import { MenuHeading, MenuRow, OverflowMenu } from '../MenuRows';
import { AnchoredMenu } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { getActiveAccount } from '../../lib/accounts';
import { setHomeView, useHomeView } from '../../lib/homeView';
import { capabilities } from '../../lib/capabilities';
import { profileLinkOf } from '../../lib/links';
import { memo, useEffect, useState } from 'react';
import { SearchFilterMenu } from '../SearchFilterMenu';
import { searchFilterCount, type FilterScope } from '../searchFilter.model';
import { Path } from 'react-native-svg';
import { CentralIconBase, type CentralIconBaseProps } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/CentralIconBase';

const BUBBLE =
  'M12.363 3.007A9 9 0 0 0 3 12C3 13.4247 3.33104 14.7721 3.9204 15.9694C3.9709 16.072 3.98746 16.1883 3.96447 16.3003L3.14957 20.2712C3.07816 20.6191 3.38218 20.9285 3.73132 20.8632L7.83545 20.0953C7.94223 20.0753 8.05242 20.091 8.15059 20.1376C9.31767 20.6906 10.6227 21 12 21A9 9 0 0 0 20.942 13.016';

const SPARKLE =
  'M20.2405 4.18518L19.5436 2.37334C19.4571 2.14842 19.241 2 19 2C18.759 2 18.5429 2.14842 18.4564 2.37334L17.7595 4.18518C17.658 4.44927 17.4493 4.65797 17.1852 4.75955L15.3733 5.45641C15.1484 5.54292 15 5.75901 15 6C15 6.24099 15.1484 6.45708 15.3733 6.54359L17.1852 7.24045C17.4493 7.34203 17.658 7.55073 17.7595 7.81482L18.4564 9.62666C18.5429 9.85158 18.759 10 19 10C19.241 10 19.4571 9.85158 19.5436 9.62666L20.2405 7.81482C20.342 7.55073 20.5507 7.34203 20.8148 7.24045L22.6267 6.54359C22.8516 6.45708 23 6.24099 23 6C23 5.75901 22.8516 5.54292 22.6267 5.45641L20.8148 4.75955C20.5507 4.65797 20.342 4.44927 20.2405 4.18518Z';

const IconBubbleSparkle = memo((props: CentralIconBaseProps) => (
  <CentralIconBase {...props}>
    <Path d={BUBBLE} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    <Path d={SPARKLE} fill="currentColor" />
  </CentralIconBase>
));

function copyActiveAddress(): void {
  void getActiveAccount().then(acct => {
    if (!acct?.address) return;
    capabilities.copy('Address', acct.address);
  });
}

export interface HomeMenuState {
  anchor: MenuPoint | null;
  setAnchor: React.Dispatch<React.SetStateAction<MenuPoint | null>>;
}

interface HomeFilterProps {
  query: string;
  setQuery: (query: string) => void;
  scope: FilterScope;
  onFilterMenu: (open: boolean) => void;
}

function HomeViewMenu({ anchor, onClose, ...filter }: HomeFilterProps & { anchor: MenuPoint | null; onClose: () => void }): React.ReactElement {
  const current = useHomeView();
  const fields = useChannelFields(current.view);
  const [page, setPage] = useState('view');
  const close = (): void => { setPage('view'); onClose(); };
  const back = (): void => { setPage('view'); };
  const open = anchor !== null;
  const { onFilterMenu } = filter;
  useEffect(() => { onFilterMenu(open); return () => { onFilterMenu(false); }; }, [open, onFilterMenu]);
  const pick = (id: string): void => {
    if (id === 'grouping' || id === 'sorting' || id === 'filter' || id === 'fields') { setPage(id); return; }
    const edit = homeViewEdit(current, id);
    if (edit === null) return;
    if (edit.view === undefined && page !== 'sorting') close();
    setHomeView(edit);
  };
  const filterCount = searchFilterCount(filter.query);
  const counts: Record<string, number | undefined> = {
    filter: filterCount > 0 ? filterCount : undefined,
    fields: visibleChannelFieldCount(fields),
  };
  return (
    <AnchoredMenu visible={open} onClose={close} anchor={anchor} avoidKeyboard>
      {page === 'filter' ? <SearchFilterMenu {...filter} onBack={back}/> : <>
        {page === 'view' ? null : <>
          <MenuRow icon="IconArrowLeft" label="View" onPress={back}/>
          <DropdownMenuSeparator/>
        </>}
        {page === 'fields' ? <>
          <MenuHeading text="Fields"/>
          {CHANNEL_FIELDS.map(field => (
            <PickerRow key={field.id} label={field.label} selected={fields[field.id]}
              leading={field.icon === undefined ? undefined : <AppIcon name={field.icon} size={DROPDOWN_MENU.icon} color="link"/>}
              onPress={() => { toggleChannelField(current.view, field.id); }}/>
          ))}
        </> : (page === 'sorting' ? homeSortMenu(current) : homeViewMenu(current, page === 'grouping')).map((section, index) => (
          <Section key={section.heading ?? index} divider={index > 0} heading={section.heading}>
            {section.rows.map(row => page === 'sorting' ? (
              <PickerRow key={row.id} label={row.label} selected={row.selected}
                leading={row.icon === undefined ? undefined : <AppIcon name={row.icon} size={DROPDOWN_MENU.icon} color="link"/>}
                onPress={() => { pick(row.id); }}/>
            ) : <MenuRow key={row.id} icon={row.icon}
              label={row.label} value={row.value} count={counts[row.id]}
              selected={row.selected} onPress={() => { pick(row.id); }}/>) }
          </Section>
        ))}
      </>}
    </AnchoredMenu>
  );
}

function Section({ divider, heading, children }: {
  divider: boolean; heading?: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      {divider ? <DropdownMenuSeparator/> : null}
      {heading === undefined ? null : <MenuHeading text={heading}/>}
      {children}
    </>
  );
}

function HomeOverflowMenu({ color, onProfile, onSettings, menu, ...filter }: HomeFilterProps & {
  color: string; onProfile: () => void; onSettings: () => void; menu: HomeMenuState;
}): React.ReactElement {
  const { anchor: viewAnchor, setAnchor: setViewAnchor } = menu;
  const reanchor = (point: MenuPoint): void => { setViewAnchor(current => current === null ? null : point); };
  const handlers: Record<string, ((anchor: MenuPoint) => void) | undefined> = {
    [VIEW_ITEM]: (anchor) => { setTimeout(() => { setViewAnchor(anchor); }, 0); },
    'copy-address': copyActiveAddress,
    profile: onProfile,
    settings: onSettings,
  };
  return (
    <>
      <OverflowMenu color={color} label="More" items={CHANNELS_OVERFLOW_ITEMS} onAnchorLayout={reanchor} onSelect={(id, anchor) => { handlers[id]?.(anchor); }}/>
      <HomeViewMenu {...filter} anchor={viewAnchor} onClose={() => { setViewAnchor(null); }}/>
    </>
  );
}

export function HomeTopnavRight({ head, ...filter }: HomeFilterProps & { head: string; menu: HomeMenuState }): React.ReactElement {
  const router = useRouter();
  const openCompose = useOpenNewChat();
  return (
    <>
      <HoverIconButton icon={IconBubbleSparkle} label="New chat" color={head} placement="below" shortcut="c" onShortcut={openCompose} onPress={openCompose} />
      <HomeOverflowMenu
        {...filter} color={head}
        onProfile={() => {
          void getActiveAccount().then(acct => {
            if (acct?.address) router.push(profileLinkOf(acct.address));
          });
        }}
        onSettings={() => { router.push('/settings'); }}
      />
    </>
  );
}

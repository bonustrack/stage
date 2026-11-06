import { useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { DROPDOWN_MENU, DropdownMenuSeparator } from '@stage-labs/kit/react-native/menu';
import { IconSettingsSliderVer } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSettingsSliderVer';
import { PickerRow } from '../PickerRows';
import { AppIcon } from '../widgets';
import { HoverIconButton } from '../hover';
import { MenuHeading, MenuRow } from '../MenuRows';
import { AnchoredMenu, menuPointBelow, menuPointOnLayout } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { CHANNEL_FIELDS, visibleChannelFieldCount } from './fields.model';
import { lastActivityLabel } from './activity.model';
import { SearchFilterMenu } from './search/SearchFilterMenu';
import { searchFilterCount } from './search/searchFilter.model';
import { viewMenuContent, type ViewMenuAction, type ViewMenuContent, type ViewMenuPage } from './viewMenu.model';
import { useHomeQuery } from './listing';
import { toggleChannelField, useChannelFields } from '../../lib/channelFields';
import type { ChannelFields } from '../../lib/channelFields.model';
import { setLastActivity, useLastActivity } from '../../lib/lastActivity';
import { setHomeView, useHomeViewOf, type HomeView } from '../../lib/homeView';
import { homeRouteOf } from '../tabs/splitRoutes';

export interface HomeMenuState {
  anchor: MenuPoint | null;
  setAnchor: React.Dispatch<React.SetStateAction<MenuPoint | null>>;
}

type PageCounts = Partial<Record<ViewMenuPage, number>>;

function FieldsPage({ view, fields }: { view: HomeView; fields: ChannelFields }): React.ReactElement {
  return (
    <>
      <MenuHeading text="Fields" />
      {CHANNEL_FIELDS.map((field) => (
        <PickerRow
          key={field.id}
          label={field.label}
          selected={fields[field.id]}
          leading={field.icon === undefined ? undefined : <AppIcon name={field.icon} size={DROPDOWN_MENU.icon} color="link" />}
          onPress={() => {
            toggleChannelField(view, field.id);
          }}
        />
      ))}
    </>
  );
}

function Section({ divider, heading, children }: { divider: boolean; heading?: string; children: React.ReactNode }): React.ReactElement {
  return (
    <>
      {divider ? <DropdownMenuSeparator /> : null}
      {heading === undefined ? null : <MenuHeading text={heading} />}
      {children}
    </>
  );
}

function SectionsPage({
  content,
  counts,
  onPick,
}: {
  content: ViewMenuContent;
  counts: PageCounts;
  onPick: (action: ViewMenuAction) => void;
}): React.ReactElement {
  const { picker } = content;
  return (
    <>
      {content.sections.map((section, index) => (
        <Section key={section.heading ?? index} divider={index > 0} heading={section.heading}>
          {section.rows.map((row) =>
            picker !== null ? (
              <PickerRow
                key={row.id}
                label={row.label}
                selected={row.selected}
                role={picker}
                autoFocus={picker === 'radio' && row.selected}
                leading={row.icon === undefined ? undefined : <AppIcon name={row.icon} size={DROPDOWN_MENU.icon} color="link" />}
                onPress={() => {
                  onPick(row.action);
                }}
              />
            ) : (
              <MenuRow
                key={row.id}
                icon={row.icon}
                label={row.label}
                value={row.value}
                count={row.action.kind === 'page' ? counts[row.action.page] : undefined}
                selected={row.selected}
                onPress={() => {
                  onPick(row.action);
                }}
              />
            ),
          )}
        </Section>
      ))}
    </>
  );
}

function HomeViewMenu({ view, anchor, onClose }: { view: HomeView; anchor: MenuPoint | null; onClose: () => void }): React.ReactElement {
  const router = useRouter();
  const [query, setQuery] = useHomeQuery(view);
  const current = useHomeViewOf(view);
  const fields = useChannelFields(view);
  const activity = useLastActivity(view);
  const [page, setPage] = useState<ViewMenuPage>('view');
  const content = viewMenuContent(page, current, activity);
  const close = (): void => {
    setPage('view');
    onClose();
  };
  const back = (): void => {
    setPage(content.back ?? 'view');
  };
  const pick = (action: ViewMenuAction): void => {
    if (action.kind === 'page') {
      setPage(action.page);
      return;
    }
    if (action.kind === 'activity') {
      setLastActivity(view, action.window);
      return;
    }
    if (content.picker !== 'checkbox') close();
    setHomeView(action.edit);
    if (action.edit.view !== undefined) router.navigate(homeRouteOf(action.edit.view));
  };
  const filterCount = searchFilterCount(query);
  const counts: PageCounts = { filter: filterCount > 0 ? filterCount : undefined, fields: visibleChannelFieldCount(fields) };
  return (
    <AnchoredMenu visible={anchor !== null} onClose={close} anchor={anchor} avoidKeyboard>
      {page === 'filter' ? (
        <SearchFilterMenu query={query} setQuery={setQuery} scope={view} onBack={back}>
          <MenuRow
            icon="IconClock"
            label="Last activity"
            value={lastActivityLabel(activity)}
            onPress={() => {
              setPage('activity');
            }}
          />
        </SearchFilterMenu>
      ) : (
        <>
          {content.back === null ? null : (
            <>
              <MenuRow icon="IconArrowLeft" label={content.back === 'filter' ? 'Filter' : 'View'} onPress={back} />
              <DropdownMenuSeparator />
            </>
          )}
          {page === 'fields' ? (
            <FieldsPage view={view} fields={fields} />
          ) : (
            <SectionsPage content={content} counts={counts} onPick={pick} />
          )}
        </>
      )}
    </AnchoredMenu>
  );
}

export function HomeViewOptions({ view, color, menu }: { view: HomeView; color: string; menu: HomeMenuState }): React.ReactElement {
  const { anchor, setAnchor } = menu;
  const reanchor = (event: LayoutChangeEvent): void => {
    const point = menuPointOnLayout(event);
    if (point !== null) setAnchor((current) => (current === null ? null : point));
  };
  return (
    <>
      <HoverIconButton
        icon={IconSettingsSliderVer}
        label="View options"
        color={color}
        placement="below"
        role="button"
        expanded={anchor !== null}
        onLayout={reanchor}
        onPress={(event) => {
          setAnchor(menuPointBelow(event));
        }}
      />
      <HomeViewMenu
        view={view}
        anchor={anchor}
        onClose={() => {
          setAnchor(null);
        }}
      />
    </>
  );
}

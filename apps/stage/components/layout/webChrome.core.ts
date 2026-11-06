export const WEB_TAB_RAIL_WIDTH = 72;

export const TAB_BAR_HEIGHT = 60;

export type PaneScope = '1' | 'rail';

export type ChromeClass = 'dragging' | 'resizing' | 'scroll-locked';

export interface DocumentTheme {
  dark: boolean;
  background: string;
  scrollbarThumb: string;
}

export const SELF_SCROLLBAR = { dataSet: { stagescrollbar: '1' } };

export const GUTTER_SCROLLBAR = { dataSet: { stagescrollbar: '1', stagegutter: '1' } };

export const SCROLLBAR_ON_HOVER = { dataSet: { stagescrollbarhover: '1' } };

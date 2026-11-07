export const TEXT_VARIANTS = ['body', 'caption'] as const;
export const TEXT_WEIGHTS = ['normal', 'medium', 'semibold', 'bold'] as const;
export const TEXT_ALIGNS = ['start', 'center', 'end'] as const;
export const TEXT_FONT_FAMILIES = ['sans', 'head', 'mono'] as const;
export const TEXT_TRANSFORMS = ['none', 'uppercase', 'lowercase', 'capitalize'] as const;

export const SURFACES = ['none', 'surface', 'raised', 'sunken', 'toolbar'] as const;
export const FLEX_JUSTIFY = ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'] as const;
export const FLEX_ALIGNS = ['start', 'center', 'end', 'stretch'] as const;
export const BOX_ALIGNS = [...FLEX_ALIGNS, 'baseline'] as const;
export const PRESS_FEEDBACKS = ['opacity', 'highlight', 'none'] as const;
export const LIST_DIRECTIONS = ['vertical', 'horizontal'] as const;
export const LIST_INDICATORS = ['preview', 'line'] as const;
export const LIST_VIEW_ITEM_ALIGNS = ['start', 'center', 'end'] as const;

export const CARD_SIZES = ['sm', 'md', 'lg'] as const;
export const TABS_VARIANTS = ['segmented', 'underline'] as const;
export const TITLE_SIZES = ['sm', 'md', 'lg'] as const;
export const TITLE_LEVELS = [1, 2, 3] as const;
export const MODAL_SIDES = ['center', 'bottom', 'end'] as const;
export const DIVIDER_AXES = ['horizontal', 'vertical'] as const;
export const MENU_ALIGNS = ['start', 'end'] as const;
export const MENU_OPEN_ON = ['press', 'contextMenu'] as const;
export const A2UI_ICON_VARIANTS = ['outline', 'solid'] as const;

export const IMAGE_FITS = ['contain', 'cover', 'fill', 'none', 'scaleDown'] as const;
export const IMAGE_VARIANTS = ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'] as const;

export const TEXT_FIELD_VARIANTS = ['shortText', 'longText', 'number', 'obscured'] as const;
export const TEXT_FIELD_APPEARANCES = ['soft', 'outline', 'plain', 'filled'] as const;
export const CHECK_BOX_DISPLAY_STYLES = ['checkbox', 'switch'] as const;
export const CHOICE_PICKER_VARIANTS = ['mutuallyExclusive', 'multipleSelection'] as const;
export const CHOICE_PICKER_DISPLAY_STYLES = ['checkbox', 'chips'] as const;

export const CHART_SERIES_TYPES = ['bar', 'line', 'area'] as const;
export const CHART_DOMAIN_BOUNDS = ['auto', 'dataMin', 'dataMax'] as const;

export const PADDING_SIDES = ['top', 'right', 'bottom', 'left', 'x', 'y'] as const;
export const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const;
export const BORDER_STYLES = ['solid', 'dashed', 'dotted'] as const;

export const PERCENT_PATTERN = '^(100|[0-9]{1,2})(\\.[0-9]+)?%$';
export const PERCENT = new RegExp(PERCENT_PATTERN);

export const LITERAL_HEX_COLOR_PATTERN = '^#[0-9a-fA-F]{6}$';
export const BOUND_HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

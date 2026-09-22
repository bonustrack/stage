export const PAGE_INTRO_TYPE = {
  title: { fontSize: 38, lineHeight: 46 },
  about: { fontSize: 20, lineHeight: 26 },
  gap: 14,
  sectionGap: 32,
  contentWidth: 340,
  padX: 24,
  topShare: 0.15,
} as const;

export const PAGE_INTRO_MAX_WIDTH = PAGE_INTRO_TYPE.contentWidth + 2 * PAGE_INTRO_TYPE.padX;

export function pageTopPadding(windowHeight: number): number {
  return Math.round(windowHeight * PAGE_INTRO_TYPE.topShare);
}

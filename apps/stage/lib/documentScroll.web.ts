export function documentScroll(): { x: number; y: number } {
  return { x: window.scrollX, y: window.scrollY };
}

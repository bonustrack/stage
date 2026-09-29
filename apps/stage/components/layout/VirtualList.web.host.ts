import type { ListScrollMetrics } from './VirtualList.model';

export interface ScrollHost {
  metrics(): ListScrollMetrics;
  shown(): boolean;
  scrollTo(offset: number, animated: boolean): void;
  subscribe(onScroll: () => void): () => void;
  itemsOffset(items: HTMLElement): number;
}

const behavior = (animated: boolean): ScrollBehavior => (animated ? 'smooth' : 'instant');

const rendered = (el: HTMLElement | null): boolean => el !== null && el.getClientRects().length > 0;

export function whenShown<A extends unknown[]>(host: ScrollHost, scroll: (...args: A) => void): (...args: A) => void {
  return (...args) => { if (host.shown()) scroll(...args); };
}

export function windowHost(content: () => HTMLElement | null): ScrollHost {
  const contentTop = (): number => {
    const el = content();
    return el === null ? 0 : el.getBoundingClientRect().top + window.scrollY;
  };
  return {
    metrics: () => {
      const rect = content()?.getBoundingClientRect();
      return {
        offset: rect === undefined ? 0 : Math.max(0, -rect.top),
        contentHeight: rect?.height ?? 0,
        viewportHeight: window.innerHeight,
      };
    },
    shown: () => rendered(content()),
    scrollTo: (offset, animated) => {
      if (!rendered(content())) return;
      window.scrollTo({ top: contentTop() + offset, behavior: behavior(animated) });
    },
    subscribe: (onScroll) => {
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      return () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
    },
    itemsOffset: (items) => items.getBoundingClientRect().top + window.scrollY,
  };
}

export function elementHost(element: () => HTMLElement | null): ScrollHost {
  return {
    metrics: () => {
      const el = element();
      return {
        offset: el?.scrollTop ?? 0,
        contentHeight: el?.scrollHeight ?? 0,
        viewportHeight: el?.clientHeight ?? 0,
      };
    },
    shown: () => rendered(element()),
    scrollTo: (offset, animated) => {
      const el = element();
      if (rendered(el)) el?.scrollTo({ top: offset, behavior: behavior(animated) });
    },
    subscribe: (onScroll) => {
      const el = element();
      if (el === null) return () => undefined;
      el.addEventListener('scroll', onScroll, { passive: true });
      return () => { el.removeEventListener('scroll', onScroll); };
    },
    itemsOffset: (items) => {
      const el = element();
      if (el === null) return 0;
      return items.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    },
  };
}

import { describe, expect, test } from 'bun:test';
import { createTabLock, type LockRequester, type TabLock } from '../lib/tabLock.core';

interface Pending {
  tab: string;
  granted: (lock: unknown) => Promise<void>;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

class FakeLockManager {
  private holder: Pending | null = null;
  private queue: Pending[] = [];

  forTab(tab: string): LockRequester {
    return {
      request: (_name, options, granted) => new Promise((resolve, reject) => {
        const entry: Pending = { tab, granted, resolve, reject };
        if (options.steal) { this.steal(entry); return; }
        if (this.holder && options.ifAvailable) { void granted(null).then(resolve, reject); return; }
        if (!this.holder) { this.grant(entry); return; }
        this.queue.push(entry);
      }),
    };
  }

  closeTab(tab: string): void {
    this.queue = this.queue.filter((e) => e.tab !== tab);
    if (this.holder?.tab === tab) this.release();
  }

  private release(): void {
    this.holder = null;
    const next = this.queue.shift();
    if (next) this.grant(next);
  }

  private steal(entry: Pending): void {
    const previous = this.holder;
    this.grant(entry);
    if (previous) queueMicrotask(() => { previous.reject(new Error('AbortError')); });
  }

  private grant(entry: Pending): void {
    this.holder = entry;
    queueMicrotask(() => {
      void entry.granted({}).then((value) => {
        if (this.holder === entry) this.release();
        entry.resolve(value);
      });
    });
  }
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function openTab(manager: FakeLockManager, tab: string, lost: string[]): TabLock {
  return createTabLock(manager.forTab(tab), 'stage.xmtp', () => { lost.push(tab); });
}

describe('createTabLock', () => {
  test('the first tab runs Stage and a second tab stands by', async () => {
    const manager = new FakeLockManager();
    const lost: string[] = [];
    const first = openTab(manager, 'a', lost);
    await settle();
    const second = openTab(manager, 'b', lost);
    await settle();
    expect(first.role()).toBe('active');
    expect(second.role()).toBe('standby');
    expect(lost).toEqual([]);
  });

  test('a standby tab takes over by itself when the active tab closes', async () => {
    const manager = new FakeLockManager();
    const lost: string[] = [];
    openTab(manager, 'a', lost);
    await settle();
    const second = openTab(manager, 'b', lost);
    await settle();
    const seen: string[] = [];
    second.subscribe(() => { seen.push(second.role()); });
    manager.closeTab('a');
    await settle();
    expect(second.role()).toBe('active');
    expect(seen).toEqual(['active']);
  });

  test('use here moves Stage to this tab and the previous tab is told it lost it', async () => {
    const manager = new FakeLockManager();
    const lost: string[] = [];
    openTab(manager, 'a', lost);
    await settle();
    const second = openTab(manager, 'b', lost);
    await settle();
    second.takeOver();
    await settle();
    expect(second.role()).toBe('active');
    expect(lost).toEqual(['a']);
  });

  test('a tab that took over with use here is told when a third tab takes over from it', async () => {
    const manager = new FakeLockManager();
    const lost: string[] = [];
    openTab(manager, 'a', lost);
    await settle();
    const second = openTab(manager, 'b', lost);
    await settle();
    second.takeOver();
    await settle();
    const third = openTab(manager, 'c', lost);
    await settle();
    third.takeOver();
    await settle();
    expect(third.role()).toBe('active');
    expect(lost).toEqual(['a', 'b']);
  });

  test('a tab that took over by itself is told when another tab takes over from it', async () => {
    const manager = new FakeLockManager();
    const lost: string[] = [];
    openTab(manager, 'a', lost);
    await settle();
    openTab(manager, 'b', lost);
    await settle();
    manager.closeTab('a');
    await settle();
    const third = openTab(manager, 'c', lost);
    await settle();
    third.takeOver();
    await settle();
    expect(third.role()).toBe('active');
    expect(lost).toEqual(['b']);
  });

  test('pressing use here twice does not make the tab steal Stage from itself', async () => {
    const manager = new FakeLockManager();
    const lost: string[] = [];
    openTab(manager, 'a', lost);
    await settle();
    const second = openTab(manager, 'b', lost);
    await settle();
    second.takeOver();
    second.takeOver();
    await settle();
    expect(second.role()).toBe('active');
    expect(lost).toEqual(['a']);
  });

  test('use here does nothing in the tab that already runs Stage', async () => {
    const manager = new FakeLockManager();
    const lost: string[] = [];
    const first = openTab(manager, 'a', lost);
    await settle();
    first.takeOver();
    await settle();
    expect(first.role()).toBe('active');
    expect(lost).toEqual([]);
  });

  test('when the browser refuses the lock, the tab runs Stage rather than hanging', async () => {
    const broken: LockRequester = { request: () => Promise.reject(new Error('SecurityError')) };
    const lost: string[] = [];
    const tab = createTabLock(broken, 'stage.xmtp', () => { lost.push('a'); });
    await settle();
    expect(tab.role()).toBe('active');
    expect(lost).toEqual([]);
  });
});

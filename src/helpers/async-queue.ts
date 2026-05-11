/** Bridge a push-based event source (callbacks) into a pull-based AsyncIterable. */

export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = [];
  private resolveNext: (() => void) | null = null;
  private done = false;
  private error: Error | null = null;

  push(item: T): void {
    if (this.done) return;
    this.queue.push(item);
    this.flush();
  }

  finish(): void {
    if (this.done) return;
    this.done = true; this.flush();
  }

  fail(err: Error): void {
    if (this.done) return;
    this.error = err; this.done = true; this.flush();
  }

  private flush(): void { const r = this.resolveNext; this.resolveNext = null; r?.(); }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<T> {
    while (true) {
      if (this.queue.length) { yield this.queue.shift()!; continue; }
      if (this.done) { if (this.error) throw this.error; return; }
      await new Promise<void>(r => { this.resolveNext = r; });
    }
  }
}

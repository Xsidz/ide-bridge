export class Debouncer {
  private last = new Map<string, number>();
  constructor(private windowMs: number) {}
  shouldSave(projectId: string): boolean {
    const prev = this.last.get(projectId);
    if (prev === undefined) return true;
    return Date.now() - prev >= this.windowMs;
  }
  mark(projectId: string): void { this.last.set(projectId, Date.now()); }
}

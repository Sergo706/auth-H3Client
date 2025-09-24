type CacheEntry<T> = {
  value: T;
  expiry: number;
};

export class MiniCache<T = any> {
  private store = new Map<string, CacheEntry<T>>();
  private maxEntries: number;
  private sweepTimer: NodeJS.Timeout;

  /**
   *@param maxEntries  maximum number of entries before evicting oldest
   */
  constructor(maxEntries = Infinity, sweepIntervalMs = 60_000) {
    this.maxEntries = maxEntries;

    this.sweepTimer = setInterval(() => this.sweepExpired(), sweepIntervalMs);

    this.sweepTimer.unref();
  }

  private sweepExpired() {
    const now = Date.now();
    for (const [key, { expiry }] of this.store) {
      if (expiry <= now) this.store.delete(key);
    }
  }


  stale(key: string): T | null {
    const entry = this.store.get(key);
    return entry ? entry.value : null;
  }

  /**
   * @param key    unique key for this entry
   * @param value  value to cache
   * @param ttlMs  time-to-live in milliseconds
   */
  set(key: string, value: T, ttlMs: number): void {

    if (this.store.has(key)) {
        this.store.delete(key);
      }
      
    const expiry = Date.now() + ttlMs;
    this.store.set(key, { value, expiry });

    while (this.store.size > this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey !== undefined) {
            this.store.delete(oldestKey);
        }
      }
  }

  /**
   * @param key  lookup key
   * @returns    the cached value or null if missing/expired
   */
  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.store.delete(key);
      return null;
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  /**
   * @param key  remove a cached entry immediately
   */
  del(key: string): void {
    this.store.delete(key);
  }

  /**
   * @returns clear entire cache
   */
  clear(): void {
    this.store.clear();
  }
}


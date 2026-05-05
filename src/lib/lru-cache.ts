// ============================================================
// lib/lru-cache.ts — L1 Cache in-memory avec TTL
//
// Scope : par instance serverless (5–30 s de vie typique)
// Taille : 500 entrées max (eviction FIFO du plus ancien)
// Thread-safe : pas de concurrence dans Node.js single-thread
// ============================================================

interface LRUEntry<T> {
  data:      T;
  version:   number;
  expiresAt: number;
}

class LRUCache {
  private readonly cache   = new Map<string, LRUEntry<unknown>>();
  private readonly maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): LRUEntry<T> | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // LRU promotion: supprimer + re-insérer déplace en fin de Map
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry as LRUEntry<T>;
  }

  set<T>(key: string, data: T, version: number, ttlMs: number): void {
    if (this.cache.size >= this.maxSize) {
      // Evict le premier inséré (clé la plus ancienne)
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { data, version, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

// Singleton attaché à globalThis pour survivre aux hot-reloads en dev
// En production chaque instance serverless a son propre LRU frais

declare global {
  // eslint-disable-next-line no-var
  var __beloLRU: LRUCache | undefined;
}

export const lru: LRUCache =
  globalThis.__beloLRU ?? new LRUCache(500);

if (process.env.NODE_ENV !== "production") {
  globalThis.__beloLRU = lru;
}

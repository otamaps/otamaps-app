import { BeaconCatalogEntry } from "./bleTrackingTypes";

export interface BeaconCatalogSnapshot {
  beacons: BeaconCatalogEntry[];
  timestamp: number;
}

export interface BeaconCatalogStorage {
  read(): Promise<BeaconCatalogSnapshot | null>;
  write(snapshot: BeaconCatalogSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export interface BeaconCatalogRemote {
  fetchAll(): Promise<BeaconCatalogEntry[] | null>;
  fetchByIds(ids: string[]): Promise<BeaconCatalogEntry[] | null>;
}

interface BeaconCatalogOptions {
  ttlMs: number;
  cacheMissRefreshMs: number;
  now?: () => number;
}

function normalizeBeacon(beacon: BeaconCatalogEntry): BeaconCatalogEntry {
  return {
    ...beacon,
    ble_id: String(beacon.ble_id).trim(),
  };
}

export class BeaconCatalogCache {
  private readonly entries = new Map<string, BeaconCatalogEntry>();
  private timestamp = 0;
  private hydrated = false;
  private hydratePromise: Promise<void> | null = null;
  private refreshPromise: Promise<void> | null = null;
  private missingFetchPromise: Promise<void> | null = null;
  private lastCacheMissRefreshAt = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly storage: BeaconCatalogStorage,
    private readonly remote: BeaconCatalogRemote,
    private readonly options: BeaconCatalogOptions
  ) {}

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private replace(entries: BeaconCatalogEntry[], timestamp: number): void {
    this.entries.clear();
    this.mergeInMemory(entries);
    this.timestamp = timestamp;
  }

  private mergeInMemory(entries: BeaconCatalogEntry[]): void {
    for (const entry of entries) {
      const normalized = normalizeBeacon(entry);
      if (!normalized.ble_id) continue;
      this.entries.set(normalized.ble_id, {
        ...this.entries.get(normalized.ble_id),
        ...normalized,
      });
    }
  }

  private snapshot(): BeaconCatalogSnapshot {
    return {
      beacons: Array.from(this.entries.values()),
      timestamp: this.timestamp,
    };
  }

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    if (this.hydratePromise) return this.hydratePromise;
    this.hydratePromise = (async () => {
      const stored = await this.storage.read();
      if (stored) this.replace(stored.beacons, stored.timestamp);
      this.hydrated = true;
      this.hydratePromise = null;
    })();
    return this.hydratePromise;
  }

  async prepare(): Promise<void> {
    await this.hydrate();
    if (
      this.entries.size === 0 ||
      this.now() - this.timestamp >= this.options.ttlMs
    ) {
      void this.refresh();
    }
  }

  async refresh(): Promise<void> {
    await this.hydrate();
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const fetched = await this.remote.fetchAll();
      if (fetched) {
        this.replace(fetched, this.now());
        await this.storage.write(this.snapshot());
      }
    })().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  peek(): ReadonlyMap<string, BeaconCatalogEntry> {
    return this.entries;
  }

  async getAll(forceRefresh = false): Promise<BeaconCatalogEntry[]> {
    await this.hydrate();
    if (forceRefresh || this.entries.size === 0) {
      await this.refresh();
    } else if (this.now() - this.timestamp >= this.options.ttlMs) {
      void this.refresh();
    }
    return Array.from(this.entries.values());
  }

  async resolve(ids: string[]): Promise<ReadonlyMap<string, BeaconCatalogEntry>> {
    await this.hydrate();
    if (this.entries.size === 0) {
      await this.refresh();
    } else if (this.now() - this.timestamp >= this.options.ttlMs) {
      void this.refresh();
    }

    let missingIds = Array.from(
      new Set(ids.map((id) => String(id).trim()).filter(Boolean))
    ).filter((id) => !this.entries.has(id));

    if (missingIds.length > 0 && this.refreshPromise) {
      await this.refreshPromise;
      missingIds = missingIds.filter((id) => !this.entries.has(id));
    }

    if (missingIds.length > 0 && this.missingFetchPromise) {
      await this.missingFetchPromise;
      missingIds = missingIds.filter((id) => !this.entries.has(id));
    }

    const now = this.now();
    if (
      missingIds.length > 0 &&
      now - this.lastCacheMissRefreshAt >= this.options.cacheMissRefreshMs
    ) {
      this.lastCacheMissRefreshAt = now;
      this.missingFetchPromise = (async () => {
        const fetched = await this.remote.fetchByIds(missingIds);
        if (fetched && fetched.length > 0) {
          this.mergeInMemory(fetched);
          await this.storage.write(this.snapshot());
        }
      })().finally(() => {
        this.missingFetchPromise = null;
      });
      await this.missingFetchPromise;
    }
    return this.entries;
  }

  async merge(entries: BeaconCatalogEntry[]): Promise<void> {
    await this.hydrate();
    this.mergeInMemory(entries);
    await this.storage.write(this.snapshot());
  }

  async clear(): Promise<void> {
    this.entries.clear();
    this.timestamp = 0;
    this.hydrated = true;
    await this.storage.clear();
  }
}

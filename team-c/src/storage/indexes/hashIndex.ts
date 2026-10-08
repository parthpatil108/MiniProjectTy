export interface BucketEntry<K, V> {
  key: K;
  value: V;
}

/**
 * Custom Hash Index implementation using FNV-1a hashing,
 * bucket chaining for collision resolution, and dynamic load factor resizing.
 */
export class HashIndex<K = any, V = any> {
  private buckets: Array<Array<BucketEntry<K, V>>>;
  private capacity: number;
  private size: number;
  private readonly loadFactorThreshold: number;

  constructor(initialCapacity: number = 16, loadFactorThreshold: number = 0.75) {
    this.capacity = Math.max(4, initialCapacity);
    this.loadFactorThreshold = loadFactorThreshold;
    this.size = 0;
    this.buckets = new Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.buckets[i] = [];
    }
  }

  /**
   * FNV-1a 32-bit hash algorithm
   */
  public hash(key: K): number {
    const strKey = String(key);
    let hash = 0x811c9dc5; // FNV offset basis
    for (let i = 0; i < strKey.length; i++) {
      hash ^= strKey.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193); // FNV prime 16777619
    }
    return (hash >>> 0) % this.capacity;
  }

  public put(key: K, value: V): void {
    if (key === undefined || key === null) return;

    if ((this.size + 1) / this.capacity >= this.loadFactorThreshold) {
      this.resize(this.capacity * 2);
    }

    const index = this.hash(key);
    const bucket = this.buckets[index];

    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].key === key) {
        bucket[i].value = value;
        return;
      }
    }

    bucket.push({ key, value });
    this.size++;
  }

  public get(key: K): V | undefined {
    if (key === undefined || key === null) return undefined;
    const index = this.hash(key);
    const bucket = this.buckets[index];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].key === key) {
        return bucket[i].value;
      }
    }
    return undefined;
  }

  public has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  public remove(key: K): boolean {
    if (key === undefined || key === null) return false;
    const index = this.hash(key);
    const bucket = this.buckets[index];
    for (let i = 0; i < bucket.length; i++) {
      if (bucket[i].key === key) {
        bucket.splice(i, 1);
        this.size--;
        return true;
      }
    }
    return false;
  }

  private resize(newCapacity: number): void {
    const oldBuckets = this.buckets;
    this.capacity = newCapacity;
    this.buckets = new Array(this.capacity);
    for (let i = 0; i < this.capacity; i++) {
      this.buckets[i] = [];
    }
    this.size = 0;

    for (const bucket of oldBuckets) {
      for (const entry of bucket) {
        this.put(entry.key, entry.value);
      }
    }
  }

  public getSize(): number {
    return this.size;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getBuckets(): Array<Array<BucketEntry<K, V>>> {
    return this.buckets;
  }
}

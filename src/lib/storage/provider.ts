export interface StorageStat {
  sizeBytes: number;
  modifiedAt: Date;
}

export interface StorageProvider {
  readonly kind: "local";
  /** Write a whole object (overwrites). */
  save(key: string, data: Uint8Array | string | ReadableStream<Uint8Array>): Promise<StorageStat>;
  /** Pull-based stream of the object or a byte range (inclusive end). */
  get(key: string, range?: { start: number; end: number }): Promise<ReadableStream<Uint8Array>>;
  readBuffer(key: string): Promise<Uint8Array>;
  stat(key: string): Promise<StorageStat | null>;
  exists(key: string): Promise<boolean>;
  /** Idempotent. */
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  move(fromKey: string, toKey: string): Promise<void>;
  /** Create or empty an object so that writeAt() can append. */
  createEmpty(key: string): Promise<void>;
  /** Stream body into the object starting at offset; rejects (and writes nothing past maxBytes) if longer. Returns bytes written. */
  writeAt(key: string, offset: number, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<number>;
  truncate(key: string, sizeBytes: number): Promise<void>;
  /** Local filesystem path, needed for ffmpeg/ffprobe. Future S3 providers download to temp first. */
  resolveLocalPath(key: string): string;
}

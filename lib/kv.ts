/**
 * Storage adapter — auto-selects backend based on environment:
 *  - Local dev (no Upstash env vars): reads/writes data/whitelist.json
 *  - Production / Upstash configured: uses @upstash/redis
 *
 * The exported interface matches the subset of Redis commands used by
 * whitelist-store.ts: smembers, sadd, srem, hgetall, hget, hset.
 */

import path from "path";
import fs from "fs";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KVAdapter {
  smembers(key: string): Promise<string[]>;
  sadd(key: string, member: string, ...rest: string[]): Promise<number>;
  srem(key: string, member: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string> | null>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, fields: Record<string, unknown>): Promise<number>;
}

// ── File adapter (local dev) ──────────────────────────────────────────────────

const DATA_FILE = path.join(process.cwd(), "data", "whitelist.json");

interface FileStore {
  addresses: string[];
  merkle_root: string;
  manual_override: boolean;
  last_updated: string;
}

function readFile(): FileStore {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as FileStore;
  } catch {
    return { addresses: [], merkle_root: "", manual_override: false, last_updated: "" };
  }
}

function writeFile(data: FileStore): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

const ADDRS_KEY = "wl:addrs";
const META_KEY  = "wl:meta";

const fileAdapter: KVAdapter = {
  async smembers(key) {
    if (key !== ADDRS_KEY) return [];
    return readFile().addresses;
  },
  async sadd(key, member, ...rest) {
    if (key !== ADDRS_KEY) return 0;
    const store = readFile();
    const before = store.addresses.length;
    const toAdd = [member, ...rest];
    for (const m of toAdd) {
      if (!store.addresses.includes(m)) store.addresses.push(m);
    }
    writeFile(store);
    return store.addresses.length - before;
  },
  async srem(key, member) {
    if (key !== ADDRS_KEY) return 0;
    const store = readFile();
    const idx = store.addresses.indexOf(member);
    if (idx === -1) return 0;
    store.addresses.splice(idx, 1);
    writeFile(store);
    return 1;
  },
  async hgetall(key) {
    if (key !== META_KEY) return null;
    const { merkle_root, manual_override, last_updated } = readFile();
    return {
      merkle_root,
      manual_override: manual_override ? "1" : "0",
      last_updated,
    };
  },
  async hget(key, field) {
    if (key !== META_KEY) return null;
    const all = await fileAdapter.hgetall(key);
    return all ? (all[field] ?? null) : null;
  },
  async hset(key, fields) {
    if (key !== META_KEY) return 0;
    const store = readFile();
    if ("merkle_root"    in fields) store.merkle_root    = String(fields.merkle_root ?? "");
    if ("manual_override" in fields) store.manual_override = fields.manual_override === "1" || fields.manual_override === true;
    if ("last_updated"   in fields) store.last_updated   = String(fields.last_updated ?? "");
    writeFile(store);
    return Object.keys(fields).length;
  },
};

// ── Upstash adapter (production) ──────────────────────────────────────────────

function makeRedisAdapter(): KVAdapter {
  // Dynamic import so the Redis constructor never runs at module-load time locally
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  return {
    smembers: (key) => redis.smembers(key) as Promise<string[]>,
    sadd:     (key, member, ...rest) => redis.sadd(key, member, ...rest) as Promise<number>,
    srem:     (key, member) => redis.srem(key, member) as Promise<number>,
    hgetall:  (key) => redis.hgetall(key) as Promise<Record<string, string> | null>,
    hget:     (key, field) => redis.hget(key, field) as Promise<string | null>,
    hset:     (key, fields) => redis.hset(key, fields) as Promise<number>,
  };
}

// ── Export ────────────────────────────────────────────────────────────────────

export function getRedis(): KVAdapter {
  const hasUpstash =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;

  return hasUpstash ? makeRedisAdapter() : fileAdapter;
}

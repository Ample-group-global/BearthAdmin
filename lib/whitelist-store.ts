import { ethers } from "ethers";
import keccak256 from "keccak256";
import MerkleTree from "merkletreejs";
import { getRedis } from "./kv";

const ADDRS_KEY = "wl:addrs"; // Redis Set  — all whitelisted addresses (lowercase)
const META_KEY  = "wl:meta";  // Redis Hash — merkle_root, manual_override, last_updated

export interface WhitelistMeta {
  merkle_root?: string;
  manual_override: boolean;
  last_updated?: string;
  timestamp?: number;
}

// ── Merkle helpers ────────────────────────────────────────────────────────────

function toLeaf(address: string): Buffer {
  // Matches Solidity: keccak256(abi.encodePacked(address))
  const packed = ethers.solidityPacked(["address"], [address.toLowerCase()]);
  return Buffer.from(packed.slice(2), "hex");
}

function buildTree(addresses: string[]): MerkleTree {
  const leaves = addresses.map((a) => keccak256(toLeaf(a)));
  return new MerkleTree(leaves, keccak256, { sortPairs: true });
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAddresses(): Promise<string[]> {
  const members = (await getRedis().smembers(ADDRS_KEY)) as string[];
  return members.sort();
}

export async function getMeta(): Promise<WhitelistMeta> {
  const raw = await getRedis().hgetall(META_KEY);
  if (!raw) return { manual_override: false };
  const r = raw as Record<string, string>;
  return {
    merkle_root: r.merkle_root || undefined,
    manual_override: r.manual_override === "1",
    last_updated: r.last_updated || undefined,
    timestamp: r.last_updated ? new Date(r.last_updated).getTime() : undefined,
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

const ETH_ADDR = /^0x[0-9a-fA-F]{40}$/;

export async function addAddresses(addrs: string[]): Promise<{ added: number; skipped: number }> {
  const valid = addrs
    .map((a) => a.trim().toLowerCase())
    .filter((a) => ETH_ADDR.test(a));

  if (valid.length > 0) {
    const [first, ...rest] = valid;
    await getRedis().sadd(ADDRS_KEY, first, ...rest);
    await recomputeRootIfNotOverridden();
    await getRedis().hset(META_KEY, { last_updated: new Date().toISOString() });
  }

  return { added: valid.length, skipped: addrs.length - valid.length };
}

export async function removeAddress(addr: string): Promise<void> {
  await getRedis().srem(ADDRS_KEY, addr.toLowerCase());
  await recomputeRootIfNotOverridden();
  await getRedis().hset(META_KEY, { last_updated: new Date().toISOString() });
}

export async function setMerkleRootOverride(root: string): Promise<void> {
  await getRedis().hset(META_KEY, {
    merkle_root: root,
    manual_override: "1",
    last_updated: new Date().toISOString(),
  });
}

export async function clearMerkleRootOverride(): Promise<string> {
  await getRedis().hset(META_KEY, { manual_override: "0" });
  return recomputeRootIfNotOverridden();
}

async function recomputeRootIfNotOverridden(): Promise<string> {
  const raw = await getRedis().hget(META_KEY, "manual_override");
  if (raw === "1") return ""; // keep manual root intact

  const addrs = await getAddresses();
  if (addrs.length === 0) {
    await getRedis().hset(META_KEY, { merkle_root: "" });
    return "";
  }
  const tree = buildTree(addrs);
  const root = tree.getHexRoot();
  await getRedis().hset(META_KEY, { merkle_root: root });
  return root;
}

// ── Proof ─────────────────────────────────────────────────────────────────────

export async function getProof(address: string): Promise<{
  isWhitelisted: boolean;
  address: string;
  proof: string[];
  root: string;
  leafIndex: number | null;
  generatedAt: string;
}> {
  const normalized = address.toLowerCase();
  const addrs = await getAddresses();
  const isWhitelisted = addrs.includes(normalized);
  const meta = await getMeta();
  const generatedAt = new Date().toISOString();

  if (!isWhitelisted) {
    return { isWhitelisted: false, address: normalized, proof: [], root: meta.merkle_root ?? "", leafIndex: null, generatedAt };
  }

  const tree = buildTree(addrs);
  const leaf = keccak256(toLeaf(normalized));
  const proof = tree.getHexProof(leaf);
  const root = tree.getHexRoot();
  const leafIndex = addrs.indexOf(normalized);

  return { isWhitelisted: true, address: normalized, proof, root, leafIndex, generatedAt };
}

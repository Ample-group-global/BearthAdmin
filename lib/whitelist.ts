import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { ethers } from "ethers";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface WhitelistEntry {
  address: string;
  name: string | null;
  added_at: string | null;
}

export async function fetchWhitelist(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/whitelist`, { credentials: "include" });
    const data = await res.json();
    return data.addresses || [];
  } catch {
    return [];
  }
}

export async function fetchWhitelistEntries(): Promise<WhitelistEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/api/whitelist/entries?limit=1000`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.entries || []) as WhitelistEntry[];
  } catch {
    return [];
  }
}

export async function addWhitelistEntry(
  address: string,
  name: string | null
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/whitelist/entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ address, name: name || null }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function saveWhitelist(addresses: string[]): Promise<boolean> {
  try {
    // Fetch current whitelist to determine what to remove
    const current = await fetchWhitelist();
    const newSet = new Set(addresses.map((a) => a.toLowerCase()));
    const toRemove = current.filter((a) => !newSet.has(a.toLowerCase()));

    // Delete addresses not in the new list
    await Promise.all(
      toRemove.map((addr) =>
        fetch(`${API_BASE}/api/whitelist/${addr}`, {
          method: "DELETE",
          credentials: "include",
        })
      )
    );

    // Add new addresses (backend deduplicates)
    const res = await fetch(`${API_BASE}/api/whitelist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ addresses }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Source proofs from the backend so the root is always the canonical one
// (matches /api/whitelist/merkle-root and the on-chain root). The local
// buildMerkleTree below uses the same algorithm and is kept for admin UIs
// that need to preview a root client-side without an extra round-trip.
export async function checkEligibility(address: string): Promise<{
  isWhitelisted: boolean;
  proof: string[];
  root: string;
}> {
  try {
    const res = await fetch(
      `${API_BASE}/api/proof?address=${encodeURIComponent(address)}`,
      { credentials: "include" }
    );
    if (!res.ok) {
      return { isWhitelisted: false, proof: [], root: "" };
    }
    const data = await res.json();
    return {
      isWhitelisted: Boolean(data.is_whitelisted),
      proof: data.proof ?? [],
      root: data.root ?? "",
    };
  } catch {
    return { isWhitelisted: false, proof: [], root: "" };
  }
}

export async function generateProof(address: string): Promise<{
  proof: string[];
  root: string;
  isWhitelisted: boolean;
}> {
  return checkEligibility(address);
}

// Mirrors nft-backend/app/merkle.py: keccak256(solidityPacked(address)) leaves,
// sortPairs=true, natural odd-leaf promotion (merkletreejs default — do NOT
// enable duplicateOdd; that produces lone-leaf proofs unverifiable on-chain).
export function buildMerkleTree(addresses: string[]) {
  const leaves = addresses.map((addr) =>
    keccak256(ethers.solidityPacked(["address"], [addr.toLowerCase()]))
  );
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  return { tree, root: tree.getHexRoot() };
}

export function getProof(tree: MerkleTree, address: string): string[] {
  const leaf = keccak256(ethers.solidityPacked(["address"], [address.toLowerCase()]));
  return tree.getHexProof(leaf);
}

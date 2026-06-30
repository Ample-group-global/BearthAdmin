// Bearth NFT — Filebase IPFS gateway (public, no auth required)
export const IPFS_GATEWAY = "https://amgbearth.myfilebase.com/ipfs/";

// On-chain tokenURI base CID — update this string after reveal when the
// contract's baseURI is changed via reveal(newBaseUri)
export const METADATA_BASE_CID = "QmdkLm4gFZaRhjGMjZM8ouuQ8fC7AMTLWNDkDmytbYZY5k";

/** Convert any ipfs:// URI to an amgbearth.myfilebase.com gateway URL */
export function ipfsToGateway(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) return IPFS_GATEWAY + uri.slice(7);
  if (uri.startsWith("ipfs/"))   return IPFS_GATEWAY + uri.slice(5);
  if (uri.startsWith("/ipfs/"))  return IPFS_GATEWAY + uri.slice(6);
  return uri; // already an https:// URL
}

export function tokenMetadataUrl(tokenId: number): string {
  return `${IPFS_GATEWAY}${METADATA_BASE_CID}/${tokenId}`;
}

export function tokenImageUrl(tokenId: number): string {
  return tokenMetadataUrl(tokenId); // same path; returns JSON with image field
}

export interface NFTAttribute {
  trait_type: string;
  value: string | number;
}

export interface NFTMetadata {
  name: string;
  description?: string;
  image: string;
  animation_url?: string;
  attributes: NFTAttribute[];
}

export async function fetchTokenMetadata(tokenId: number): Promise<NFTMetadata | null> {
  try {
    const res = await fetch(tokenMetadataUrl(tokenId), {
      cache: "force-cache",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return (await res.json()) as NFTMetadata;
  } catch {
    return null;
  }
}

/** Fetch metadata from an arbitrary URI (ipfs:// or https://) */
export async function fetchMetadata(uri: string): Promise<NFTMetadata | null> {
  try {
    const url = ipfsToGateway(uri);
    const res = await fetch(url, {
      cache: "force-cache",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    return (await res.json()) as NFTMetadata;
  } catch {
    return null;
  }
}

// Legacy compat export (used by other parts of the codebase)
export function ipfsToHttp(uri: string): string {
  return ipfsToGateway(uri);
}

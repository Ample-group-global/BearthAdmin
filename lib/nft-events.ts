import { ethers } from "ethers";
import BearthNFTArtifact from "./BearthNFT.abi.json";
import { getChainConfigOrDefault } from "./chains";

export type MintPhase = 0 | 1 | 2;

export interface MintedEvent {
  tokenId: number;
  owner: string;
  waveNum: number;
  waveLabel: string;
  mintType: "WL Free" | "Fixed Price" | "Dutch Auction" | "English Auction" | "Admin";
  timestamp: number;
  dateStr: string;
  isRevealed: boolean;
  txHash: string;
  blockNumber: number;
  currentHolder?: string;
  transferred?: boolean;
  gasFeeWei?: bigint;
  gasFeeEth?: string;
}

export interface ContractState {
  phase: number;
  totalMinted: number;
  maxSupply: number;
  sbt: boolean;
  revealCount: number;
  royaltyEnforced: boolean;
  purchaseLimitEnabled: boolean;
  normalMaxPerWallet: number;
}

function waveLabel(waveNum: number): string {
  if (waveNum === 0) return "Admin Mint";
  if (waveNum === 1) return "Wave 1 — Genesis";
  return `Wave ${waveNum}`;
}


export async function fetchMintedEvents(chainId: number): Promise<{
  events: MintedEvent[];
  contractState: ContractState;
}> {
  const config = getChainConfigOrDefault(chainId);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const contract = new ethers.Contract(config.contractAddress, BearthNFTArtifact.abi, provider);

  let contractState: ContractState = {
    phase: 0, totalMinted: 0, maxSupply: 0,
    sbt: false, revealCount: 0,
    royaltyEnforced: true, purchaseLimitEnabled: false, normalMaxPerWallet: 5,
  };
  try {
    const info = await contract.getCollectionInfo();
    contractState = {
      phase: Number(info.phase_),
      totalMinted: Number(info.totalMinted_),
      maxSupply: Number(info.maxSupply_),
      sbt: Boolean(info.sbt_),
      revealCount: Number(info.revealCount_),
      royaltyEnforced: Boolean(info.royaltyEnforced_),
      purchaseLimitEnabled: Boolean(info.purchaseLimitEnabled_),
      normalMaxPerWallet: Number(info.normalMaxPerWallet_),
    };
  } catch {
    // continue without contract state
  }

  const fromBlock = config.deploymentBlock ?? 0;
  let rawEvents: ethers.EventLog[] = [];
  let fetchError: string | null = null;
  try {
    const filter = contract.filters.Minted();
    const latest = await provider.getBlockNumber();
    const CHUNK = 2000;
    const DELAY_MS = 500;

    for (let start = fromBlock; start <= latest; start += CHUNK) {
      const end = Math.min(start + CHUNK - 1, latest);
      try {
        const chunk = (await contract.queryFilter(filter, start, end)) as ethers.EventLog[];
        rawEvents.push(...chunk);
      } catch (chunkErr: unknown) {
        const msg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
        fetchError = `Partial load — stopped at block ${start.toLocaleString()}: ${msg}`;
        break;
      }
      if (end < latest) await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Event fetch failed: ${msg}`);
  }

  if (fetchError && rawEvents.length === 0) {
    throw new Error(fetchError);
  }

  const isRevealed = contractState.revealCount > 0;

  // Determine which wave numbers appeared, then query isDutchWave for each unique paid wave.
  const uniqueWaves = [...new Set(rawEvents.map((ev) => Number((ev.args as unknown as [string, bigint, bigint, bigint])[2])))];
  const dutchWaves = new Set<number>();
  await Promise.allSettled(
    uniqueWaves.filter(w => w >= 2).map(async (w) => {
      try {
        const isDutch = await contract.isDutchWave(w);
        if (isDutch) dutchWaves.add(w);
      } catch { /* wave not configured — ignore */ }
    })
  );

  function resolvedMintType(waveNum: number): MintedEvent["mintType"] {
    if (waveNum === 0) return "Admin";
    if (waveNum === 1) return "WL Free";
    if (dutchWaves.has(waveNum)) return "Dutch Auction";
    return "Fixed Price";
  }

  // Minted event: (address indexed to, uint256 indexed tokenId, uint256 indexed waveNum, uint256 timestamp)
  const events: MintedEvent[] = rawEvents.map((ev) => {
    const args = ev.args as unknown as [string, bigint, bigint, bigint];
    const waveNum = Number(args[2]);
    const ts = Number(args[3]);
    return {
      tokenId: Number(args[1]),
      owner: args[0],
      waveNum,
      waveLabel: waveLabel(waveNum),
      mintType: resolvedMintType(waveNum),
      timestamp: ts,
      dateStr: ts > 0
        ? new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "—",
      isRevealed,
      txHash: ev.transactionHash,
      blockNumber: ev.blockNumber,
    };
  });

  events.sort((a, b) => a.tokenId - b.tokenId);
  return { events, contractState };
}

export async function enrichEvents(
  events: MintedEvent[],
  chainId: number,
  onProgress: (done: number, total: number) => void
): Promise<Map<number, { gasFeeWei: bigint; gasFeeEth: string; currentHolder: string; transferred: boolean }>> {
  const config = getChainConfigOrDefault(chainId);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const contract = new ethers.Contract(config.contractAddress, BearthNFTArtifact.abi, provider);

  const result = new Map<number, { gasFeeWei: bigint; gasFeeEth: string; currentHolder: string; transferred: boolean }>();
  const BATCH = 8;
  const DELAY_MS = 250;

  for (let i = 0; i < events.length; i += BATCH) {
    const batch = events.slice(i, i + BATCH);

    const [receipts, holders] = await Promise.all([
      Promise.allSettled(batch.map((e) => provider.getTransactionReceipt(e.txHash))),
      Promise.allSettled(batch.map((e) => contract.ownerOf(e.tokenId))),
    ]);

    for (let j = 0; j < batch.length; j++) {
      const ev = batch[j];
      let gasFeeWei = 0n;
      let gasFeeEth = "—";
      const receiptResult = receipts[j];
      const receipt = receiptResult.status === "fulfilled" ? receiptResult.value : null;
      if (receipt) {
        const price = receipt.gasPrice ?? 0n;
        gasFeeWei = receipt.gasUsed * BigInt(price);
        gasFeeEth = `${Number(ethers.formatEther(gasFeeWei)).toFixed(6)} ETH`;
      }

      let currentHolder = ev.owner;
      const holderResult = holders[j];
      if (holderResult.status === "fulfilled" && holderResult.value) {
        currentHolder = holderResult.value as string;
      }

      result.set(ev.tokenId, {
        gasFeeWei,
        gasFeeEth,
        currentHolder,
        transferred: currentHolder.toLowerCase() !== ev.owner.toLowerCase(),
      });
    }

    onProgress(Math.min(i + BATCH, events.length), events.length);
    if (i + BATCH < events.length) await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  return result;
}

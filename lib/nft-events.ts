import { ethers } from "ethers";
import BearthNFTArtifact from "./BearthNFT.abi.json";
import { getChainConfigOrDefault } from "./chains";

export type MintPhase = 0 | 1 | 2 | 3;

export interface MintedEvent {
  tokenId: number;
  owner: string;         // original minter
  phase: MintPhase;
  phaseLabel: string;
  mintType: "Owner" | "WL Free" | "Public Free" | "Paid";
  pricePaid: string;     // formatted ETH string e.g. "0 ETH" or "0.0303 ETH"
  pricePaidWei: bigint;  // actual price in wei (0 for free mints)
  timestamp: number;
  dateStr: string;
  sbt: boolean;
  isRevealed: boolean;
  txHash: string;
  blockNumber: number;
  // Enriched fields — populated separately after initial load
  currentHolder?: string;
  transferred?: boolean;
  gasFeeWei?: bigint;
  gasFeeEth?: string;
}

export interface ContractState {
  phase: number;
  totalMinted: number;
  maxSupply: number;
  stage1Minted: number;
  sbt: boolean;
  isRevealed: boolean;
  revealCount: number;
  mintPriceWei: bigint;
  mintPriceEth: string;
}

const PHASE_LABEL: Record<number, string> = {
  0: "Owner",
  1: "WL Free",
  2: "Public Free",
  3: "Paid",
};

const MINT_TYPE: Record<number, MintedEvent["mintType"]> = {
  0: "Owner",
  1: "WL Free",
  2: "Public Free",
  3: "Paid",
};

export async function fetchMintedEvents(chainId: number): Promise<{
  events: MintedEvent[];
  contractState: ContractState;
}> {
  const config = getChainConfigOrDefault(chainId);
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const contract = new ethers.Contract(config.contractAddress, BearthNFTArtifact.abi, provider);

  // Read contract state first
  let contractState: ContractState = {
    phase: 0, totalMinted: 0, maxSupply: 0, stage1Minted: 0,
    sbt: false, isRevealed: false, revealCount: 0,
    mintPriceWei: 0n, mintPriceEth: "0 ETH",
  };
  try {
    const data = await contract.getData();
    // getData() → [phase, counter, MAX_SUPPLY, stage1Minted, sbt, revealCount, limit1, limit2, PRICE]
    const priceWei = BigInt(data[8]);
    contractState = {
      phase: Number(data[0]),
      totalMinted: Number(data[1]),
      maxSupply: Number(data[2]),
      stage1Minted: Number(data[3]),
      sbt: Boolean(data[4]),
      revealCount: Number(data[5]),
      isRevealed: Number(data[5]) > 0,
      mintPriceWei: priceWei,
      mintPriceEth: `${Number(ethers.formatEther(priceWei)).toFixed(4)} ETH`,
    };
  } catch {
    // continue without contract state
  }

  // Fetch Minted events starting from deployment block to avoid full chain scan
  const fromBlock = config.deploymentBlock ?? 0;
  let rawEvents: ethers.EventLog[] = [];
  let fetchError: string | null = null;
  try {
    const filter = contract.filters.Minted();
    const latest = await provider.getBlockNumber();
    const CHUNK = 500;
    const DELAY_MS = 200;

    for (let start = fromBlock; start <= latest; start += CHUNK) {
      const end = Math.min(start + CHUNK - 1, latest);
      try {
        const chunk = (await contract.queryFilter(filter, start, end)) as ethers.EventLog[];
        rawEvents.push(...chunk);
      } catch (chunkErr: unknown) {
        // Surface rate-limit / access errors but keep events found so far
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

  const { mintPriceWei, mintPriceEth, isRevealed } = contractState;

  const events: MintedEvent[] = rawEvents.map((ev) => {
    const args = ev.args as unknown as [string, bigint, bigint, bigint, boolean];
    const phase = Number(args[2]) as MintPhase;
    const isPaid = phase === 3;
    const ts = Number(args[3]);
    return {
      tokenId: Number(args[1]),
      owner: args[0],
      phase,
      phaseLabel: PHASE_LABEL[phase] ?? `Phase ${phase}`,
      mintType: MINT_TYPE[phase] ?? "WL Free",
      pricePaid: isPaid ? mintPriceEth : "0 ETH",
      pricePaidWei: isPaid ? mintPriceWei : 0n,
      timestamp: ts,
      dateStr: ts > 0
        ? new Date(ts * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : "—",
      sbt: args[4],
      isRevealed,
      txHash: ev.transactionHash,
      blockNumber: ev.blockNumber,
    };
  });

  events.sort((a, b) => a.tokenId - b.tokenId);
  return { events, contractState };
}

/** Enriches a batch of events with gas fee and current holder data. */
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

import { ethers } from "ethers";
import BearthNFTArtifact from "./BearthGenesisNFT.abi.json";
import { getChainConfigOrDefault } from "./chains";

export type MintPhase = 0 | 1 | 2;

export interface MintedEvent {
  tokenId: number;
  owner: string;
  waveNum: number;
  waveLabel: string;
  mintType: "WL Free" | "Fixed Price" | "Admin";
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
    const [phase, totalMinted, maxSupply, sbtFlag, purchaseLimit, normalMax,
           transferValidator, ...waveRevealedArr] = await Promise.all([
      contract.currentPhase(),
      contract.totalSupply(),
      contract.MAX_SUPPLY(),
      contract.sbt(),
      contract.purchaseLimitEnabled(),
      contract.normalMaxPerWallet(),
      contract.getTransferValidator(),
      ...[1,2,3,4,5,6,7].map(i => contract.waveRevealed(i).catch(() => false)),
    ]);
    const revealCount = (waveRevealedArr as boolean[]).filter(Boolean).length;
    contractState = {
      phase: Number(phase),
      totalMinted: Number(totalMinted),
      maxSupply: Number(maxSupply),
      sbt: Boolean(sbtFlag),
      revealCount,
      royaltyEnforced: transferValidator !== ethers.ZeroAddress,
      purchaseLimitEnabled: Boolean(purchaseLimit),
      normalMaxPerWallet: Number(normalMax),
    };
  } catch {
    // continue without contract state
  }

  const fromBlock = config.deploymentBlock ?? 0;
  let rawEvents: ethers.EventLog[] = [];
  let fetchError: string | null = null;
  try {
    // Transfer(from=0x0) is the standard ERC721 mint event
    const filter = contract.filters.Transfer(ethers.ZeroAddress, null, null);
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

  // Transfer args: (from, to, tokenId)
  const tokenIds = rawEvents.map((ev) => Number((ev.args as unknown as [string, string, bigint])[2]));

  // Batch: get wave for each token via tokenWave()
  const waveMap = new Map<number, number>();
  await Promise.allSettled(
    tokenIds.map(async (tokenId) => {
      try {
        const wave = await contract.tokenWave(tokenId);
        waveMap.set(tokenId, Number(wave));
      } catch { waveMap.set(tokenId, 0); }
    })
  );

  // Batch: get timestamps from unique blocks
  const uniqueBlocks = [...new Set(rawEvents.map((ev) => ev.blockNumber))];
  const blockTimestamps = new Map<number, number>();
  await Promise.allSettled(
    uniqueBlocks.map(async (blockNum) => {
      try {
        const block = await provider.getBlock(blockNum);
        if (block) blockTimestamps.set(blockNum, block.timestamp);
      } catch { }
    })
  );

  function resolvedMintType(waveNum: number): MintedEvent["mintType"] {
    if (waveNum === 0) return "Admin";
    if (waveNum === 1) return "WL Free";
    return "Fixed Price";
  }

  const events: MintedEvent[] = rawEvents.map((ev) => {
    const args = ev.args as unknown as [string, string, bigint];
    const tokenId = Number(args[2]);
    const owner = args[1];
    const waveNum = waveMap.get(tokenId) ?? 0;
    const ts = blockTimestamps.get(ev.blockNumber) ?? 0;
    return {
      tokenId,
      owner,
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

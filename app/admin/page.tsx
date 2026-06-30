"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { ethers } from "ethers";
import { WalletButton } from "@/components/WalletButton";
import { ChainSelector } from "@/components/ChainSelector";
import { useChain } from "@/lib/ChainContext";
import { FIXED_ADDRESS } from "@/lib/config";
import BearthNFTArtifact from "@/lib/BearthNFT.abi.json";
import Link from "next/link";
import { fetchWhitelist, fetchWhitelistEntries, addWhitelistEntry, saveWhitelist, buildMerkleTree } from "@/lib/whitelist";
// SIWE removed — backend uses simple address-based sessions
import { fetchMetadata, ipfsToHttp } from "@/lib/ipfs";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";

function formatUnixTimestamp(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return "invalid";
  const d = new Date(n * 1000);
  if (isNaN(d.getTime())) return "invalid";
  return d.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short",
  });
}

export default function AdminPage() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { activeChain } = useChain();
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [readContract, setReadContract] = useState<ethers.Contract | null>(null);
  const [readProvider, setReadProvider] = useState<ethers.AbstractProvider | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);

  // State for various inputs
  const [phase, setPhase] = useState("0");
  const [wlRoot, setWlRoot] = useState("");
  const [backendRoot, setBackendRoot] = useState("");
  const [wlStart, setWlStart] = useState("");
  const [wlEnd, setWlEnd] = useState("");
  const [limit1, setLimit1] = useState("1");
  const [limit2, setLimit2] = useState("3");
  const [sbtEnabled, setSbtEnabled] = useState(true);
  const [revealURI, setRevealURI] = useState("");
  const [baseURI1, setBaseURI1] = useState("");
  const [baseURI2, setBaseURI2] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [emergencyTokenId, setEmergencyTokenId] = useState("");
  const [emergencyFrom, setEmergencyFrom] = useState("");
  const [emergencyTo, setEmergencyTo] = useState("");
  const [emergencyReason, setEmergencyReason] = useState("");
  const [royaltyReceiver, setRoyaltyReceiver] = useState("");
  const [royaltyBps, setRoyaltyBps] = useState("500");
  const [pauseAccountAddr, setPauseAccountAddr] = useState("");
  const [unpauseAccountAddr, setUnpauseAccountAddr] = useState("");
  const [whitelistAddresses, setWhitelistAddresses] = useState("");
  const [whitelistList, setWhitelistList] = useState<string[]>([]);
  const [wlSavedList, setWlSavedList] = useState<string[]>([]); // last-saved snapshot
  const [wlLoading, setWlLoading] = useState(false);
  const [wlSaving, setWlSaving] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");
  const [airdropAmount, setAirdropAmount] = useState("0.001");
  const [airdropSending, setAirdropSending] = useState(false);
  const [airdropProgress, setAirdropProgress] = useState<{
    sent: number;
    total: number;
    failed: { address: string; error: string }[];
  } | null>(null);
  const [nameByAddress, setNameByAddress] = useState<Record<string, string>>({});
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [bulkInput, setBulkInput] = useState("");
  const [wlSearch, setWlSearch] = useState("");
  const [wlSelected, setWlSelected] = useState<Set<string>>(new Set());
  const [batchMintTo, setBatchMintTo] = useState("");
  const [batchMintAmount, setBatchMintAmount] = useState("1");
  const [generatedWallet, setGeneratedWallet] = useState<{
    address: string;
    privateKey: string;
    mnemonic: string;
  } | null>(null);
  const [fundAmount, setFundAmount] = useState("0.001");

  // Check metadata state
  const [checkTokenId, setCheckTokenId] = useState("");
  const [checkTokenURI, setCheckTokenURI] = useState("");
  const [checkMetadata, setCheckMetadata] = useState<any>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState("");

  // Demo whitelist address
  const DEMO_WHITELIST_ADDRESS = "0xF28258A4F42d073653C0E3Ed9d09e855273f3D44";

  // Transaction state
  const [txHash, setTxHash] = useState<string>("");
  const [txPending, setTxPending] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);

  // Modal state
  const [modal, setModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "info";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showModal = (title: string, message: string, type: "success" | "error" | "info" = "info") => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  // Read contract data state
  const [currentPhase, setCurrentPhase] = useState<bigint>();
  const [readError, setReadError] = useState<string | null>(null);
  const [sbtMode, setSbtMode] = useState<boolean>();
  const [revealed, setRevealed] = useState<boolean>();
  const [contractData, setContractData] = useState<any>();
  const [currentRoot, setCurrentRoot] = useState<string>("");
  const [currentWlStart, setCurrentWlStart] = useState<bigint>();
  const [currentWlEnd, setCurrentWlEnd] = useState<bigint>();
  const [stage1Minted, setStage1Minted] = useState<bigint>();
  const [isSafeWallet, setIsSafeWallet] = useState<boolean>(false);
  const [hasWithdrawerRole, setHasWithdrawerRole] = useState<boolean>(false);
  const [hasEmergencyRole, setHasEmergencyRole] = useState<boolean>(false);

  // Backend session state (auto-created by useBackendSession on wallet connect)
  const [siweLoggedIn, setSiweLoggedIn] = useState(false);
  const [siweLoading, setSiweLoading] = useState(false);

  const address = wallets[0]?.address;
  const phaseNames = ["None", "WL", "Public", "Paid"];

  // Initialize provider, signer, and contract
  useEffect(() => {
    const wallet = wallets?.[0];
    if (!authenticated || !ready || !wallet) return;

    const initProvider = async () => {
      try {
        await wallet.switchChain(activeChain.chainId);

        const eip1193 = await wallet.getEthereumProvider();
        const ethersProvider = new ethers.BrowserProvider(eip1193);

        const ethersSigner = await ethersProvider.getSigner();
        const contractInstance = new ethers.Contract(
          activeChain.contractAddress,
          BearthNFTArtifact.abi,
          ethersSigner
        );

        setProvider(ethersProvider);
        setSigner(ethersSigner);
        setContract(contractInstance);
      } catch (error) {
        console.error("Error initializing provider:", error);
      }
    };
    initProvider();
  }, [authenticated, ready, wallets, activeChain]);

  // Create read provider/contract. Prefer the wallet's provider when connected so
  // reads come from the same node that received the tx (no public-RPC lag).
  useEffect(() => {
    if (provider) {
      setReadProvider(provider);
      setReadContract(new ethers.Contract(activeChain.contractAddress, BearthNFTArtifact.abi, provider));
      return;
    }
    const rpc = new ethers.JsonRpcProvider(activeChain.rpcUrl);
    setReadProvider(rpc);
    setReadContract(new ethers.Contract(activeChain.contractAddress, BearthNFTArtifact.abi, rpc));
  }, [activeChain, provider]);

  // Read contract data
  const fetchContractData = useCallback(async () => {
    if (!readContract) return;
    try {
      const baseReads = [
        readContract.phase(),
        readContract.sbt(),
        readContract.getData(),
        readContract.root(),
        readContract.wlStart(),
        readContract.wlEnd(),
      ];
      const roleReads = address
        ? [
          readContract.WITHDRAWER_ROLE().then((role: string) => readContract.hasRole(role, address)),
          readContract.EMERGENCY_ROLE().then((role: string) => readContract.hasRole(role, address)),
        ]
        : [];
      const results = await Promise.allSettled([...baseReads, ...roleReads]);
      const val = (i: number) => results[i] && results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<any>).value : undefined;
      const phaseReason = results[0]?.status === "rejected" ? (results[0] as PromiseRejectedResult).reason : null;
      if (phaseReason) {
        console.error("phase() read failed:", phaseReason);
        setReadError(`phase() read failed on ${activeChain.name}: ${phaseReason?.shortMessage || phaseReason?.message || phaseReason}`);
      } else {
        setReadError(null);
      }
      // Only overwrite currentPhase when the read actually succeeded — never silently fall back to 0
      if (val(0) !== undefined) setCurrentPhase(val(0));
      if (val(1) !== undefined) setSbtMode(val(1));
      if (val(2) !== undefined) {
        setContractData(val(2));
        // getData returns: [phase, totalSupply, maxSupply, stage1Minted, revealed, sbt, limit1, limit2]
        setStage1Minted(val(2)[3]);
        setRevealed(val(2)[4]);
      }
      if (val(3) !== undefined) setCurrentRoot(val(3));
      if (val(4) !== undefined) setCurrentWlStart(val(4));
      if (val(5) !== undefined) setCurrentWlEnd(val(5));
      if (address) {
        if (val(6) !== undefined) setHasWithdrawerRole(val(6));
        if (val(7) !== undefined) setHasEmergencyRole(val(7));
        // Check if address is a Safe wallet (contract wallet)
        if (readProvider) {
          try {
            const code = await readProvider.getCode(address);
            setIsSafeWallet(code !== '0x');
          } catch { }
        }
      }
    } catch (error: any) {
      console.error("Error reading contract:", error);
      setReadError(`Read failed on ${activeChain.name}: ${error?.shortMessage || error?.message || error}`);
    }
  }, [readContract, readProvider, address, activeChain]);

  useEffect(() => {
    fetchContractData();
  }, [fetchContractData]);

  // Auto-generate whitelist times from blockchain time
  useEffect(() => {
    if (readProvider && !wlStart && !wlEnd) {
      readProvider.getBlock("latest").then((block) => {
        if (block) {
          const start = block.timestamp + 60; // 1 minute from now
          const end = start + 7 * 24 * 60 * 60; // 1 week later
          setWlStart(String(start));
          setWlEnd(String(end));
        }
      });
    }
  }, [readProvider]);

  // Load saved whitelist addresses on mount
  const loadWhitelist = useCallback(async () => {
    setWlLoading(true);
    try {
      const entries = await fetchWhitelistEntries();
      if (entries.length > 0) {
        const addresses = entries.map((e) => e.address);
        const nameMap: Record<string, string> = {};
        for (const e of entries) {
          if (e.name) nameMap[e.address.toLowerCase()] = e.name;
        }
        setWhitelistList(addresses);
        setWlSavedList(addresses);
        setWhitelistAddresses(addresses.join(","));
        setNameByAddress(nameMap);
      } else {
        // Fallback for non-admin or empty list
        const addresses = await fetchWhitelist();
        setWhitelistList(addresses);
        setWlSavedList(addresses);
        setWhitelistAddresses(addresses.join(","));
        setNameByAddress({});
      }
      setWlSelected(new Set());
    } catch {
      // keep existing state
    } finally {
      setWlLoading(false);
    }
    // Fetch backend's reported merkle root (independent of on-chain / local).
    try {
      const res = await fetch(`${API_BASE}/api/whitelist/merkle-root`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setBackendRoot(data.root ?? "");
      } else {
        setBackendRoot("");
      }
    } catch {
      setBackendRoot("");
    }
  }, []);

  useEffect(() => {
    loadWhitelist();
  }, [loadWhitelist]);

  // Auto-verify backend session when wallet is connected, then load whitelist
  useEffect(() => {
    if (!authenticated || !address || !API_BASE) return;
    const verify = async () => {
      try {
        let res = await fetch(`${API_BASE}/api/auth/verify`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setSiweLoggedIn(true);
            loadWhitelist();
            return;
          }
        }
        // Session not yet created by hook, create it directly
        res = await fetch(`${API_BASE}/api/auth/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ address }),
        });
        if (res.ok) {
          setSiweLoggedIn(true);
          loadWhitelist();
        }
      } catch { }
    };
    const timer = setTimeout(verify, 500);
    return () => clearTimeout(timer);
  }, [authenticated, address, loadWhitelist]);

  // Sync whitelistAddresses string when list changes
  useEffect(() => {
    setWhitelistAddresses(whitelistList.join(","));
  }, [whitelistList]);

  // Auto-compute Merkle root from the currently SELECTED addresses (or the
  // full list when nothing is selected). This way the dashboard's checkboxes
  // drive what gets pushed on-chain.
  useEffect(() => {
    const source =
      wlSelected.size > 0
        ? whitelistList.filter((a) => wlSelected.has(a.toLowerCase()))
        : whitelistList;
    if (source.length === 0) {
      setWlRoot("");
      return;
    }
    try {
      const { root } = buildMerkleTree(source);
      setWlRoot(root);
    } catch {
      // Ignore — leave previous root if tree build fails
    }
  }, [whitelistList, wlSelected]);

  // Detect unsaved changes
  const wlHasChanges = (() => {
    if (whitelistList.length !== wlSavedList.length) return true;
    const saved = new Set(wlSavedList.map((a) => a.toLowerCase()));
    return whitelistList.some((a) => !saved.has(a.toLowerCase()));
  })();

  const handleAddAddress = async () => {
    const addr = newAddress.trim();
    const name = newName.trim();
    if (!addr || !ethers.isAddress(addr)) {
      showModal("Error", "Invalid Ethereum address", "error");
      return;
    }
    if (whitelistList.some((a) => a.toLowerCase() === addr.toLowerCase())) {
      showModal("Error", "Address already in whitelist", "error");
      return;
    }
    setWhitelistList((prev) => [...prev, addr]);
    if (name) {
      setNameByAddress((prev) => ({ ...prev, [addr.toLowerCase()]: name }));
    }
    setNewAddress("");
    setNewName("");
    // Persist the (address, name) pair immediately so the name reaches the
    // backend even before the user hits "SAVE & GENERATE ROOT".
    if (siweLoggedIn && name) {
      await addWhitelistEntry(addr, name);
    }
  };

  const handleRemoveAddress = (addr: string) => {
    setWhitelistList((prev) => prev.filter((a) => a.toLowerCase() !== addr.toLowerCase()));
    setWlSelected((prev) => {
      const next = new Set(prev);
      next.delete(addr.toLowerCase());
      return next;
    });
  };

  const handleRemoveSelected = () => {
    if (wlSelected.size === 0) return;
    setWhitelistList((prev) => prev.filter((a) => !wlSelected.has(a.toLowerCase())));
    setWlSelected(new Set());
  };

  const handleToggleSelect = (addr: string) => {
    setWlSelected((prev) => {
      const next = new Set(prev);
      const key = addr.toLowerCase();
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    const filtered = whitelistList.filter(
      (a) => !wlSearch || a.toLowerCase().includes(wlSearch.toLowerCase())
    );
    const allSelected = filtered.every((a) => wlSelected.has(a.toLowerCase()));
    if (allSelected) {
      setWlSelected(new Set());
    } else {
      setWlSelected(new Set(filtered.map((a) => a.toLowerCase())));
    }
  };

  const handleCopyAddresses = () => {
    const toCopy = wlSelected.size > 0
      ? whitelistList.filter((a) => wlSelected.has(a.toLowerCase()))
      : whitelistList;
    navigator.clipboard.writeText(toCopy.join("\n"));
    showModal("Copied", `${toCopy.length} address${toCopy.length !== 1 ? "es" : ""} copied to clipboard`, "info");
  };

  const handleDiscardChanges = () => {
    setWhitelistList([...wlSavedList]);
    setWlSelected(new Set());
  };

  const handleBulkAdd = () => {
    const addrs = bulkInput
      .split(/[\n,]+/)
      .map((a) => a.trim())
      .filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    const existing = new Set(whitelistList.map((a) => a.toLowerCase()));
    for (const addr of addrs) {
      if (!ethers.isAddress(addr)) {
        invalid.push(addr);
      } else if (!existing.has(addr.toLowerCase())) {
        valid.push(addr);
        existing.add(addr.toLowerCase());
      }
    }
    if (invalid.length > 0) {
      showModal("Warning", `${valid.length} added, ${invalid.length} invalid:\n${invalid.slice(0, 5).join("\n")}${invalid.length > 5 ? "\n..." : ""}`, "info");
    }
    setWhitelistList((prev) => [...prev, ...valid]);
    setBulkInput("");
    setShowBulkAdd(false);
  };

  // Airdrop the same amount of ETH to every selected whitelist address (sequential).
  const handleAirdropSelected = async () => {
    if (!signer) {
      showModal("Wallet Not Connected", "Connect your admin wallet first to sign transactions.", "error");
      return;
    }
    const recipients = whitelistList.filter((a) => wlSelected.has(a.toLowerCase()));
    if (recipients.length === 0) {
      showModal("No Recipients", "Select at least one address in the whitelist table.", "error");
      return;
    }
    let value: bigint;
    try {
      value = ethers.parseEther(airdropAmount.trim() || "0");
      if (value <= 0n) throw new Error("amount must be > 0");
    } catch {
      showModal("Invalid Amount", "Enter a valid ETH amount (e.g. 0.001).", "error");
      return;
    }

    // Pre-flight: ensure signer balance covers nominal value (gas excluded).
    try {
      const signerAddr = await signer.getAddress();
      const balance = await (signer.provider ?? readProvider)!.getBalance(signerAddr);
      const required = value * BigInt(recipients.length);
      if (balance < required) {
        showModal(
          "Insufficient Balance",
          `Need at least ${ethers.formatEther(required)} ETH (plus gas) but wallet has ${ethers.formatEther(balance)} ETH.`,
          "error"
        );
        return;
      }
    } catch {
      // Non-fatal — let the tx itself fail with a clearer revert reason.
    }

    const totalEth = ethers.formatEther(value * BigInt(recipients.length));
    const confirmed = window.confirm(
      `Airdrop ${airdropAmount} ETH to ${recipients.length} address${recipients.length !== 1 ? "es" : ""} ` +
      `on ${activeChain.name}?\n\nTotal: ${totalEth} ETH (plus gas per tx).`
    );
    if (!confirmed) return;

    setAirdropSending(true);
    setAirdropProgress({ sent: 0, total: recipients.length, failed: [] });

    const failed: { address: string; error: string }[] = [];
    for (let i = 0; i < recipients.length; i++) {
      const to = recipients[i];
      try {
        const tx = await signer.sendTransaction({ to, value });
        await tx.wait();
        setAirdropProgress({ sent: i + 1, total: recipients.length, failed: [...failed] });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ address: to, error: msg });
        setAirdropProgress({ sent: i + 1, total: recipients.length, failed: [...failed] });
      }
    }

    setAirdropSending(false);
    const succeeded = recipients.length - failed.length;
    if (failed.length === 0) {
      showModal(
        "Airdrop Complete",
        `Sent ${airdropAmount} ETH to ${succeeded} address${succeeded !== 1 ? "es" : ""}.`,
        "success"
      );
    } else {
      showModal(
        "Airdrop Finished With Errors",
        `Sent: ${succeeded} / ${recipients.length}\nFailed: ${failed.length}\n\n` +
        failed.slice(0, 5).map((f) => `${f.address.slice(0, 10)}…  ${f.error.slice(0, 80)}`).join("\n") +
        (failed.length > 5 ? `\n…and ${failed.length - 5} more` : ""),
        "error"
      );
    }
  };

  // Generate Merkle Root and save whitelist
  const generateMerkleRoot = async () => {
    setWlSaving(true);
    try {
      const allAddrs = whitelistAddresses.split(",").map((a) => a.trim()).filter(Boolean);
      const addresses =
        wlSelected.size > 0
          ? allAddrs.filter((a) => wlSelected.has(a.toLowerCase()))
          : allAddrs;
      if (siweLoggedIn) {
        // Use auth-protected endpoint — returns the authoritative root
        const root = await submitWhitelistToAPI(addresses);
        if (!root) return;
        setWlRoot(root);

        // Verify against the backend's persisted root (independent of the
        // write response) so the admin sees what was actually stored.
        let verifiedRoot = root;
        let override = false;
        try {
          const res = await fetch(`${API_BASE}/api/whitelist/merkle-root`, {
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            verifiedRoot = data.root ?? root;
            override = Boolean(data.manual_override);
            setBackendRoot(verifiedRoot);
          }
        } catch {
          // non-fatal — fall back to write-response root
        }

        // Refresh saved snapshot so the "unsaved changes" indicator clears
        setWlSavedList([...addresses]);

        const matches = verifiedRoot.toLowerCase() === root.toLowerCase();
        const lines = [
          `Backend saved ${addresses.length} address${addresses.length !== 1 ? "es" : ""}.`,
          ``,
          `Write-response root:  ${root}`,
          `Backend stored root:  ${verifiedRoot}`,
          matches ? `✓ Backend root matches.` : `⚠ Backend root differs from write response.`,
          override ? `⚠ Manual override is ACTIVE — backend will not auto-recalc on add/delete.` : ``,
        ].filter(Boolean);
        showModal(
          matches && !override ? "Backend Root Set" : "Backend Root Set (with warnings)",
          lines.join("\n"),
          matches && !override ? "success" : "info"
        );
      } else {
        // Fall back to client-side (unauthenticated) — root only, no server save
        const { root } = buildMerkleTree(addresses);
        setWlRoot(root);
        await saveWhitelist(addresses);
        showModal("Success", `Merkle Root Generated: ${root}\nWhitelist saved (${addresses.length} addresses)`, "success");
      }
    } catch (error) {
      showModal("Error", "Error generating merkle root: " + error, "error");
    } finally {
      setWlSaving(false);
    }
  };

  // Quick setup demo whitelist
  const handleQuickSetupWhitelist = async () => {
    if (!contract) {
      showModal("Error", "Contract not initialized", "error");
      return;
    }

    try {
      const USER_ADDR1 = "0xdb01f7dfefa1aae19a2204a4ffa42dd7ec583afd";
      const USER_ADDR2 = "0xF28258A4F42d073653C0E3Ed9d09e855273f3D44";
      const addresses = [USER_ADDR1, USER_ADDR2];
      setWhitelistAddresses(addresses.join(","));

      // Generate merkle root
      const { root } = buildMerkleTree(addresses);
      setWlRoot(root);

      // Save whitelist to API
      await saveWhitelist(addresses);

      // Get current blockchain time
      const provider = await contract.runner?.provider;
      if (!provider) {
        showModal("Error", "Provider not available", "error");
        return;
      }

      const block = await provider.getBlock("latest");
      if (!block) {
        showModal("Error", "Could not get latest block", "error");
        return;
      }

      const now = block.timestamp;
      const startTime = now + 60; // Start 20 seconds from now
      const endTime = now + 3600; // End 1 hour from now

      setWlStart(startTime.toString());
      setWlEnd(endTime.toString());

      // Automatically set the whitelist on-chain
      await executeTransaction(
        contract.setWL(root, BigInt(startTime), BigInt(endTime))
      );

      showModal("Success", `Demo Whitelist Setup Complete!\nAddress: ${DEMO_WHITELIST_ADDRESS}\nRoot: ${root}\nStart: ${startTime}\nEnd: ${endTime}`, "success");
    } catch (error) {
      console.error("Quick setup error:", error);
      showModal("Error", "Failed to setup whitelist: " + (error instanceof Error ? error.message : error), "error");
    }
  };

  // Helper function to execute transactions
  const executeTransaction = async (txPromise: Promise<any>) => {
    try {
      setTxPending(true);
      setTxSuccess(false);
      setTxHash("");

      const tx = await txPromise;
      setTxHash(tx.hash);

      const receipt = await tx.wait();
      setTxSuccess(true);
      setTxPending(false);

      // Public read RPC can lag behind the broadcast RPC. Poll a few times so
      // the UI reflects the new state instead of a stale read.
      for (let i = 0; i < 5; i++) {
        await fetchContractData();
        await new Promise((r) => setTimeout(r, 1500));
      }
    } catch (error: any) {
      console.error("Transaction error:", error);
      showModal("Transaction Failed", error?.message || error, "error");
      setTxPending(false);
    }
  };

  // Admin Functions
  const handleSetPhase = () => {
    if (!contract) return;
    executeTransaction(contract.setPhase(BigInt(phase)));
  };

  const handleSetWL = async () => {
    if (!contract) {
      showModal("Wallet Not Connected", "Connect your wallet first to sign the transaction.", "error");
      return;
    }

    // Validate inputs
    if (!wlRoot || !wlStart || !wlEnd) {
      showModal("Validation Error", "Please fill in all whitelist fields (root, start time, end time)", "error");
      return;
    }

    try {
      const startTimestamp = BigInt(wlStart);
      const endTimestamp = BigInt(wlEnd);

      if (endTimestamp <= startTimestamp) {
        showModal("Validation Error", "End time must be after start time", "error");
        return;
      }

      executeTransaction(contract.setWL(wlRoot, startTimestamp, endTimestamp));
    } catch (error) {
      showModal("Error", "Invalid timestamp format", "error");
    }
  };

  const handleSetWhitelist = async () => {
    if (!contract) {
      showModal("Wallet Not Connected", "Connect your wallet first to sign the transaction.", "error");
      return;
    }

    if (!wlRoot) {
      showModal("Validation Error", "Please fill in the merkle root", "error");
      return;
    }

    executeTransaction(contract.setWhitelist(wlRoot));
  };

  const handleSetWLTimes = async () => {
    if (!contract) return;

    // Validate inputs
    if (!wlStart || !wlEnd) {
      showModal("Validation Error", "Please fill in start and end times", "error");
      return;
    }

    try {
      const startTimestamp = BigInt(wlStart);
      const endTimestamp = BigInt(wlEnd);

      // Validate timestamps
      if (endTimestamp <= startTimestamp) {
        showModal("Validation Error", "End time must be after start time", "error");
        return;
      }

      executeTransaction(
        contract.setWLTimes(startTimestamp, endTimestamp)
      );
    } catch (error) {
      showModal("Error", "Invalid timestamp format", "error");
    }
  };

  // Verify backend session (auto-created by useBackendSession hook on wallet connect)
  const handleSiweLogin = async () => {
    if (!address) return;
    setSiweLoading(true);
    try {
      // Session is auto-created by useBackendSession, just verify it
      const res = await fetch(`${API_BASE}/api/auth/verify`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setSiweLoggedIn(true);
          loadWhitelist();
          showModal("Success", "Signed in as admin. You can now manage the whitelist.", "success");
        } else {
          // Session not yet created, create it now
          const sessionRes = await fetch(`${API_BASE}/api/auth/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ address }),
          });
          if (sessionRes.ok) {
            setSiweLoggedIn(true);
            loadWhitelist();
            showModal("Success", "Signed in as admin. You can now manage the whitelist.", "success");
          } else {
            showModal("Error", "Failed to create session", "error");
          }
        }
      } else {
        showModal("Error", "Failed to verify session", "error");
      }
    } catch (e) {
      showModal("Error", "Sign-in failed: " + (e instanceof Error ? e.message : String(e)), "error");
    }
    setSiweLoading(false);
  };

  const handleSiweLogout = async () => {
    await fetch(`${API_BASE}/api/auth/session`, { method: "DELETE", credentials: "include" });
    setSiweLoggedIn(false);
  };

  // Submit whitelist to protected API endpoint, returns new Merkle root
  // Replaces the entire whitelist: removes addresses not in the new list, then adds new ones
  const submitWhitelistToAPI = async (addresses: string[]): Promise<string | null> => {
    // Fetch current list and remove addresses not in the new set
    const current = await fetchWhitelist();
    const newSet = new Set(addresses.map((a) => a.toLowerCase()));
    const toRemove = current.filter((a) => !newSet.has(a.toLowerCase()));

    await Promise.all(
      toRemove.map((addr) =>
        fetch(`${API_BASE}/api/whitelist/${addr}`, {
          method: "DELETE",
          credentials: "include",
        })
      )
    );

    // Add new addresses (backend deduplicates)
    const res = await fetch(`${API_BASE}/api/whitelist/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ addresses }),
    });
    if (res.status === 401) {
      showModal("Error", "Not signed in. Please sign in with SIWE first.", "error");
      setSiweLoggedIn(false);
      return null;
    }
    if (!res.ok) {
      const { error } = await res.json();
      showModal("Error", error ?? "Failed to save whitelist", "error");
      return null;
    }
    const data = await res.json();
    // Backend returns `merkle_root` on BulkWriteResponse; tolerate `root` for older payloads.
    return data.merkle_root ?? data.root ?? null;
  };

  const handleSetLimits = () => {
    if (!contract) return;
    executeTransaction(contract.setLimits(BigInt(limit1), BigInt(limit2)));
  };

  const handleSetSBT = () => {
    if (!contract) return;
    executeTransaction(contract.setSBT(sbtEnabled));
  };

  const handleReveal = () => {
    if (!contract) return;
    executeTransaction(contract.reveal(revealURI));
  };

  const handleSetBaseURI1 = () => {
    if (!contract) return;
    executeTransaction(contract.setBaseURI1(baseURI1));
  };

  const handleSetBaseURI2 = () => {
    if (!contract) return;
    executeTransaction(contract.setBaseURI2(baseURI2));
  };

  const handleWithdraw = () => {
    if (!contract) return;
    executeTransaction(contract.withdraw(withdrawAddress));
  };

  const handleEmergencyTransfer = () => {
    if (!contract) return;
    executeTransaction(
      contract.emergencyTransfer(
        BigInt(emergencyTokenId),
        emergencyFrom,
        emergencyTo,
        emergencyReason
      )
    );
  };

  const handleSetRoyalty = () => {
    if (!contract) return;
    executeTransaction(contract.setRoyalty(royaltyReceiver, BigInt(royaltyBps)));
  };

  const handlePause = () => {
    if (!contract) return;
    executeTransaction(contract.pause());
  };

  const handleUnpause = () => {
    if (!contract) return;
    executeTransaction(contract.unpause());
  };

  const handlePauseAccount = () => {
    if (!contract) return;
    executeTransaction(contract.pauseAccount(pauseAccountAddr));
  };

  const handleUnpauseAccount = () => {
    if (!contract) return;
    executeTransaction(contract.unpauseAccount(unpauseAccountAddr));
  };

  const handleBatchMint = () => {
    if (!contract) return;
    if (!batchMintTo || !batchMintAmount) {
      showModal("Validation Error", "Please fill in address and amount", "error");
      return;
    }
    executeTransaction(contract.batchMint(batchMintTo, BigInt(batchMintAmount)));
  };

  const handleGenerateWallet = () => {
    const wallet = ethers.Wallet.createRandom();
    setGeneratedWallet({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || "",
    });
  };

  const handleFundWallet = async () => {
    if (!signer || !generatedWallet) return;
    try {
      setTxPending(true);
      setTxSuccess(false);
      setTxHash("");

      const tx = await signer.sendTransaction({
        to: generatedWallet.address,
        value: ethers.parseEther(fundAmount),
      });
      setTxHash(tx.hash);

      await tx.wait();
      setTxSuccess(true);
      setTxPending(false);
    } catch (error: any) {
      console.error("Fund wallet error:", error);
      showModal("Transaction Failed", error?.message || String(error), "error");
      setTxPending(false);
    }
  };

  const handleGenerateAndFund = async () => {
    if (!signer) return;
    const wallet = ethers.Wallet.createRandom();
    setGeneratedWallet({
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic?.phrase || "",
    });

    try {
      setTxPending(true);
      setTxSuccess(false);
      setTxHash("");

      const tx = await signer.sendTransaction({
        to: wallet.address,
        value: ethers.parseEther(fundAmount),
      });
      setTxHash(tx.hash);

      await tx.wait();
      setTxSuccess(true);
      setTxPending(false);
    } catch (error: any) {
      console.error("Fund wallet error:", error);
      showModal("Transaction Failed", error?.message || String(error), "error");
      setTxPending(false);
    }
  };

  // Check metadata handler
  const handleCheckMetadata = async () => {
    debugger
    if (!contract || !checkTokenId) return;
    setCheckLoading(true);
    setCheckError("");
    setCheckTokenURI("");
    setCheckMetadata(null);
    try {
      const uri = await contract.tokenURI(BigInt(checkTokenId));
      console.log('URI', uri)
      setCheckTokenURI(uri);
      const meta = await fetchMetadata(uri);
      console.log('meta', meta)
      if (meta) {
        setCheckMetadata(meta);
      } else {
        setCheckError("Metadata fetch returned null (IPFS may be unreachable)");
      }
    } catch (e: any) {
      setCheckError(e?.message || String(e));
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <div className="min-h-screen crt-overlay" style={{ background: "var(--bg-crt)", color: "var(--text)" }}>
      <div className="container mx-auto px-4 py-8 max-w-[1280px]">
        <div className="flex justify-between items-center mb-8">
          <div>
            <Link href="/" className="font-mono" style={{ color: "var(--cyan)" }}>&larr; Back to Home</Link>
            <h1 className="text-4xl font-bold font-mono mt-2 glow-green" style={{ color: "var(--green)" }}>Admin Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <ChainSelector />
            <WalletButton />
          </div>
        </div>

        {!authenticated && (
          <div className="panel-retro p-4 mb-8" style={{ borderColor: "var(--amber)" }}>
            <p className="font-mono" style={{ color: "var(--amber)" }}>Please connect your wallet to use admin functions.</p>
          </div>
        )}

        {/* Contract Info */}
        <div className="panel-retro p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold font-mono glow-green" style={{ color: "var(--green)" }}>Contract Information</h2>
            <button
              onClick={fetchContractData}
              disabled={!readContract}
              className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
            >
              <span>🔄</span> Refresh
            </button>
          </div>

          {readError && (
            <div className="panel-retro p-3 mb-4" style={{ borderColor: "#FF3B30", background: "rgba(255,59,48,0.08)" }}>
              <p className="text-xs font-mono" style={{ color: "#FF3B30" }}>⚠ {readError}</p>
            </div>
          )}

          <div className="panel-retro p-3 mb-4" style={{ borderColor: "var(--amber)" }}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                <span style={{ color: "var(--text-muted)" }}>On-chain phase: </span>
                <span style={{ color: "var(--amber)", fontWeight: 700 }}>
                  {currentPhase !== undefined ? `${Number(currentPhase)} (${phaseNames[Number(currentPhase)] ?? "?"})` : "—"}
                </span>
                <span style={{ color: "var(--text-muted)" }}> · {activeChain.name} · </span>
                <a
                  href={`${activeChain.blockExplorer}/address/${activeChain.contractAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#00E5FF", textDecoration: "underline" }}
                >
                  {activeChain.contractAddress.slice(0, 6)}…{activeChain.contractAddress.slice(-4)}
                </a>
              </div>
            </div>
          </div>

          {/* Current Stage Indicator */}
          <div className="panel-retro p-4 mb-6" style={{ borderColor: "var(--amber)" }}>
            <p className="text-sm font-mono mb-3" style={{ color: "var(--text-muted)" }}>Current Demo Stage:</p>
            <div className="flex gap-3 items-center">
              <div className={`flex-1 text-center py-3 rounded-sm font-bold font-mono ${currentPhase !== undefined && Number(currentPhase) === 1 ? '' : ''}`} style={currentPhase !== undefined && Number(currentPhase) === 1 ? { background: "var(--green)", color: "var(--bg-crt)" } : { background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                1. Whitelist
              </div>
              <div className={`flex-1 text-center py-3 rounded-sm font-bold font-mono`} style={currentPhase !== undefined && Number(currentPhase) === 2 ? { background: "var(--green)", color: "var(--bg-crt)" } : { background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                2. Public Mint
              </div>
              <div className={`flex-1 text-center py-3 rounded-sm font-bold font-mono`} style={currentPhase !== undefined && Number(currentPhase) === 3 ? { background: "var(--green)", color: "var(--bg-crt)" } : { background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                3. Paid Mint
              </div>
              <div className={`flex-1 text-center py-3 rounded-sm font-bold font-mono`} style={revealed ? { background: "var(--amber)", color: "var(--bg-crt)" } : { background: "rgba(255,255,255,0.05)", color: "var(--text-muted)" }}>
                4. Revealed
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 text-sm">
            <div className="col-span-2 panel-retro p-4" style={{ borderColor: "var(--amber)" }}>
              <p className="font-mono text-xs mb-1" style={{ color: "var(--text-muted)" }}>Current Phase</p>
              <p className="text-3xl font-bold font-mono" style={{ color: "var(--amber)" }}>{currentPhase !== undefined ? phaseNames[Number(currentPhase)] : "Loading..."}</p>
            </div>
            <div>
              <p className="font-mono" style={{ color: "var(--text-muted)" }}>Total Supply:</p>
              <p className="text-lg font-bold font-mono">{contractData ? `${contractData[1]?.toString()} / ${contractData[2]?.toString()}` : "Loading..."}</p>
            </div>
            <div>
              <p className="font-mono" style={{ color: "var(--text-muted)" }}>Stage 1 Minted:</p>
              <p className="text-lg font-bold font-mono">{stage1Minted?.toString() || "0"}</p>
            </div>
            <div>
              <p className="font-mono" style={{ color: "var(--text-muted)" }}>Revealed:</p>
              <p className="text-lg font-bold font-mono">{revealed !== undefined ? (revealed ? "✅ Yes" : "❌ No") : "Loading..."}</p>
            </div>
            {contractData && (
              <>
                <div>
                  <p className="font-mono" style={{ color: "var(--text-muted)" }}>SBT Mode:</p>
                  <p className="text-lg font-bold font-mono">{sbtMode !== undefined ? (sbtMode ? "🔒 Enabled" : "🔓 Disabled") : "Loading..."}</p>
                </div>
                <div>
                  <p className="font-mono" style={{ color: "var(--text-muted)" }}>Mint Limits:</p>
                  <p className="text-lg font-bold font-mono">L1: {contractData[6]?.toString()} | L2: {contractData[7]?.toString()}</p>
                </div>
              </>
            )}
            <div className="col-span-2 panel-retro p-4" style={{ borderColor: "var(--cyan)" }}>
              <p className="font-mono text-xs mb-2" style={{ color: "var(--text-muted)" }}>Current Whitelist Root</p>
              <p className="font-mono text-xs break-all" style={{ color: "var(--cyan)" }}>{currentRoot || "Not set"}</p>
            </div>
            <div>
              <p className="font-mono" style={{ color: "var(--text-muted)" }}>WL Start Time:</p>
              <p className="text-sm font-mono">{currentWlStart ? new Date(Number(currentWlStart) * 1000).toLocaleString() : "Not set"}</p>
              <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{currentWlStart?.toString()}</p>
            </div>
            <div>
              <p className="font-mono" style={{ color: "var(--text-muted)" }}>WL End Time:</p>
              <p className="text-sm font-mono">{currentWlEnd ? new Date(Number(currentWlEnd) * 1000).toLocaleString() : "Not set"}</p>
              <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>{currentWlEnd?.toString()}</p>
            </div>
          </div>
        </div>

        {/* Transaction Status Modal/Mask */}
        {txHash && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="panel-retro p-8 max-w-md w-full mx-4 shadow-2xl">
              <div className="text-center">
                {txPending && (
                  <>
                    <div className="mb-4">
                      <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4" style={{ borderColor: "var(--green)" }}></div>
                    </div>
                    <p className="text-xl font-bold font-mono mb-4" style={{ color: "var(--amber)" }}>⏳ Transaction Pending</p>
                    <p className="text-sm font-mono mb-4" style={{ color: "var(--text-muted)" }}>Waiting for confirmation...</p>
                  </>
                )}
                {txSuccess && (
                  <>
                    <div className="mb-4 text-6xl">✅</div>
                    <p className="text-xl font-bold font-mono mb-4" style={{ color: "var(--green)" }}>Transaction Confirmed!</p>
                  </>
                )}
                <div className="rounded-sm p-3 mb-4" style={{ background: "var(--bg-crt)" }}>
                  <p className="text-xs font-mono mb-1" style={{ color: "var(--text-muted)" }}>Transaction Hash:</p>
                  <p className="font-mono text-xs break-all" style={{ color: "var(--cyan)" }}>{txHash}</p>
                </div>
                {txSuccess && (
                  <button
                    onClick={() => {
                      setTxHash("");
                      setTxPending(false);
                      setTxSuccess(false);
                    }}
                    className="w-full btn-amber px-4 py-2"
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* General Modal */}
        {modal.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="panel-retro p-8 max-w-md w-full mx-4 shadow-2xl">
              <div className="text-center">
                <div className="mb-4 text-6xl">
                  {modal.type === "success" && "✅"}
                  {modal.type === "error" && "❌"}
                  {modal.type === "info" && "ℹ️"}
                </div>
                <p className="text-xl font-bold font-mono mb-4" style={{
                  color: modal.type === "success" ? "var(--green)" :
                    modal.type === "error" ? "var(--red)" :
                      "var(--cyan)"
                }}>
                  {modal.title}
                </p>
                <div className="rounded-sm p-3 mb-4" style={{ background: "var(--bg-crt)" }}>
                  <p className="text-sm font-mono whitespace-pre-wrap break-words" style={{ color: "var(--text)" }}>{modal.message}</p>
                </div>
                <button
                  onClick={closeModal}
                  className="w-full btn-amber px-4 py-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Safe Wallet Status */}
        {authenticated && isSafeWallet && (
          <div className="panel-retro p-6 mb-8" style={{ borderColor: "var(--green)" }}>
            <h2 className="text-2xl font-bold font-mono mb-4" style={{ color: "var(--text)" }}>🔐 Safe Wallet Detected</h2>
            <p className="text-sm font-mono mb-4" style={{ color: "var(--text-muted)" }}>
              You are connected with a Safe (multi-sig) wallet. Admin functions will require multiple signatures.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="panel-retro p-3">
                <p className="font-mono mb-1" style={{ color: "var(--text-muted)" }}>Withdrawer Role:</p>
                <p className="text-lg font-bold font-mono">
                  {hasWithdrawerRole ? "✅ Granted" : "❌ Not Granted"}
                </p>
                {!hasWithdrawerRole && (
                  <p className="text-xs font-mono mt-1" style={{ color: "var(--amber)" }}>Required for withdraw function</p>
                )}
              </div>
              <div className="panel-retro p-3">
                <p className="font-mono mb-1" style={{ color: "var(--text-muted)" }}>Emergency Role:</p>
                <p className="text-lg font-bold font-mono">
                  {hasEmergencyRole ? "✅ Granted" : "❌ Not Granted"}
                </p>
                {!hasEmergencyRole && (
                  <p className="text-xs font-mono mt-1" style={{ color: "var(--amber)" }}>Required for emergency transfer</p>
                )}
              </div>
            </div>
            <div className="mt-4 panel-retro p-3" style={{ borderColor: "var(--cyan)" }}>
              <p className="text-xs font-mono" style={{ color: "var(--cyan)" }}>
                ℹ️ <strong>Multi-Sig Workflow:</strong> Transactions will be created but not executed immediately.
                Other Safe owners must sign on{" "}
                <a
                  href="https://app.safe.global/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: "var(--cyan)" }}
                >
                  app.safe.global
                </a>{" "}
                before execution.
              </p>
            </div>
            <div className="mt-3 text-xs font-mono" style={{ color: "var(--text-muted)" }}>
              📚 See <code className="px-1 rounded-sm" style={{ background: "rgba(255,255,255,0.05)" }}>SAFE_WALLET_TESTING.md</code> for complete testing guide
            </div>
          </div>
        )}

        {/* Demo Flow Controls */}
        <div className="panel-retro p-6 mb-8" style={{ borderColor: "var(--amber)" }}>
          <h2 className="text-2xl font-bold font-mono mb-4" style={{ color: "var(--amber)" }}>🎬 Demo Flow - Admin Controls</h2>
          <p className="text-sm font-mono mb-6" style={{ color: "var(--text-muted)" }}>Follow the demo order: 1. Whitelist → 2. Public Mint → 3. Paid Mint → 4. Reveal</p>

          <div className="grid md:grid-cols-5 gap-4">
            {/* Step 0: Quick Setup Whitelist */}
            <div className="panel-retro p-4" style={{ borderColor: "var(--amber)" }}>
              <div className="text-sm font-bold font-mono mb-2" style={{ color: "var(--amber)" }}>Setup: Whitelist</div>
              <button
                onClick={handleQuickSetupWhitelist}
                disabled={!authenticated}
                className="w-full btn-amber px-4 py-2 text-sm mb-2"
              >
                Quick Setup WL
              </button>
              <p className="text-xs font-mono mt-2" style={{ color: "var(--text-muted)" }}>Sets User2 address</p>
            </div>

            {/* Step 1: Whitelist Phase */}
            <div className="panel-retro p-4">
              <div className="text-sm font-bold font-mono mb-2" style={{ color: "var(--amber)" }}>Step 1: Whitelist</div>
              <button
                onClick={() => {
                  if (!contract) return;
                  executeTransaction(contract.setPhase(BigInt(1)));
                }}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2 text-sm"
              >
                Start WL Phase
              </button>
            </div>

            {/* Step 2: Public Mint Phase */}
            <div className="panel-retro p-4">
              <div className="text-sm font-bold font-mono mb-2" style={{ color: "var(--amber)" }}>Step 2: Public</div>
              <button
                onClick={() => {
                  if (!contract) return;
                  executeTransaction(contract.setPhase(BigInt(2)));
                }}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2 text-sm"
              >
                Start Public Phase
              </button>
            </div>

            {/* Step 3: Paid Mint Phase */}
            <div className="panel-retro p-4">
              <div className="text-sm font-bold font-mono mb-2" style={{ color: "var(--amber)" }}>Step 3: Paid</div>
              <button
                onClick={() => {
                  if (!contract) return;
                  executeTransaction(contract.setPhase(BigInt(3)));
                }}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2 text-sm"
              >
                Start Paid Phase
              </button>
            </div>

            {/* Step 4: Reveal */}
            <div className="panel-retro p-4">
              <div className="text-sm font-bold font-mono mb-2" style={{ color: "var(--amber)" }}>Step 4: Reveal</div>
              <button
                onClick={handleReveal}
                disabled={!authenticated || txPending || !revealURI}
                className="w-full btn-amber px-4 py-2 text-sm"
              >
                Reveal NFTs
              </button>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Phase Management */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold font-mono mb-4" style={{ color: "var(--text)" }}>Phase Management</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono mb-2" style={{ color: "var(--text-muted)" }}>Phase (0=None, 1=WL, 2=Public, 3=Paid)</label>
                <input
                  type="number"
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  min="0"
                  max="3"
                />
              </div>
              <button
                onClick={handleSetPhase}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2"
              >
                Set Phase
              </button>
            </div>
          </div>

          {/* SIWE Admin Login */}
          <div className={siweLoggedIn ? "rounded-sm p-6" : "panel-retro p-6"} style={siweLoggedIn ? { background: "rgba(0,255,65,0.05)", border: "1px solid rgba(0,255,65,0.3)" } : undefined}>
            <h3 className="text-xl font-bold font-mono mb-1" style={{ color: "var(--text)" }}>Admin Sign-In</h3>
            <p className="text-xs font-mono mb-4" style={{ color: "var(--text-muted)" }}>Sign in with Ethereum to use the protected whitelist API</p>
            {siweLoggedIn ? (
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm font-mono font-medium" style={{ color: "var(--green)" }}>Signed in as admin</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const list = await fetchWhitelist();
                      setWhitelistList(list);
                      setBulkInput(list.join("\n"));
                      setShowBulkAdd(true);
                    }}
                    className="btn-ghost px-4 py-2 text-sm"
                    title="Load current whitelist into the editor textarea"
                  >
                    Load Whitelist into Editor
                  </button>
                  <button
                    onClick={handleSiweLogout}
                    className="btn-ghost px-4 py-2 text-sm"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleSiweLogin}
                disabled={!authenticated || siweLoading}
                className="w-full btn-amber px-4 py-2"
              >
                {siweLoading ? "Signing…" : "Sign In with Ethereum"}
              </button>
            )}
          </div>

          {/* Whitelist Management Dashboard — spans full width, retro-futuristic */}
          <div className="md:col-span-2 rounded-sm border border-[#222] overflow-hidden" style={{ background: "#141414" }}>
            {/* Header bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#222]" style={{ background: "#0D0D0D" }}>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold font-mono tracking-tight" style={{ color: "#00FF41", textShadow: "0 0 10px rgba(0,255,65,0.4)" }}>
                  Whitelist Management
                </h3>
                {wlHasChanges && (
                  <span className="text-xs rounded-sm px-2 py-0.5 font-mono" style={{ background: "rgba(255,176,0,0.15)", color: "#FFB000", border: "1px solid rgba(255,176,0,0.3)" }}>
                    UNSAVED
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono tabular-nums" style={{ color: "#666" }}>{whitelistList.length} address{whitelistList.length !== 1 ? "es" : ""}</span>
                <button
                  onClick={loadWhitelist}
                  disabled={wlLoading}
                  className="rounded-sm px-2.5 py-1 text-xs font-mono cursor-pointer transition-all duration-150 disabled:opacity-50"
                  style={{ background: "#0D0D0D", border: "1px solid #333", color: "#E0E0E0" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#00FF41"; e.currentTarget.style.color = "#00FF41"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#E0E0E0"; }}
                  title="Refresh from backend"
                >
                  {wlLoading ? "LOADING..." : "REFRESH"}
                </button>
                <button
                  onClick={handleCopyAddresses}
                  disabled={whitelistList.length === 0}
                  className="rounded-sm px-2.5 py-1 text-xs font-mono cursor-pointer transition-all duration-150 disabled:opacity-50"
                  style={{ background: "#0D0D0D", border: "1px solid #333", color: "#E0E0E0" }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#00E5FF"; e.currentTarget.style.color = "#00E5FF"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#E0E0E0"; }}
                  title={wlSelected.size > 0 ? `Copy ${wlSelected.size} selected` : "Copy all addresses"}
                >
                  {wlSelected.size > 0 ? `COPY ${wlSelected.size}` : "COPY ALL"}
                </button>
                {wlHasChanges && (
                  <button
                    onClick={handleDiscardChanges}
                    className="rounded-sm px-2.5 py-1 text-xs font-mono cursor-pointer transition-all duration-150"
                    style={{ background: "#0D0D0D", border: "1px solid #333", color: "#FF3B3B" }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#FF3B3B"; e.currentTarget.style.boxShadow = "0 0 8px rgba(255,59,59,0.3)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.boxShadow = "none"; }}
                    title="Discard unsaved changes"
                  >
                    DISCARD
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              {/* Add address row */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAddress()}
                  className="flex-1 rounded-sm px-3 py-2 font-mono text-sm transition-all duration-150 outline-none"
                  style={{ background: "#0D0D0D", border: "1px solid #333", color: "#00FF41" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#00FF41"; e.currentTarget.style.boxShadow = "0 0 8px rgba(0,255,65,0.2)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.boxShadow = "none"; }}
                  placeholder="0x... (press Enter to add)"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAddress()}
                  className="w-48 rounded-sm px-3 py-2 font-mono text-sm transition-all duration-150 outline-none"
                  style={{ background: "#0D0D0D", border: "1px solid #333", color: "#00E5FF" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#00E5FF"; e.currentTarget.style.boxShadow = "0 0 8px rgba(0,229,255,0.2)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.boxShadow = "none"; }}
                  placeholder="Name (optional)"
                  maxLength={80}
                />
                <button
                  onClick={handleAddAddress}
                  className="rounded-sm px-4 py-2 text-sm font-mono font-bold whitespace-nowrap cursor-pointer transition-all duration-200"
                  style={{ background: "#00FF41", color: "#0D0D0D", boxShadow: "0 0 12px rgba(0,255,65,0.4)" }}
                  onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 20px rgba(0,255,65,0.6)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,65,0.4)"; }}
                >
                  + ADD
                </button>
                <button
                  onClick={() => setShowBulkAdd(!showBulkAdd)}
                  className="rounded-sm px-3 py-2 text-sm font-mono whitespace-nowrap cursor-pointer transition-all duration-200"
                  style={{
                    background: showBulkAdd ? "#00E5FF" : "transparent",
                    color: showBulkAdd ? "#0D0D0D" : "#00E5FF",
                    border: "1px solid #00E5FF",
                    boxShadow: showBulkAdd ? "0 0 12px rgba(0,229,255,0.4)" : "none",
                  }}
                  onMouseEnter={(e) => { if (!showBulkAdd) e.currentTarget.style.boxShadow = "0 0 10px rgba(0,229,255,0.3)"; }}
                  onMouseLeave={(e) => { if (!showBulkAdd) e.currentTarget.style.boxShadow = "none"; }}
                >
                  BULK IMPORT
                </button>
              </div>

              {/* Bulk add panel */}
              {showBulkAdd && (
                <div className="mb-3 rounded-sm p-4" style={{ background: "#0D0D0D", border: "1px solid #333" }}>
                  <label className="block text-xs font-mono mb-1.5" style={{ color: "#666" }}>Paste addresses — comma, space, or newline separated</label>
                  <textarea
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    className="w-full rounded-sm px-3 py-2 font-mono text-xs transition-all duration-150 outline-none"
                    style={{ background: "#141414", border: "1px solid #333", color: "#00FF41" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#00FF41"; e.currentTarget.style.boxShadow = "0 0 8px rgba(0,255,65,0.2)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.boxShadow = "none"; }}
                    rows={5}
                    placeholder={"0x1234567890abcdef1234567890abcdef12345678\n0xabcdef1234567890abcdef1234567890abcdef12\n0x9876543210fedcba9876543210fedcba98765432"}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleBulkAdd}
                      disabled={!bulkInput.trim()}
                      className="rounded-sm px-3 py-1.5 text-xs font-mono font-bold cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "#00FF41", color: "#0D0D0D" }}
                    >
                      IMPORT
                    </button>
                    <button
                      onClick={() => { setShowBulkAdd(false); setBulkInput(""); }}
                      className="rounded-sm px-3 py-1.5 text-xs font-mono cursor-pointer transition-all duration-200"
                      style={{ background: "transparent", border: "1px solid #333", color: "#E0E0E0" }}
                    >
                      CANCEL
                    </button>
                    {bulkInput.trim() && (
                      <span className="text-xs font-mono" style={{ color: "#FFB000" }}>
                        {bulkInput.split(/[\n,\s]+/).filter((a) => a.trim()).length} entries detected
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Toolbar: search + bulk actions */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input
                  type="text"
                  value={wlSearch}
                  onChange={(e) => setWlSearch(e.target.value)}
                  className="flex-1 min-w-[200px] rounded-sm px-3 py-1.5 font-mono text-xs transition-all duration-150 outline-none"
                  style={{ background: "#0D0D0D", border: "1px solid #333", color: "#00E5FF" }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#00E5FF"; e.currentTarget.style.boxShadow = "0 0 8px rgba(0,229,255,0.2)"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.boxShadow = "none"; }}
                  placeholder="Search addresses..."
                />
                {wlSelected.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono tabular-nums" style={{ color: "#00E5FF" }}>{wlSelected.size} selected</span>
                    <button
                      onClick={handleRemoveSelected}
                      className="rounded-sm px-2.5 py-1 text-xs font-mono font-bold cursor-pointer transition-all duration-200"
                      style={{ background: "rgba(255,59,59,0.1)", color: "#FF3B3B", border: "1px solid rgba(255,59,59,0.3)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 10px rgba(255,59,59,0.3)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}
                    >
                      REMOVE SELECTED
                    </button>
                    <button
                      onClick={() => setWlSelected(new Set())}
                      className="rounded-sm px-2.5 py-1 text-xs font-mono cursor-pointer transition-all duration-200"
                      style={{ background: "transparent", border: "1px solid #333", color: "#E0E0E0" }}
                    >
                      CLEAR
                    </button>
                  </div>
                )}
              </div>

              {/* Address table */}
              <div className="rounded-sm overflow-hidden mb-4" style={{ border: "1px solid #222" }}>
                <div className="max-h-80 overflow-y-auto">
                  {wlLoading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm font-mono" style={{ color: "#666" }}>
                      <svg className="animate-spin h-4 w-4" style={{ color: "#00FF41" }} viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Loading whitelist from backend...
                    </div>
                  ) : whitelistList.length === 0 ? (
                    <div className="text-center py-12 text-sm font-mono" style={{ color: "#666" }}>
                      No addresses in whitelist. Add one above or use Bulk Import.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10" style={{ background: "#0D0D0D" }}>
                        <tr className="text-xs border-b" style={{ borderColor: "#222", color: "#666" }}>
                          <th className="w-10 px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={whitelistList.length > 0 && whitelistList
                                .filter((a) => !wlSearch || a.toLowerCase().includes(wlSearch.toLowerCase()))
                                .every((a) => wlSelected.has(a.toLowerCase()))}
                              onChange={handleToggleSelectAll}
                              className="rounded-sm cursor-pointer accent-[#00FF41]"
                              title="Select all"
                            />
                          </th>
                          <th className="w-10 text-left px-1 py-2.5 font-mono">#</th>
                          <th className="text-left px-3 py-2.5 font-mono">ADDRESS</th>
                          <th className="text-left px-3 py-2.5 font-mono w-48">NAME</th>
                          <th className="text-right px-3 py-2.5 w-20 font-mono">ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {whitelistList
                          .filter((a) => !wlSearch || a.toLowerCase().includes(wlSearch.toLowerCase()))
                          .map((addr, i) => {
                            const isSelected = wlSelected.has(addr.toLowerCase());
                            const isNew = !wlSavedList.some((s) => s.toLowerCase() === addr.toLowerCase());
                            return (
                              <tr
                                key={addr}
                                className="transition-colors duration-100 cursor-pointer"
                                style={{
                                  borderTop: "1px solid rgba(34,34,34,0.5)",
                                  background: isSelected ? "rgba(0,229,255,0.05)" : "transparent",
                                }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(0,255,65,0.03)"; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                                onClick={() => handleToggleSelect(addr)}
                              >
                                <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleSelect(addr)}
                                    className="rounded-sm cursor-pointer accent-[#00FF41]"
                                  />
                                </td>
                                <td className="px-1 py-2 text-xs font-mono tabular-nums" style={{ color: "#666" }}>{i + 1}</td>
                                <td className="px-3 py-2 font-mono text-xs" style={{ color: "#E0E0E0" }}>
                                  <span className="select-all">{addr}</span>
                                  {isNew && (
                                    <span className="ml-2 text-[10px] font-mono rounded-sm px-1.5 py-0.5" style={{ background: "rgba(0,255,65,0.1)", color: "#00FF41", border: "1px solid rgba(0,255,65,0.3)" }}>
                                      NEW
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs" onClick={(e) => e.stopPropagation()} style={{ color: "#00E5FF" }}>
                                  <input
                                    type="text"
                                    value={nameByAddress[addr.toLowerCase()] ?? ""}
                                    onChange={(e) =>
                                      setNameByAddress((prev) => ({
                                        ...prev,
                                        [addr.toLowerCase()]: e.target.value,
                                      }))
                                    }
                                    onBlur={async (e) => {
                                      const val = e.currentTarget.value.trim();
                                      if (siweLoggedIn && val) {
                                        await addWhitelistEntry(addr, val);
                                      }
                                    }}
                                    className="w-full rounded-sm px-2 py-1 font-mono text-xs outline-none"
                                    style={{ background: "transparent", border: "1px solid transparent", color: "#00E5FF" }}
                                    onFocus={(e) => { e.currentTarget.style.borderColor = "#00E5FF"; e.currentTarget.style.background = "#0D0D0D"; }}
                                    onMouseEnter={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = "#333"; }}
                                    onMouseLeave={(e) => { if (document.activeElement !== e.currentTarget) e.currentTarget.style.borderColor = "transparent"; }}
                                    placeholder="—"
                                    maxLength={80}
                                  />
                                </td>
                                <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleRemoveAddress(addr)}
                                    className="text-xs font-mono cursor-pointer transition-all duration-150"
                                    style={{ color: "rgba(255,59,59,0.6)" }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = "#FF3B3B"; e.currentTarget.style.textShadow = "0 0 8px rgba(255,59,59,0.4)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,59,59,0.6)"; e.currentTarget.style.textShadow = "none"; }}
                                    title="Remove address"
                                  >
                                    REMOVE
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Actions row: Save & on-chain */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left: Save to backend */}
                <div className="space-y-3">
                  <button
                    onClick={generateMerkleRoot}
                    disabled={whitelistList.length === 0 || wlSaving}
                    className="w-full rounded-sm px-4 py-2.5 font-mono font-bold cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: wlHasChanges ? "#00FF41" : "rgba(0,255,65,0.15)",
                      color: wlHasChanges ? "#0D0D0D" : "#00FF41",
                      border: wlHasChanges ? "none" : "1px solid rgba(0,255,65,0.3)",
                      boxShadow: wlHasChanges ? "0 0 16px rgba(0,255,65,0.5)" : "none",
                    }}
                    onMouseEnter={(e) => { if (wlHasChanges) e.currentTarget.style.boxShadow = "0 0 24px rgba(0,255,65,0.7)"; }}
                    onMouseLeave={(e) => { if (wlHasChanges) e.currentTarget.style.boxShadow = "0 0 16px rgba(0,255,65,0.5)"; }}
                  >
                    {wlSaving ? "SAVING..." : `SAVE & GENERATE ROOT (${whitelistList.length})`}
                  </button>

                  <div>
                    <label className="block text-xs font-mono mb-1.5" style={{ color: "#666" }}>
                      ROOT TO PUSH ON-CHAIN
                      {wlRoot && currentRoot && (
                        wlRoot.toLowerCase() === String(currentRoot).toLowerCase()
                          ? <span style={{ color: "#00FF41", marginLeft: 8 }}>● in sync with chain</span>
                          : <span style={{ color: "#FFB000", marginLeft: 8 }}>● differs from chain — needs SET ROOT</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={wlRoot}
                      readOnly
                      className="w-full rounded-sm px-3 py-2 font-mono text-xs"
                      style={{ background: "#0D0D0D", border: "1px solid #222", color: "#00E5FF" }}
                    />
                    <label className="block text-[10px] font-mono mt-2 mb-1" style={{ color: "#666" }}>CURRENT ON-CHAIN ROOT</label>
                    <input
                      type="text"
                      value={currentRoot ? String(currentRoot) : ""}
                      readOnly
                      className="w-full rounded-sm px-3 py-1.5 font-mono text-[11px]"
                      style={{ background: "#0D0D0D", border: "1px solid #222", color: "#888" }}
                    />
                    <label className="block text-[10px] font-mono mt-2 mb-1" style={{ color: "#666" }}>
                      BACKEND-REPORTED ROOT
                      {backendRoot && wlRoot && (
                        backendRoot.toLowerCase() === wlRoot.toLowerCase()
                          ? <span style={{ color: "#00FF41", marginLeft: 8 }}>● matches local</span>
                          : <span style={{ color: "#FF3B3B", marginLeft: 8 }}>● mismatch — backend uses different algorithm</span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={backendRoot}
                      readOnly
                      className="w-full rounded-sm px-3 py-1.5 font-mono text-[11px]"
                      style={{ background: "#0D0D0D", border: "1px solid #222", color: "#888" }}
                    />
                  </div>
                </div>

                {/* Right: On-chain operations */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={handleSetWhitelist}
                      disabled={!authenticated || txPending}
                      className="rounded-sm px-4 py-2.5 font-mono text-sm cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "transparent", border: "1px solid #00E5FF", color: "#00E5FF" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 12px rgba(0,229,255,0.4)"; e.currentTarget.style.background = "rgba(0,229,255,0.1)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "transparent"; }}
                      title="Update only the merkle root on-chain"
                    >
                      SET ROOT
                    </button>
                    <button
                      onClick={handleSetWL}
                      disabled={!authenticated || txPending}
                      className="rounded-sm px-4 py-2.5 font-mono text-sm cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "transparent", border: "1px solid #00FF41", color: "#00FF41" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 12px rgba(0,255,65,0.4)"; e.currentTarget.style.background = "rgba(0,255,65,0.1)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "transparent"; }}
                      title="Update root + start/end times on-chain"
                    >
                      SET ALL
                    </button>
                  </div>

                  <div className="pt-3" style={{ borderTop: "1px solid #222" }}>
                    <p className="text-xs font-mono mb-2" style={{ color: "#666" }}>WL TIME WINDOW</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-mono mb-1" style={{ color: "#666" }}>START (UNIX)</label>
                        <input
                          type="text"
                          value={wlStart}
                          onChange={(e) => setWlStart(e.target.value)}
                          className="w-full rounded-sm px-3 py-1.5 text-xs font-mono transition-all duration-150 outline-none"
                          style={{ background: "#0D0D0D", border: "1px solid #333", color: "#FFB000" }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#FFB000"; e.currentTarget.style.boxShadow = "0 0 8px rgba(255,176,0,0.2)"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.boxShadow = "none"; }}
                        />
                        <p className="mt-1 text-[10px] font-mono" style={{ color: "#888" }}>
                          {formatUnixTimestamp(wlStart)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono mb-1" style={{ color: "#666" }}>END (UNIX)</label>
                        <input
                          type="text"
                          value={wlEnd}
                          onChange={(e) => setWlEnd(e.target.value)}
                          className="w-full rounded-sm px-3 py-1.5 text-xs font-mono transition-all duration-150 outline-none"
                          style={{ background: "#0D0D0D", border: "1px solid #333", color: "#FFB000" }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = "#FFB000"; e.currentTarget.style.boxShadow = "0 0 8px rgba(255,176,0,0.2)"; }}
                          onBlur={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.boxShadow = "none"; }}
                        />
                        <p className="mt-1 text-[10px] font-mono" style={{ color: "#888" }}>
                          {formatUnixTimestamp(wlEnd)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSetWLTimes}
                      disabled={!authenticated || txPending}
                      className="w-full mt-2 rounded-sm px-4 py-2 font-mono text-sm cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: "transparent", border: "1px solid #FFB000", color: "#FFB000" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 0 12px rgba(255,176,0,0.4)"; e.currentTarget.style.background = "rgba(255,176,0,0.1)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "transparent"; }}
                      title="Update only the start and end times on-chain"
                    >
                      SET TIMES ONLY
                    </button>
                  </div>
                </div>
              </div>

              {/* Airdrop ETH to selected whitelist addresses */}
              <div className="mt-6 pt-6" style={{ borderTop: "1px solid #222" }}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-mono font-bold" style={{ color: "#FFB000" }}>
                    AIRDROP ETH TO SELECTED
                  </h4>
                  <span className="text-xs font-mono tabular-nums" style={{ color: "#666" }}>
                    {wlSelected.size} recipient{wlSelected.size !== 1 ? "s" : ""} selected
                  </span>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-[10px] font-mono mb-1" style={{ color: "#666" }}>
                      AMOUNT PER ADDRESS (ETH)
                    </label>
                    <input
                      type="text"
                      value={airdropAmount}
                      onChange={(e) => setAirdropAmount(e.target.value)}
                      className="w-full rounded-sm px-3 py-2 font-mono text-sm transition-all duration-150 outline-none"
                      style={{ background: "#0D0D0D", border: "1px solid #333", color: "#FFB000" }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = "#FFB000"; e.currentTarget.style.boxShadow = "0 0 8px rgba(255,176,0,0.2)"; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.boxShadow = "none"; }}
                      placeholder="0.001"
                    />
                    <p className="mt-1 text-[10px] font-mono" style={{ color: "#888" }}>
                      Total: {(() => {
                        try {
                          const v = ethers.parseEther(airdropAmount.trim() || "0");
                          return ethers.formatEther(v * BigInt(wlSelected.size));
                        } catch { return "—"; }
                      })()} ETH · {activeChain.name}
                    </p>
                  </div>
                  <button
                    onClick={handleAirdropSelected}
                    disabled={!authenticated || airdropSending || wlSelected.size === 0}
                    className="rounded-sm px-4 py-2 font-mono text-sm font-bold cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: "#FFB000", color: "#0D0D0D", boxShadow: "0 0 12px rgba(255,176,0,0.4)" }}
                    onMouseEnter={(e) => { if (!airdropSending && wlSelected.size > 0) e.currentTarget.style.boxShadow = "0 0 20px rgba(255,176,0,0.6)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 0 12px rgba(255,176,0,0.4)"; }}
                    title={wlSelected.size === 0 ? "Select addresses in the table above" : "Send ETH to each selected address sequentially"}
                  >
                    {airdropSending ? "SENDING..." : `AIRDROP TO ${wlSelected.size}`}
                  </button>
                </div>
                {airdropProgress && (
                  <div className="mt-3 rounded-sm p-3" style={{ background: "#0D0D0D", border: "1px solid #222" }}>
                    <div className="flex items-center justify-between mb-2 text-xs font-mono">
                      <span style={{ color: "#E0E0E0" }}>
                        Progress: {airdropProgress.sent} / {airdropProgress.total}
                      </span>
                      <span style={{ color: airdropProgress.failed.length > 0 ? "#FF3B3B" : "#00FF41" }}>
                        {airdropProgress.failed.length > 0 ? `${airdropProgress.failed.length} failed` : "all ok"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-sm overflow-hidden" style={{ background: "#222" }}>
                      <div
                        className="h-full transition-all duration-200"
                        style={{
                          width: `${(airdropProgress.sent / airdropProgress.total) * 100}%`,
                          background: airdropProgress.failed.length > 0 ? "#FF3B3B" : "#00FF41",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Limits */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold font-mono mb-4" style={{ color: "var(--text)" }}>Set Limits</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono mb-2" style={{ color: "var(--text-muted)" }}>Limit 1 (WL/Public)</label>
                <input
                  type="number"
                  value={limit1}
                  onChange={(e) => setLimit1(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-mono mb-2" style={{ color: "var(--text-muted)" }}>Limit 2 (Paid)</label>
                <input
                  type="number"
                  value={limit2}
                  onChange={(e) => setLimit2(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                />
              </div>
              <button
                onClick={handleSetLimits}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2"
              >
                Set Limits
              </button>
            </div>
          </div>

          {/* SBT Mode */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold font-mono mb-4" style={{ color: "var(--text)" }}>SBT Mode</h3>
            <div className="space-y-4">
              <div className="flex items-center space-x-4 font-mono">
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={sbtEnabled}
                    onChange={() => setSbtEnabled(true)}
                    className="mr-2"
                  />
                  Enabled
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    checked={!sbtEnabled}
                    onChange={() => setSbtEnabled(false)}
                    className="mr-2"
                  />
                  Disabled
                </label>
              </div>
              <button
                onClick={handleSetSBT}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2"
              >
                Set SBT Mode
              </button>
            </div>
          </div>

          {/* Reveal */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold font-mono mb-4" style={{ color: "var(--text)" }}>Reveal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono mb-2" style={{ color: "var(--text-muted)" }}>Reveal URI</label>
                <input
                  type="text"
                  value={revealURI}
                  onChange={(e) => setRevealURI(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="ipfs://..."
                />
              </div>
              <button
                onClick={handleReveal}
                disabled={!authenticated || txPending}
                className="w-full btn-amber px-4 py-2"
              >
                Reveal
              </button>
            </div>
          </div>

          {/* Base URI Management */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold font-mono mb-4" style={{ color: "var(--text)" }}>Base URI</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-mono mb-2" style={{ color: "var(--text-muted)" }}>Base URI 1 (Before Reveal)</label>
                <input
                  type="text"
                  value={baseURI1}
                  onChange={(e) => setBaseURI1(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="ipfs://..."
                />
              </div>
              <button
                onClick={handleSetBaseURI1}
                disabled={!authenticated || txPending}
                className="w-full btn-amber px-4 py-2"
              >
                Set Base URI 1
              </button>
              <div>
                <label className="block text-sm font-mono mb-2" style={{ color: "var(--text-muted)" }}>Base URI 2 (After Reveal)</label>
                <input
                  type="text"
                  value={baseURI2}
                  onChange={(e) => setBaseURI2(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="ipfs://..."
                />
              </div>
              <button
                onClick={handleSetBaseURI2}
                disabled={!authenticated || txPending}
                className="w-full btn-amber px-4 py-2"
              >
                Set Base URI 2
              </button>
            </div>
          </div>

          {/* Withdraw */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold mb-4 font-mono glow-green" style={{ color: "var(--green)" }}>WITHDRAW {isSafeWallet && "[SAFE]"}</h3>
            {isSafeWallet && (
              <div className="mb-4 rounded-sm p-3 text-xs font-mono" style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.3)" }}>
                <p style={{ color: "var(--cyan)" }}>
                  <strong>Safe Wallet:</strong> This will create a multi-sig transaction requiring {" "}
                  {hasWithdrawerRole ? "approval from other owners" : "WITHDRAWER_ROLE to be granted first"}.
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>WITHDRAW TO ADDRESS</label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="0x..."
                />
              </div>
              <button
                onClick={handleWithdraw}
                disabled={!authenticated || txPending || (isSafeWallet && !hasWithdrawerRole)}
                className="w-full btn-primary px-4 py-2"
              >
                {isSafeWallet ? "CREATE WITHDRAW TX" : "WITHDRAW"}
              </button>
              {isSafeWallet && !hasWithdrawerRole && (
                <p className="text-xs font-mono" style={{ color: "var(--amber)" }}>
                  ! Safe wallet needs WITHDRAWER_ROLE granted first
                </p>
              )}
            </div>
          </div>

          {/* Generate Wallet & Fund */}
          <div className="panel-retro p-6 col-span-2">
            <h3 className="text-xl font-bold mb-4 font-mono glow-green" style={{ color: "var(--green)" }}>GENERATE WALLET &amp; FUND</h3>
            {isSafeWallet && (
              <div className="mb-4 rounded-sm p-3 text-xs font-mono" style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.3)" }}>
                <p style={{ color: "var(--cyan)" }}>
                  <strong>Safe Wallet:</strong> Funding will create a multi-sig transaction requiring approval from other owners.
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>FUND AMOUNT (ETH)</label>
                <input
                  type="text"
                  value={fundAmount}
                  onChange={(e) => setFundAmount(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="0.001"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleGenerateWallet}
                  className="btn-cyan px-4 py-2 text-sm"
                >
                  GENERATE ONLY
                </button>
                <button
                  onClick={handleGenerateAndFund}
                  disabled={!authenticated || txPending || !signer}
                  className="btn-primary px-4 py-2 text-sm"
                >
                  GENERATE &amp; SEND ETH
                </button>
              </div>
              {generatedWallet && (
                <div className="rounded-sm p-4 space-y-3" style={{ background: "var(--bg-crt)", border: "1px solid rgba(0,255,65,0.3)" }}>
                  <p className="text-sm font-bold font-mono glow-green" style={{ color: "var(--green)" }}>NEW WALLET CREATED</p>
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: "var(--text-muted)" }}>ADDRESS</p>
                    <p className="font-mono text-xs break-all rounded-sm p-2" style={{ color: "var(--text)", background: "var(--bg-surface)", border: "1px solid var(--border)" }}>{generatedWallet.address}</p>
                  </div>
                  <div>
                    <p className="text-xs font-mono mb-1" style={{ color: "var(--text-muted)" }}>PRIVATE KEY</p>
                    <p className="font-mono text-xs break-all rounded-sm p-2" style={{ color: "var(--amber)", background: "var(--bg-surface)", border: "1px solid var(--border)" }}>{generatedWallet.privateKey}</p>
                  </div>
                  {generatedWallet.mnemonic && (
                    <div>
                      <p className="text-xs font-mono mb-1" style={{ color: "var(--text-muted)" }}>MNEMONIC</p>
                      <p className="font-mono text-xs break-all rounded-sm p-2" style={{ color: "var(--amber)", background: "var(--bg-surface)", border: "1px solid var(--border)" }}>{generatedWallet.mnemonic}</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleFundWallet}
                      disabled={!authenticated || txPending || !signer}
                      className="flex-1 btn-cyan px-4 py-2 text-sm"
                    >
                      SEND {fundAmount} ETH
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedWallet.privateKey);
                        showModal("Copied", "Private key copied to clipboard", "success");
                      }}
                      className="btn-ghost px-4 py-2 text-sm"
                    >
                      COPY KEY
                    </button>
                  </div>
                  <p className="text-xs font-mono" style={{ color: "var(--red)" }}>! Save the private key. It cannot be recovered after leaving this page.</p>
                </div>
              )}
            </div>
          </div>

          {/* Batch Mint */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold mb-4 font-mono glow-green" style={{ color: "var(--green)" }}>BATCH MINT</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>TO ADDRESS</label>
                <input
                  type="text"
                  value={batchMintTo}
                  onChange={(e) => setBatchMintTo(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>AMOUNT</label>
                <input
                  type="number"
                  value={batchMintAmount}
                  onChange={(e) => setBatchMintAmount(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  min="1"
                />
              </div>
              <button
                onClick={handleBatchMint}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2"
              >
                BATCH MINT
              </button>
            </div>
          </div>

          {/* Emergency Transfer */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold mb-4 font-mono" style={{ color: "var(--red)", textShadow: "0 0 10px rgba(255, 59, 59, 0.4)" }}>EMERGENCY TRANSFER {isSafeWallet && "[SAFE]"}</h3>
            {isSafeWallet && (
              <div className="mb-4 rounded-sm p-3 text-xs font-mono" style={{ background: "rgba(0,229,255,0.05)", border: "1px solid rgba(0,229,255,0.3)" }}>
                <p style={{ color: "var(--cyan)" }}>
                  <strong>Safe Wallet:</strong> This will create a multi-sig transaction requiring {" "}
                  {hasEmergencyRole ? "approval from other owners" : "EMERGENCY_ROLE to be granted first"}.
                </p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>TOKEN ID</label>
                <input
                  type="text"
                  value={emergencyTokenId}
                  onChange={(e) => setEmergencyTokenId(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>FROM ADDRESS</label>
                <input
                  type="text"
                  value={emergencyFrom}
                  onChange={(e) => setEmergencyFrom(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>TO ADDRESS</label>
                <input
                  type="text"
                  value={emergencyTo}
                  onChange={(e) => setEmergencyTo(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>REASON</label>
                <input
                  type="text"
                  value={emergencyReason}
                  onChange={(e) => setEmergencyReason(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="Account recovery"
                />
              </div>
              <button
                onClick={handleEmergencyTransfer}
                disabled={!authenticated || txPending || (isSafeWallet && !hasEmergencyRole)}
                className="w-full px-4 py-2 font-mono font-bold rounded-sm cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: "transparent",
                  color: "var(--red)",
                  border: "1px solid var(--red)",
                  boxShadow: "var(--glow-red)",
                }}
              >
                {isSafeWallet ? "CREATE EMERGENCY TRANSFER TX" : "EMERGENCY TRANSFER"}
              </button>
              {isSafeWallet && !hasEmergencyRole && (
                <p className="text-xs font-mono" style={{ color: "var(--amber)" }}>
                  ! Safe wallet needs EMERGENCY_ROLE granted first
                </p>
              )}
            </div>
          </div>

          {/* Royalty */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold mb-4 font-mono glow-cyan" style={{ color: "var(--cyan)" }}>SET ROYALTY</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>RECEIVER ADDRESS</label>
                <input
                  type="text"
                  value={royaltyReceiver}
                  onChange={(e) => setRoyaltyReceiver(e.target.value)}
                  className="w-full input-retro-cyan px-3 py-2"
                  placeholder="0x..."
                />
              </div>
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>BASIS POINTS (500 = 5%)</label>
                <input
                  type="number"
                  value={royaltyBps}
                  onChange={(e) => setRoyaltyBps(e.target.value)}
                  className="w-full input-retro-cyan px-3 py-2"
                  max="1000"
                />
              </div>
              <button
                onClick={handleSetRoyalty}
                disabled={!authenticated || txPending}
                className="w-full btn-cyan px-4 py-2"
              >
                SET ROYALTY
              </button>
            </div>
          </div>

          {/* Pause Contract */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold mb-4 font-mono glow-amber" style={{ color: "var(--amber)" }}>PAUSE CONTRACT</h3>
            <div className="space-y-4">
              <button
                onClick={handlePause}
                disabled={!authenticated || txPending}
                className="w-full btn-amber px-4 py-2"
              >
                PAUSE
              </button>
              <button
                onClick={handleUnpause}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2"
              >
                UNPAUSE
              </button>
            </div>
          </div>

          {/* Pause Account */}
          <div className="panel-retro p-6">
            <h3 className="text-xl font-bold mb-4 font-mono glow-amber" style={{ color: "var(--amber)" }}>PAUSE ACCOUNT</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>ADDRESS TO PAUSE</label>
                <input
                  type="text"
                  value={pauseAccountAddr}
                  onChange={(e) => setPauseAccountAddr(e.target.value)}
                  className="w-full input-retro-amber px-3 py-2"
                  placeholder="0x..."
                />
              </div>
              <button
                onClick={handlePauseAccount}
                disabled={!authenticated || txPending}
                className="w-full btn-amber px-4 py-2"
              >
                PAUSE ACCOUNT
              </button>
              <div>
                <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>ADDRESS TO UNPAUSE</label>
                <input
                  type="text"
                  value={unpauseAccountAddr}
                  onChange={(e) => setUnpauseAccountAddr(e.target.value)}
                  className="w-full input-retro px-3 py-2"
                  placeholder="0x..."
                />
              </div>
              <button
                onClick={handleUnpauseAccount}
                disabled={!authenticated || txPending}
                className="w-full btn-primary px-4 py-2"
              >
                UNPAUSE ACCOUNT
              </button>
            </div>
          </div>

          {/* Check Metadata */}
          <div className="panel-retro p-6 col-span-2">
            <h3 className="text-xl font-bold mb-4 font-mono glow-cyan" style={{ color: "var(--cyan)" }}>CHECK METADATA</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm mb-2 font-mono" style={{ color: "var(--text-muted)" }}>TOKEN ID</label>
                  <input
                    type="number"
                    value={checkTokenId}
                    onChange={(e) => setCheckTokenId(e.target.value)}
                    className="w-full input-retro-cyan px-3 py-2"
                    placeholder="e.g. 2"
                    min="0"
                    onKeyDown={(e) => e.key === "Enter" && handleCheckMetadata()}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleCheckMetadata}
                    disabled={!contract || !checkTokenId || checkLoading}
                    className="btn-cyan px-6 py-2"
                  >
                    {checkLoading ? "LOADING..." : "CHECK"}
                  </button>
                </div>
              </div>

              {checkError && (
                <div className="rounded-sm p-3" style={{ background: "rgba(255,59,59,0.05)", border: "1px solid rgba(255,59,59,0.3)" }}>
                  <p className="text-sm font-mono" style={{ color: "var(--red)" }}>{checkError}</p>
                </div>
              )}

              {checkTokenURI && (
                <div className="rounded-sm p-3" style={{ background: "var(--bg-crt)", border: "1px solid var(--border)" }}>
                  <p className="text-xs font-mono mb-1" style={{ color: "var(--text-muted)" }}>TOKEN URI (ON-CHAIN)</p>
                  <p className="font-mono text-xs break-all" style={{ color: "var(--cyan)" }}>{checkTokenURI}</p>
                </div>
              )}

              {checkMetadata && (
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Image preview */}
                  <div>
                    {checkMetadata.image && ipfsToHttp(checkMetadata.image) ? (
                      <img
                        src={ipfsToHttp(checkMetadata.image)}
                        alt={checkMetadata.name || `Token ${checkTokenId}`}
                        className="w-full h-64 object-cover rounded-sm"
                        style={{ border: "1px solid var(--border-light)" }}
                        onError={(e) => {
                          e.currentTarget.src =
                            'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect fill="%23141414" width="400" height="300"/%3E%3Ctext fill="%2300FF41" font-family="monospace" font-size="16" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3EIMAGE NOT AVAILABLE%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    ) : (
                      <div className="w-full h-64 rounded-sm flex items-center justify-center font-mono text-sm" style={{ background: "var(--bg-crt)", color: "var(--text-muted)", border: "1px solid var(--border-light)" }}>
                        {checkMetadata.image ? `Image CID: ${checkMetadata.image}` : "No image field"}
                      </div>
                    )}
                    {checkMetadata.image && (
                      <p className="text-xs font-mono mt-1 break-all" style={{ color: "var(--text-muted)" }}>{checkMetadata.image}</p>
                    )}
                  </div>

                  {/* Metadata details */}
                  <div className="space-y-3">
                    {checkMetadata.name && (
                      <div>
                        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>NAME</p>
                        <p className="text-lg font-bold font-mono glow-green" style={{ color: "var(--green)" }}>{checkMetadata.name}</p>
                      </div>
                    )}
                    {checkMetadata.description && (
                      <div>
                        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>DESCRIPTION</p>
                        <p className="text-sm" style={{ color: "var(--text)" }}>{checkMetadata.description}</p>
                      </div>
                    )}
                    {checkMetadata.attributes && checkMetadata.attributes.length > 0 && (
                      <div>
                        <p className="text-xs font-mono mb-2" style={{ color: "var(--text-muted)" }}>ATTRIBUTES ({checkMetadata.attributes.length})</p>
                        <div className="grid grid-cols-2 gap-1">
                          {checkMetadata.attributes.map((attr: any, idx: number) => (
                            <div
                              key={idx}
                              className="badge-cyan p-2 text-center"
                            >
                              <p className="text-[10px] uppercase font-mono" style={{ color: "var(--cyan)", opacity: 0.7 }}>{attr.trait_type}</p>
                              <p className="text-xs font-bold truncate font-mono" style={{ color: "var(--cyan)" }}>{attr.value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Raw JSON toggle */}
                    <details className="rounded-sm p-3" style={{ background: "var(--bg-crt)", border: "1px solid var(--border)" }}>
                      <summary className="text-xs font-mono cursor-pointer" style={{ color: "var(--text-muted)" }}>RAW JSON</summary>
                      <pre className="text-xs font-mono overflow-auto max-h-48 mt-2" style={{ color: "var(--green)" }}>
                        {JSON.stringify(checkMetadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

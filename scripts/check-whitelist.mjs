import { MerkleTree } from "merkletreejs";
import keccak256 from "keccak256";
import { ethers } from "ethers";

const CONTRACT_ADDRESS = "0xd32b9683e2E407A849138aE03677CEC30eda0730";
const SEPOLIA_RPC = "https://sepolia.infura.io/v3/93c6b479917042ad9f64a9fe9d6c198d";

// Whitelist from data/whitelist.json (frontend)
const FRONTEND_WL = [
  "0xdb01f7dfefa1aae19a2204a4ffa42dd7ec583afd",
  "0xF28258A4F42d073653C0E3Ed9d09e855273f3D44",
];

// Whitelist from getMerkleProof.ts (hardhat script)
const HARDHAT_WL = [
  "0xfb989d8296dd44d26c55ac8b839d998add5e9d01",
  "0xDB01f7DFefA1AAe19A2204a4Ffa42dd7EC583AfD",
  "0xF28258A4F42d073653C0E3Ed9d09e855273f3D44",
];

// Method A: frontend lib/whitelist.ts — keccak256(solidityPacked(["address"], [addr]))
function buildTreeMethodA(addresses) {
  const leaves = addresses.map((addr) =>
    keccak256(ethers.solidityPacked(["address"], [addr.toLowerCase()]))
  );
  return new MerkleTree(leaves, keccak256, { sortPairs: true });
}

// Method B: hardhat getMerkleProof.ts — keccak256(addr.toLowerCase())
function buildTreeMethodB(addresses) {
  const leaves = addresses.map((addr) => keccak256(addr.toLowerCase()));
  return new MerkleTree(leaves, keccak256, { sortPairs: true });
}

const ABI = ["function root() view returns (bytes32)"];

async function main() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);

  let onChainRoot;
  try {
    onChainRoot = await contract.root();
    console.log("On-chain root:          ", onChainRoot);
  } catch (e) {
    console.error("Failed to fetch on-chain root:", e.message);
    process.exit(1);
  }

  // Test all combinations
  const combos = [
    { label: "Frontend WL  + Method A (solidityPacked)", wl: FRONTEND_WL, fn: buildTreeMethodA },
    { label: "Frontend WL  + Method B (string hash)   ", wl: FRONTEND_WL, fn: buildTreeMethodB },
    { label: "Hardhat WL   + Method A (solidityPacked)", wl: HARDHAT_WL,  fn: buildTreeMethodA },
    { label: "Hardhat WL   + Method B (string hash)   ", wl: HARDHAT_WL,  fn: buildTreeMethodB },
  ];

  console.log();
  let matched = false;
  for (const { label, wl, fn } of combos) {
    const tree = fn(wl);
    const root = tree.getHexRoot();
    const match = root.toLowerCase() === onChainRoot.toLowerCase();
    console.log(`[${match ? "MATCH" : "    "}] ${label}`);
    console.log(`        root: ${root}`);
    if (match) matched = true;
  }

  if (!matched) {
    console.log("\nNo combination matched the on-chain root.");
    console.log("The whitelist stored on-chain may have been set with different addresses.");
  } else {
    console.log("\nVerifying proofs for the matching combination...");
    // Find matching combo
    for (const { label, wl, fn } of combos) {
      const tree = fn(wl);
      const root = tree.getHexRoot();
      if (root.toLowerCase() !== onChainRoot.toLowerCase()) continue;

      console.log(`\nUsing: ${label}`);
      for (const addr of wl) {
        const isWL = await contract.isWL(addr, tree.getHexProof(
          fn === buildTreeMethodA
            ? keccak256(ethers.solidityPacked(["address"], [addr.toLowerCase()]))
            : keccak256(addr.toLowerCase())
        )).catch(() => null);
        console.log(`  ${addr}: on-chain isWL = ${isWL}`);
      }
    }
  }
}

// Also need isWL in the ABI
const CONTRACT_ABI = [
  "function root() view returns (bytes32)",
  "function isWL(address a, bytes32[] calldata p) view returns (bool)",
];

// Re-run with full ABI
async function run() {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

  let onChainRoot;
  try {
    onChainRoot = await contract.root();
    console.log("On-chain root:          ", onChainRoot);
  } catch (e) {
    console.error("Failed to fetch on-chain root:", e.message);
    process.exit(1);
  }

  const combos = [
    { label: "Frontend WL  + Method A (solidityPacked)", wl: FRONTEND_WL, fn: buildTreeMethodA, leafFn: (a) => keccak256(ethers.solidityPacked(["address"], [a.toLowerCase()])) },
    { label: "Frontend WL  + Method B (string hash)   ", wl: FRONTEND_WL, fn: buildTreeMethodB, leafFn: (a) => keccak256(a.toLowerCase()) },
    { label: "Hardhat WL   + Method A (solidityPacked)", wl: HARDHAT_WL,  fn: buildTreeMethodA, leafFn: (a) => keccak256(ethers.solidityPacked(["address"], [a.toLowerCase()])) },
    { label: "Hardhat WL   + Method B (string hash)   ", wl: HARDHAT_WL,  fn: buildTreeMethodB, leafFn: (a) => keccak256(a.toLowerCase()) },
  ];

  console.log();
  let matchedCombo = null;
  for (const combo of combos) {
    const tree = combo.fn(combo.wl);
    const root = tree.getHexRoot();
    const match = root.toLowerCase() === onChainRoot.toLowerCase();
    console.log(`[${match ? "MATCH" : "    "}] ${combo.label}`);
    console.log(`        root: ${root}`);
    if (match) matchedCombo = { ...combo, tree };
  }

  if (!matchedCombo) {
    console.log("\nNo combination matched. The on-chain root was set with unknown addresses or a different hashing method.");
    return;
  }

  console.log(`\n--- Proof verification for matching combo ---`);
  const { tree, wl, leafFn } = matchedCombo;
  for (const addr of wl) {
    const leaf = leafFn(addr);
    const proof = tree.getHexProof(leaf);
    const valid = await contract.isWL(addr, proof);
    console.log(`  ${addr}: isWL = ${valid} (proof length: ${proof.length})`);
  }
}

run().catch(console.error);

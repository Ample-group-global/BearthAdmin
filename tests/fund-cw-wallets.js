const { ethers } = require("ethers");

const RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";

const WALLETS = [
  { name: "CW1", address: "0x30FC14a4c55F2f603f3d7267F82F3279E8D8501e", eth: "0.01" },
  { name: "CW2", address: "0xf80AbBFED5856c5D29d6Ac8f2F34407cBE1aDB21", eth: "0.05" },
  { name: "CW3", address: "0xEFe074d19088351f9771A16aB4dF03036a86b51a", eth: "0.10" },
  { name: "CW4", address: "0x9EEC062F4978CF48de54fD492b26eCdeb87Be01d", eth: "0.10" },
  { name: "CW5", address: "0x59C5347a9B78C8279Cb6b759AEd143Ec53256A62", eth: "0.05" },
];

async function main() {
  const pk = process.env.OPS_PRIVATE_KEY;
  if (!pk) { console.error("Set OPS_PRIVATE_KEY env var"); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet   = new ethers.Wallet(pk, provider);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Ops wallet: ${wallet.address}`);
  console.log(`Balance:    ${ethers.formatEther(balance)} ETH\n`);

  const total = WALLETS.reduce((s, w) => s + parseFloat(w.eth), 0);
  if (parseFloat(ethers.formatEther(balance)) < total + 0.01) {
    console.error(`Insufficient balance. Need ~${total + 0.01} ETH, have ${ethers.formatEther(balance)} ETH`);
    process.exit(1);
  }

  for (const cw of WALLETS) {
    const before = await provider.getBalance(cw.address);
    console.log(`${cw.name} (${cw.address}) current: ${ethers.formatEther(before)} ETH`);

    if (parseFloat(ethers.formatEther(before)) >= parseFloat(cw.eth) * 0.9) {
      console.log(`  → Already funded, skipping\n`);
      continue;
    }

    const tx = await wallet.sendTransaction({
      to:    cw.address,
      value: ethers.parseEther(cw.eth),
    });
    console.log(`  → Sent ${cw.eth} ETH  tx: ${tx.hash}`);
    await tx.wait();
    console.log(`  → Confirmed\n`);
  }

  console.log("Done. All CW wallets funded.");
}

main().catch(e => { console.error(e.message); process.exit(1); });

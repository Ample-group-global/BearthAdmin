import { Page } from "@playwright/test";

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_WHITELIST_ENTRIES = [
  { address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", name: "VIP Partner", added_at: "2024-01-15T10:00:00Z" },
  { address: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", name: "Community Winner", added_at: "2024-01-16T12:00:00Z" },
  { address: "0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c", name: null, added_at: "2024-01-17T09:00:00Z" },
  { address: "0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB", name: "Founding Member", added_at: "2024-01-18T14:00:00Z" },
  { address: "0x583031D1113aD414F02576BD6afaBfb302140225", name: null, added_at: "2024-01-19T08:00:00Z" },
];

// ─── RPC mock helper ───────────────────────────────────────────────────────────

// A minimal valid Ethereum block object (prevents ethers.js parentHash errors)
const MOCK_BLOCK = {
  hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  parentHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  number: "0x7d0",       // 2000 — small value keeps the event chunking loop to 1 iteration
  timestamp: "0x663a0000",
  nonce: "0x0000000000000000",
  difficulty: "0x0",
  gasLimit: "0x1c9c380",
  gasUsed: "0x0",
  miner: "0x0000000000000000000000000000000000000000",
  extraData: "0x",
  transactions: [],
  logsBloom: "0x" + "0".repeat(512),
  stateRoot: "0x" + "0".repeat(64),
  receiptsRoot: "0x" + "0".repeat(64),
  transactionsRoot: "0x" + "0".repeat(64),
  sha3Uncles: "0x" + "0".repeat(64),
  size: "0x1000",
  totalDifficulty: "0x0",
  uncles: [],
  baseFeePerGas: "0x0",
  mixHash: "0x" + "0".repeat(64),
};

function rpcResultFor(method: string, data: string): unknown {
  if (method === "eth_blockNumber") return "0x7d0"; // 2000 — small to avoid chunking
  if (method === "eth_getBalance") return "0x16345785D8A0000";
  if (method === "eth_chainId") return "0x1";
  if (method === "net_version") return "1";
  if (method === "eth_getBlockByNumber") return MOCK_BLOCK;
  if (method === "eth_getBlockByHash") return MOCK_BLOCK;
  if (method === "eth_feeHistory") return { baseFeePerGas: ["0x0"], gasUsedRatio: [0], reward: [[]] };
  if (method === "eth_maxPriorityFeePerGas") return "0x0";
  if (method === "eth_estimateGas") return "0x5208";
  if (method === "eth_call") {
    // getData() selector: first bytes of keccak256("getData()")
    // Function selectors computed from BearthNFT ABI
    const GETDATA_SEL = "0x3bc5de30"; // getData()
    // phase()=0xb1c9fe6e  sbt()=0xb1324f7b  root()=0xebf0c717  wlStart()=0x0489cf6e  wlEnd()=0x5b66b851

    if (data && data.startsWith(GETDATA_SEL)) {
      // ABI-encoded tuple (9 × uint256/bool) — each field exactly 64 hex chars (32 bytes)
      return (
        "0x" +
        [
          "0000000000000000000000000000000000000000000000000000000000000001", // phase=1
          "000000000000000000000000000000000000000000000000000000000000002d", // _counter=45
          "0000000000000000000000000000000000000000000000000000000000000bb8", // MAX_SUPPLY=3000
          "000000000000000000000000000000000000000000000000000000000000002d", // stage1Minted=45
          "0000000000000000000000000000000000000000000000000000000000000000", // sbt=false
          "0000000000000000000000000000000000000000000000000000000000000001", // revealCount=1
          "0000000000000000000000000000000000000000000000000000000000000001", // limit1
          "0000000000000000000000000000000000000000000000000000000000000001", // limit2
          "000000000000000000000000000000000000000000000000006a94d74f430000", // PRICE=0.03 ETH
        ].join("")
      );
    }
    // All other calls (phase, sbt, root, wlStart, wlEnd) → return uint256/bool = 1
    return "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
  if (method === "eth_getLogs") return [];
  return "0x0";
}

/**
 * Intercept ALL outbound blockchain RPC requests so no live contract is hit.
 * Handles both single-request and batched (array) JSON-RPC bodies.
 */
export async function mockBlockchain(page: Page) {
  const rpcGlobs = [
    "**/ethereum-rpc.publicnode.com**",
    "**/sepolia.base.org**",
    "**/ethereum-sepolia-rpc.publicnode.com**",
    "**/infura.io/**",
    "**/alchemy.com/**",
    "**/ankr.com/**",
    "**/publicnode.com**",
  ];

  for (const glob of rpcGlobs) {
    await page.route(glob, async (route) => {
      try {
        const raw = route.request().postData();
        if (!raw) { await route.continue(); return; }
        const body = JSON.parse(raw);

        if (Array.isArray(body)) {
          // Batched JSON-RPC
          const results = body.map((req) => ({
            jsonrpc: "2.0",
            id: req.id ?? 1,
            result: rpcResultFor(req.method, req.params?.[0]?.data ?? ""),
          }));
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(results),
          });
        } else {
          // Single JSON-RPC
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: body.id ?? 1,
              result: rpcResultFor(body.method, body.params?.[0]?.data ?? ""),
            }),
          });
        }
      } catch {
        await route.continue();
      }
    });
  }
}

/**
 * Intercept the whitelist backend API — no DB hit.
 */
export async function mockWhitelistApi(page: Page) {
  await page.route(/\/api\/whitelist\/entries/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ entries: MOCK_WHITELIST_ENTRIES }),
    });
  });

  await page.route(/\/api\/whitelist\/merkle-root/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ root: "0xmockroot123", source: "db" }),
    });
  });

  await page.route(/\/api\/proof/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ is_whitelisted: true, proof: ["0xabc123", "0xdef456"], root: "0xmockroot" }),
    });
  });

  // /api/whitelist base endpoint (last to avoid conflict)
  await page.route(/\/api\/whitelist(?!\/|$)/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ addresses: MOCK_WHITELIST_ENTRIES.map((e) => e.address) }),
    });
  });

  await page.route(/\/api\/whitelist$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ addresses: MOCK_WHITELIST_ENTRIES.map((e) => e.address) }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
  });
}

/**
 * Log in via the real login form (sets a real httpOnly cookie server-side).
 * Clears existing cookies first so each test starts clean.
 */
export async function loginAs(page: Page, role: "tech" | "ops") {
  await page.context().clearCookies();

  const creds = role === "tech"
    ? { username: "tech_admin", password: "TechAdmin2024!" }
    : { username: "ops_admin", password: "OpsAdmin2024!" };

  await page.goto("/login");
  await page.fill('input[autocomplete="username"]', creds.username);
  await page.fill('input[autocomplete="current-password"]', creds.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(role === "tech" ? /\/dashboard/ : /\/ops/, { timeout: 15000 });
}

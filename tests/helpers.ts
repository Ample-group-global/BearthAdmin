import { Page } from "@playwright/test";

// ─── Credentials ────────────────────────────────────────────────────────────────
export const CREDS = {
  admin: { email: "admin@bearth.local", password: "Admin2024!" },
  ops:   { email: "ops@bearth.local",   password: "Ops2024!"   },
  tech:  { email: "tech@bearth.local",  password: "Tech2024!"  },
} as const;

// ─── Mock data ────────────────────────────────────────────────────────────────

export const MOCK_WHITELIST_ENTRIES = [
  { address: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B", name: "VIP Partner", added_at: "2024-01-15T10:00:00Z" },
  { address: "0x5B38Da6a701c568545dCfcB03FcB875f56beddC4", name: "Community Winner", added_at: "2024-01-16T12:00:00Z" },
  { address: "0xCA35b7d915458EF540aDe6068dFe2F44E8fa733c", name: null, added_at: "2024-01-17T09:00:00Z" },
  { address: "0x4B0897b0513fdC7C541B6d9D7E929C4e5364D2dB", name: "Founding Member", added_at: "2024-01-18T14:00:00Z" },
  { address: "0x583031D1113aD414F02576BD6afaBfb302140225", name: null, added_at: "2024-01-19T08:00:00Z" },
];

// ─── RPC mock helper ───────────────────────────────────────────────────────────

const MOCK_BLOCK = {
  hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  parentHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  number: "0x7d0",
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
  if (method === "eth_blockNumber") return "0x7d0";
  if (method === "eth_getBalance") return "0x16345785D8A0000";
  if (method === "eth_chainId") return "0x1";
  if (method === "net_version") return "1";
  if (method === "eth_getBlockByNumber") return MOCK_BLOCK;
  if (method === "eth_getBlockByHash") return MOCK_BLOCK;
  if (method === "eth_feeHistory") return { baseFeePerGas: ["0x0"], gasUsedRatio: [0], reward: [[]] };
  if (method === "eth_maxPriorityFeePerGas") return "0x0";
  if (method === "eth_estimateGas") return "0x5208";
  if (method === "eth_call") {
    const GETDATA_SEL = "0x3bc5de30";
    if (data && data.startsWith(GETDATA_SEL)) {
      return (
        "0x" +
        [
          "0000000000000000000000000000000000000000000000000000000000000001",
          "000000000000000000000000000000000000000000000000000000000000002d",
          "0000000000000000000000000000000000000000000000000000000000000bb8",
          "000000000000000000000000000000000000000000000000000000000000002d",
          "0000000000000000000000000000000000000000000000000000000000000000",
          "0000000000000000000000000000000000000000000000000000000000000001",
          "0000000000000000000000000000000000000000000000000000000000000001",
          "0000000000000000000000000000000000000000000000000000000000000001",
          "000000000000000000000000000000000000000000000000006a94d74f430000",
        ].join("")
      );
    }
    return "0x0000000000000000000000000000000000000000000000000000000000000001";
  }
  if (method === "eth_getLogs") return [];
  return "0x0";
}

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
          const results = body.map((req) => ({
            jsonrpc: "2.0",
            id: req.id ?? 1,
            result: rpcResultFor(req.method, req.params?.[0]?.data ?? ""),
          }));
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(results) });
        } else {
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
 * Log in via the real login form using email/password.
 */
export async function loginAs(page: Page, role: "admin" | "ops" | "tech") {
  await page.context().clearCookies();
  const creds = CREDS[role];

  await page.goto("/login");
  await page.fill('input[autocomplete="email"]', creds.email);
  await page.fill('input[autocomplete="current-password"]', creds.password);
  await page.click('button[type="submit"]');

  if (role === "tech") {
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  } else {
    await page.waitForURL(/\/presale/, { timeout: 15000 });
  }
}

/** Take a labelled screenshot into the test-results screenshots folder. */
export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `tests/screenshots/${name}.png`, fullPage: true });
}

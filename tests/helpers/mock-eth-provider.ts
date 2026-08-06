/**
 * Mock EIP-1193 Ethereum provider for Playwright tests.
 *
 * Injects window.ethereum into the browser so Privy (and other web3 libs)
 * detect it as a MetaMask-style wallet.  All RPC method calls that need
 * signing or transaction broadcasting are relayed to a /__eth_relay__ route
 * which is intercepted in Node.js via page.route() — keeping private keys
 * out of the browser context entirely.
 */

import { Page } from "@playwright/test";
import { ethers } from "ethers";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111

/**
 * Returns a JavaScript string to be injected via page.addInitScript().
 * Sets window.ethereum to a mock EIP-1193 provider.
 */
export function makeMockEthScript(address: string, chainId = SEPOLIA_CHAIN_ID): string {
  const addr = address.toLowerCase();
  const chainIdHex = chainId;
  const networkVersion = String(parseInt(chainId, 16));

  return `
(function () {
  const _address   = ${JSON.stringify(addr)};
  const _chainId   = ${JSON.stringify(chainIdHex)};
  const _netVer    = ${JSON.stringify(networkVersion)};
  const _listeners = {};

  async function relay(method, params) {
    const res = await fetch("/__eth_relay__", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, params: params ?? [] }),
    });
    const data = await res.json();
    if (data && data.error) {
      const err = Object.assign(new Error(data.error.message || "RPC error"), { code: data.error.code });
      throw err;
    }
    return data.result;
  }

  const provider = {
    isMetaMask: true,
    isBraveWallet: false,
    isConnected: () => true,
    selectedAddress: _address,
    chainId: _chainId,
    networkVersion: _netVer,

    request: async ({ method, params }) => {
      if (method === "eth_requestAccounts" || method === "eth_accounts") return [_address];
      if (method === "eth_chainId")  return _chainId;
      if (method === "net_version")  return _netVer;
      return relay(method, params);
    },

    // legacy send (some libs use this)
    send: function (methodOrPayload, callbackOrParams) {
      if (typeof methodOrPayload === "string") {
        return provider.request({ method: methodOrPayload, params: callbackOrParams });
      }
      return provider.request(methodOrPayload);
    },

    on: (event, handler) => {
      (_listeners[event] = _listeners[event] || []).push(handler);
      return provider;
    },
    removeListener: (event, handler) => {
      if (_listeners[event]) _listeners[event] = _listeners[event].filter(h => h !== handler);
      return provider;
    },
    emit: (event, ...args) => {
      (_listeners[event] || []).forEach(h => h(...args));
    },
  };

  window.ethereum = provider;

  // EIP-6963 announcement so Privy v3+ picks it up
  const info = { uuid: "mock-test-wallet-" + _address, name: "MetaMask", icon: "", rdns: "io.metamask" };
  window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
    detail: Object.freeze({ info: Object.freeze(info), provider }),
  }));

  // Re-announce on request (EIP-6963 two-way handshake)
  window.addEventListener("eip6963:requestProvider", () => {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info: Object.freeze(info), provider }),
    }));
  });
})();
`;
}

/**
 * Installs a page.route() handler for /__eth_relay__ that:
 *  - Signs personal_sign / eth_sign / eth_signTypedData_v4 with the private key
 *  - Sends eth_sendTransaction to Sepolia via ethers.Wallet and returns the tx hash
 *  - Forwards all other calls to the Sepolia JSON-RPC
 */
export async function setupMockWallet(
  page: Page,
  privateKey: string,
  rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com",
): Promise<void> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new ethers.Wallet(privateKey, provider);

  await page.route("**/__eth_relay__", async (route) => {
    let body: { method: string; params?: unknown[] } = { method: "" };
    try {
      body = JSON.parse(route.request().postData() || "{}");
    } catch {
      await route.fulfill({ status: 200, body: JSON.stringify({ error: { code: -32700, message: "Parse error" } }) });
      return;
    }

    const { method, params = [] } = body;

    try {
      // ── Signing ───────────────────────────────────────────────────────────
      if (method === "personal_sign") {
        // params: [message, address]  (Privy SIWE uses this)
        const raw = params[0] as string;
        const msg = raw.startsWith("0x") ? ethers.getBytes(raw) : raw;
        const sig = await wallet.signMessage(msg);
        await route.fulfill({ status: 200, body: JSON.stringify({ result: sig }) });
        return;
      }

      if (method === "eth_sign") {
        // params: [address, message]
        const raw = params[1] as string;
        const sig = await wallet.signMessage(ethers.getBytes(raw));
        await route.fulfill({ status: 200, body: JSON.stringify({ result: sig }) });
        return;
      }

      if (method === "eth_signTypedData_v4") {
        // Privy may use this for some auth steps
        const typedData = typeof params[1] === "string" ? JSON.parse(params[1] as string) : params[1] as { domain: object; types: object; message: object };
        const sig = await wallet.signTypedData(
          typedData.domain as ethers.TypedDataDomain,
          typedData.types as Record<string, ethers.TypedDataField[]>,
          typedData.message as Record<string, unknown>,
        );
        await route.fulfill({ status: 200, body: JSON.stringify({ result: sig }) });
        return;
      }

      // ── Transaction ───────────────────────────────────────────────────────
      if (method === "eth_sendTransaction") {
        const txParams = params[0] as {
          to?: string;
          value?: string;
          data?: string;
          gas?: string;
          gasLimit?: string;
          gasPrice?: string;
          maxFeePerGas?: string;
          maxPriorityFeePerGas?: string;
          nonce?: string;
        };
        const tx = await wallet.sendTransaction({
          to:    txParams.to,
          value: txParams.value  ? BigInt(txParams.value)  : 0n,
          data:  txParams.data,
          ...(txParams.gas       ? { gasLimit: BigInt(txParams.gas) } : {}),
          ...(txParams.gasLimit  ? { gasLimit: BigInt(txParams.gasLimit) } : {}),
          ...(txParams.gasPrice  ? { gasPrice: BigInt(txParams.gasPrice) } : {}),
          ...(txParams.maxFeePerGas ? { maxFeePerGas: BigInt(txParams.maxFeePerGas) } : {}),
          ...(txParams.maxPriorityFeePerGas ? { maxPriorityFeePerGas: BigInt(txParams.maxPriorityFeePerGas) } : {}),
          ...(txParams.nonce     ? { nonce: parseInt(txParams.nonce, 16) } : {}),
        });
        await route.fulfill({ status: 200, body: JSON.stringify({ result: tx.hash }) });
        return;
      }

      // ── Forward all other calls to Sepolia RPC ────────────────────────────
      const rpcRes = await fetch(rpcUrl, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const rpcData = await rpcRes.json() as { result?: unknown; error?: { code: number; message: string } };
      await route.fulfill({ status: 200, body: JSON.stringify({ result: rpcData.result, error: rpcData.error }) });

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Internal relay error";
      await route.fulfill({ status: 200, body: JSON.stringify({ error: { code: -32603, message: msg } }) });
    }
  });
}

/**
 * Opens a fresh browser context for a customer wallet, injects the mock
 * window.ethereum, and sets up the signing relay.  Returns the page.
 * Call ctx.close() in a finally block when done.
 */
export async function openCustomerPage(
  browser: import("@playwright/test").Browser,
  privateKey: string,
  address: string,
  rpcUrl = "https://ethereum-sepolia-rpc.publicnode.com",
): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx  = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript({ content: makeMockEthScript(address) });
  await setupMockWallet(page, privateKey, rpcUrl);
  return { page, close: () => ctx.close() };
}

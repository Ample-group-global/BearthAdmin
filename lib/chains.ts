import { sepolia, mainnet } from "viem/chains";
import type { Chain } from "viem";

export interface ChainConfig {
  chain: Chain;
  chainId: number;
  name: string;
  shortName: string;
  contractAddress: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  color: string;
  deploymentBlock?: number;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    chain: mainnet,
    chainId: 1,
    name: "Ethereum",
    shortName: "ETH",
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_ETHEREUM || "0xcb4e007652727a807deD6e2625430B7935Eb6c84",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_ETHEREUM || "https://ethereum-rpc.publicnode.com",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    color: "gray",
    deploymentBlock: 25229971,
  },
  {
    chain: sepolia,
    chainId: 11155111,
    name: "Sepolia",
    shortName: "Sepolia",
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_SEPOLIA || "0xd32b9683e2E407A849138aE03677CEC30eda0730",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_SEPOLIA || "https://ethereum-sepolia-rpc.publicnode.com",
    blockExplorer: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    color: "purple",
    deploymentBlock: 8300000,
  },
];

export const DEFAULT_CHAIN = SUPPORTED_CHAINS[0]; // Ethereum mainnet

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
}

export function getChainConfigOrDefault(chainId: number): ChainConfig {
  return getChainConfig(chainId) || DEFAULT_CHAIN;
}

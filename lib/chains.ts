import { sepolia, baseSepolia, polygon, mainnet } from "viem/chains";
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
    chain: baseSepolia,
    chainId: 84532,
    name: "Base Sepolia",
    shortName: "Base Sep",
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_BASE_SEPOLIA || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0xB73690c6887979d21C75bcfAd106EbdC2393764B",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_BASE_SEPOLIA || "https://sepolia.base.org",
    blockExplorer: "https://sepolia.basescan.org",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    color: "blue",
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
  },
  {
    chain: polygon,
    chainId: 137,
    name: "Polygon",
    shortName: "Polygon",
    contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS_POLYGON || "0x2D77F2e142bfC9206277ab7A971E307Cc66e6164",
    rpcUrl: process.env.NEXT_PUBLIC_RPC_POLYGON || "https://polygon-mainnet.infura.io/v3/93c6b479917042ad9f64a9fe9d6c198d",
    blockExplorer: "https://polygonscan.com",
    nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
    color: "violet",
  },
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
];

export const DEFAULT_CHAIN = SUPPORTED_CHAINS[3]; // Ethereum mainnet

export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.chainId === chainId);
}

export function getChainConfigOrDefault(chainId: number): ChainConfig {
  return getChainConfig(chainId) || DEFAULT_CHAIN;
}

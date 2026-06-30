import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whitelist Management - Bearth NFT",
  description: "Manage NFT whitelist addresses",
};

export default function WhitelistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

export const dynamic = "force-dynamic";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bearth NFT Admin",
  description: "Bearth NFT Management Interface",
  icons: { icon: "/icon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${figtree.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

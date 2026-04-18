import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://ide-bridge.dev"),
  title: "ide-bridge — cross-IDE context bridge over MCP",
  description:
    "Save a structured checkpoint from one agentic IDE, resume it in another. Zero cloud, zero auth, localhost-only.",
  openGraph: {
    title: "ide-bridge — cross-IDE context bridge over MCP",
    description:
      "Save a structured checkpoint from one agentic IDE, resume it in another. Zero cloud, zero auth, localhost-only.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ide-bridge — cross-IDE context bridge over MCP",
    description:
      "Save a structured checkpoint from one agentic IDE, resume it in another. Zero cloud, zero auth, localhost-only.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plexMono.variable}>
      <body className="min-h-dvh flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

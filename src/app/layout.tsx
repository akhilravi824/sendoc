import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: {
    default: "sendoc — Publish AI conversations as shareable links",
    template: "%s · sendoc",
  },
  description:
    "Sendoc is the publishing layer for ChatGPT and Claude. Tell your AI to publish — get back a public URL anyone can open. No accounts, no setup.",
  applicationName: "sendoc",
  authors: [{ name: "sendoc" }],
  keywords: [
    "sendoc",
    "AI",
    "ChatGPT",
    "Claude",
    "MCP",
    "publish",
    "share",
    "document",
    "connector",
  ],
  openGraph: {
    type: "website",
    title: "sendoc — Publish AI conversations as shareable links",
    description:
      "Tell ChatGPT or Claude to publish to sendoc. Get back a public URL anyone can open.",
    siteName: "sendoc",
  },
  twitter: {
    card: "summary",
    title: "sendoc",
    description:
      "Publish AI conversations as shareable links — works with ChatGPT and Claude.",
  },
  themeColor: "#5b8def",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

import "./globals.css";
import type { Metadata } from "next";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "sendoc — AI documents you can share instantly",
  description:
    "Generate a document with AI, share it via secure link, collaborate in real time. Identity-gated access — works with Claude, GPT-4, and more.",
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

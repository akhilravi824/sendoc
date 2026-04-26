// Root page: redirect into the app immediately.
// Anonymous Firebase Auth means everyone gets a UID without signing in,
// so there's no login wall to gate behind.
//
// Later we can put a richer marketing landing here for logged-out / first
// visit, and only redirect signed-in users.

"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-gray-500">
      Loading sendoc…
    </main>
  );
}

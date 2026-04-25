"use client";

import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await signOut(auth);
        router.push("/");
      }}
      className="text-sm text-gray-500 hover:text-gray-900"
    >
      Sign out
    </button>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";

export default function LogoutPage() {
  const router = useRouter();
  const { signOut } = useProfile();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void signOut().finally(() => {
      router.replace("/auth/login");
      router.refresh();
    });
  }, [router, signOut]);

  return (
    <main
      className="grid min-h-[100dvh] place-items-center bg-[#030811] text-sm text-white/55"
      aria-busy="true"
    >
      Signing out securely…
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "../lib/supabase/browser";

type UserChipProps = {
  loginHref?: string; // where Guest should go
};

export default function UserChip({ loginHref = "/auth" }: UserChipProps) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser(data.user ?? null);
      setLoading(false);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // Loading state
  if (loading) {
    return (
      <div className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300">
        …
      </div>
    );
  }

  // Not logged in => Guest takes you to /auth
  if (!user) {
    return (
      <Link
        href={loginHref.startsWith("/") ? loginHref : `/${loginHref}`}
        className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-emerald-400 hover:text-emerald-200"
      >
        Guest
      </Link>
    );
  }

  // Logged in => show tiny chip + sign out
  const label = user.email ? user.email.split("@")[0] : "User";

  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        router.push(loginHref);
      }}
      className="rounded-full border border-emerald-600/60 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 hover:border-emerald-400"
      title="Sign out"
    >
      {label}
    </button>
  );
}

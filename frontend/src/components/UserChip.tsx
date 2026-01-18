"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "../lib/supabase/browser";

type UserChipProps = {
  loginHref?: string;
};

function bestLabel(user: User): string {
  const md: any = user.user_metadata ?? {};

  const candidate =
    md.full_name ||
    md.name ||
    md.display_name ||
    md.preferred_username ||
    md.username;

  if (candidate && String(candidate).trim().length > 0) {
    return String(candidate).trim();
  }

  if (user.email && user.email.includes("@")) {
    return user.email.split("@")[0];
  }

  return user.id ? user.id.slice(0, 8) : "User";
}

export default function UserChip({ loginHref = "/auth" }: UserChipProps) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [user, setUser] = useState<User | null>(null);
  const [label, setLabel] = useState("…");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);

      // Use getSession first (fast + reliable)
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user ?? null;

      if (!mounted) return;

      if (sessionUser) {
        setUser(sessionUser);
        setLabel(bestLabel(sessionUser));
        setLoading(false);

        // Verify user in background
        supabase.auth.getUser().then(({ data }) => {
          if (!mounted) return;
          const verified = data.user ?? sessionUser;
          setUser(verified);
          setLabel(bestLabel(verified));
        });

        return;
      }

      setUser(null);
      setLabel("Guest");
      setLoading(false);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (!u) {
        setLabel("Guest");
        return;
      }
      setLabel(bestLabel(u));
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  if (loading) {
    return (
      <div className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300">
        …
      </div>
    );
  }

  if (!user) {
    const href = loginHref.startsWith("/") ? loginHref : `/${loginHref}`;
    return (
      <Link
        href={href}
        className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-emerald-400 hover:text-emerald-200"
      >
        Guest
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={async () => {
        await supabase.auth.signOut();
        router.push(loginHref);
        router.refresh();
      }}
      className="rounded-full border border-emerald-600/60 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-200 hover:border-emerald-400"
      title="Sign out"
    >
      {label}
    </button>
  );
}

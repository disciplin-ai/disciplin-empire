"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "../lib/supabase/browser";

type UserChipProps = {
  loginHref?: string; // where Guest should go
};

function pickBestName(user: User): string {
  const md: any = user.user_metadata ?? {};

  // Common providers:
  // Google: full_name, name, picture
  // Others: preferred_username, username, etc.
  const candidates = [
    md.full_name,
    md.name,
    md.preferred_username,
    md.username,
    md.display_name,
  ]
    .filter(Boolean)
    .map((s: any) => String(s).trim())
    .filter((s: string) => s.length > 0);

  if (candidates.length > 0) return candidates[0];

  if (user.email && user.email.includes("@")) {
    return user.email.split("@")[0];
  }

  // last resort: short uid
  return user.id ? user.id.slice(0, 8) : "User";
}

export default function UserChip({ loginHref = "/auth" }: UserChipProps) {
  const router = useRouter();
  const supabase = useMemo(() => supabaseBrowser(), []);

  const [user, setUser] = useState<User | null>(null);
  const [label, setLabel] = useState<string>("…");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      setLoading(true);

      // 1) FAST: read session from storage/cookies
      const { data: sessionData } = await supabase.auth.getSession();
      const sessionUser = sessionData.session?.user ?? null;

      if (!mounted) return;

      if (sessionUser) {
        setUser(sessionUser);
        setLabel(pickBestName(sessionUser));
        setLoading(false);

        // 2) OPTIONAL verify: getUser() confirms token still valid
        // (If it fails, we gracefully fall back to sessionUser)
        supabase.auth.getUser().then(({ data }) => {
          if (!mounted) return;
          const verified = data.user ?? sessionUser;
          setUser(verified);
          setLabel(pickBestName(verified));
        });

        return;
      }

      // No session
      setUser(null);
      setLabel("Guest");
      setLoading(false);
    }

    boot();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setLabel("Guest");
        return;
      }

      setLabel(pickBestName(nextUser));
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

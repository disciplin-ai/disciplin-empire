"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

type ChipState = {
  loading: boolean;
  label: string;
  href: string;
};

function buildLabel(session: Session | null): ChipState {
  if (!session?.user) {
    return {
      loading: false,
      label: "Guest",
      href: "/auth/login",
    };
  }

  const user = session.user;
  const email = user.email?.trim() || "";
  const metaName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "";

  const label = metaName || email.split("@")[0] || "Profile";

  return {
    loading: false,
    label,
    href: "/profile",
  };
}

export default function UserChip() {
  const [state, setState] = useState<ChipState>({
    loading: true,
    label: "Guest",
    href: "/auth/login",
  });

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    let mounted = true;

    async function boot() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          setState({
            loading: false,
            label: "Guest",
            href: "/auth/login",
          });
          return;
        }

        setState(buildLabel(data.session));
      } catch {
        if (!mounted) return;
        setState({
          loading: false,
          label: "Guest",
          href: "/auth/login",
        });
      }
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState(buildLabel(session));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <Link
      href={state.href}
      className="inline-flex min-w-[88px] items-center justify-center rounded-full border border-emerald-500/30 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-400/50 hover:bg-slate-900/50"
      aria-label={state.loading ? "Loading user" : `Open ${state.label}`}
    >
      {state.loading ? "..." : state.label}
    </Link>
  );
}
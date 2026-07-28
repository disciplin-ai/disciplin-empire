"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useProfile } from "./ProfileProvider";

function getUserLabel(args: {
  loading: boolean;
  userEmail?: string | null;
  metaFullName?: string | null;
  metaName?: string | null;
  profileName?: string | null;
}) {
  const { loading, userEmail, metaFullName, metaName, profileName } = args;

  if (loading) {
    return {
      label: "Your profile",
      href: "/profile",
      loading: true,
      signedIn: false,
    };
  }

  const cleanedProfileName = profileName?.trim() || "";
  const cleanedFullName = metaFullName?.trim() || "";
  const cleanedMetaName = metaName?.trim() || "";
  const cleanedEmail = userEmail?.trim() || "";

  const label =
    cleanedProfileName ||
    cleanedFullName ||
    cleanedMetaName ||
    cleanedEmail.split("@")[0] ||
    "Sign in";

  const signedIn = label !== "Sign in";

  return {
    label,
    href: signedIn ? "/profile" : "/auth/login",
    loading: false,
    signedIn,
  };
}

export default function UserChip({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { user, profile, loading, signOut } = useProfile();

  const metaFullName =
    typeof user?.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : null;

  const metaName =
    typeof user?.user_metadata?.name === "string"
      ? user.user_metadata.name
      : null;

  const state = getUserLabel({
    loading,
    userEmail: user?.email ?? null,
    metaFullName,
    metaName,
    profileName: profile?.name ?? null,
  });

  const handleLogout = async () => {
    await signOut();
    router.push("/auth/login");
    router.refresh();
  };

  if (!state.signedIn) {
    if (compact) {
      return (
        <Link
          href={state.href}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.045] text-sm font-semibold text-white/72 transition hover:border-white/[0.16] hover:bg-white/[0.075] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          aria-label={state.loading ? "Loading user" : `Open ${state.label}`}
        >
          <span aria-hidden="true">{state.loading ? "·" : "→"}</span>
        </Link>
      );
    }

    return (
      <Link
        href={state.href}
        className="app-button-secondary min-h-9 min-w-[88px] px-3 text-xs"
        aria-label={state.loading ? "Loading user" : `Open ${state.label}`}
      >
        {state.label}
      </Link>
    );
  }

  if (compact) {
    const initial = state.label.trim().charAt(0).toLocaleUpperCase() || "A";

    return (
      <div className="flex items-center gap-1.5">
        <Link
          href={state.href}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-200/18 bg-emerald-300/[0.08] text-sm font-semibold text-emerald-100 transition hover:border-emerald-200/28 hover:bg-emerald-300/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          aria-label={`Open ${state.label}`}
          title={state.label}
        >
          <span aria-hidden="true">{initial}</span>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white/48 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          aria-label="Log out"
        >
          <LogOut aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={state.href}
        className="app-button-secondary min-h-9 min-w-[88px] max-w-36 truncate px-3 text-xs"
        aria-label={`Open ${state.label}`}
      >
        {state.label}
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="app-button-quiet min-h-9 px-2.5 text-xs"
      >
        Log out
      </button>
    </div>
  );
}

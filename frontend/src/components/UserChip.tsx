"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
      label: "...",
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
    "Guest";

  const signedIn = label !== "Guest";

  return {
    label,
    href: signedIn ? "/profile" : "/auth/login",
    loading: false,
    signedIn,
  };
}

export default function UserChip() {
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
    return (
      <Link
        href={state.href}
        className="inline-flex min-w-[88px] items-center justify-center rounded-full border border-emerald-500/30 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-400/50 hover:bg-slate-900/50"
        aria-label={state.loading ? "Loading user" : `Open ${state.label}`}
      >
        {state.label}
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={state.href}
        className="inline-flex min-w-[88px] items-center justify-center rounded-full border border-emerald-500/30 bg-slate-950/40 px-4 py-2 text-sm text-slate-100 transition hover:border-emerald-400/50 hover:bg-slate-900/50"
        aria-label={`Open ${state.label}`}
      >
        {state.label}
      </Link>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        Log out
      </button>
    </div>
  );
}
"use client";

import React from "react";
import AppShell from "./AppShell";
import ProfileForm from "./ProfileForm";
import { useProfile, type FighterProfile } from "../components/ProfileProvider";

export default function ProfileClient() {
  const { user, loading, profile, saveProfile } = useProfile();

  const isLoggedIn = !!user;

  async function onSave(next: FighterProfile): Promise<{ ok: boolean; error?: string }> {
    const res = await saveProfile(next);
    if (res.ok) return { ok: true };
    return { ok: false, error: res.error };
  }

  return (
    <AppShell
      badge="PROFILE"
      title="Your fighter profile"
      subtitle="This profile powers Fuel, Sensei, and Vision."
    >
      <ProfileForm
        initialProfile={profile}
        loading={loading}
        isLoggedIn={isLoggedIn}
        onSave={onSave}
      />
    </AppShell>
  );
}
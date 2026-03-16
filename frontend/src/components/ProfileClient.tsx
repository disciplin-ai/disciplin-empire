"use client";

import React from "react";
import AppShell from "./AppShell";
import ProfileForm from "./ProfileForm";

export default function ProfileClient() {
  return (
    <AppShell
      badge="PROFILE"
      title="Camp identity"
      subtitle="Fill this once. Sensei + Fuel + Vision should pull this automatically."
    >
      <ProfileForm />
    </AppShell>
  );
}
// src/app/profile/layout.tsx
"use client";

import React from "react";
import { ProfileProvider } from "../../components/ProfileProvider";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This wraps ONLY the /profile pages in ProfileProvider
  return <ProfileProvider>{children}</ProfileProvider>;
}

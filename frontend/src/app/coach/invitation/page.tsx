import { Suspense } from "react";
import CoachInvitationClient from "@/components/CoachInvitationClient";

export default function CoachInvitationPage() {
  return (
    <Suspense fallback={<main className="app-canvas min-h-screen" />}>
      <CoachInvitationClient />
    </Suspense>
  );
}


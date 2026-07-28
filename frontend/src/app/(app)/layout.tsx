import { Suspense } from "react";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";
import WorkflowDock from "@/components/WorkflowDock";
import { ShellInteractionProvider } from "@/components/ShellInteractionProvider";
import ShellOverlayController from "@/components/ShellOverlayController";
import AppAccessGate from "@/components/AppAccessGate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="app-canvas px-5 py-5">
          <div className="app-skeleton h-12" />
          <div className="app-surface mx-auto mt-8 min-h-[55vh] max-w-5xl p-6" aria-busy="true">
            <div className="app-skeleton h-3 w-28" />
            <div className="app-skeleton mt-6 h-10 max-w-md" />
            <div className="app-skeleton mt-4 h-4 max-w-xl" />
          </div>
        </div>
      }
    >
      <ShellInteractionProvider>
        <div className="app-canvas min-h-screen overflow-visible">
          <Navbar />

          <main className="app-main-shell">
            <div className="app-page-frame">
              <AppAccessGate>{children}</AppAccessGate>
            </div>
          </main>

          <BottomNav />
          <WorkflowDock />
          <ShellOverlayController />
        </div>
      </ShellInteractionProvider>
    </Suspense>
  );
}

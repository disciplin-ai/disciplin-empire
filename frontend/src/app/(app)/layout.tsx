import { ProfileProvider } from "@/components/ProfileProvider";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <Navbar />

        <main className="app-main-shell">
          <div className="app-page-frame">{children}</div>
        </main>

        <BottomNav />
      </div>
    </ProfileProvider>
  );
}
import { ProfileProvider } from "@/components/ProfileProvider";
import Navbar from "@/components/Navbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <div className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <Navbar />

        {/* 
          Navbar is fixed.
          Mobile has 2 rows (top bar + module bar) -> more top padding.
          Desktop has 1 row -> less top padding.
        */}
        <main className="pt-24 md:pt-16 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </ProfileProvider>
  );
}
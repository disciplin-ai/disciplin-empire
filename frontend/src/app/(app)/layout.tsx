import { ProfileProvider } from "@/components/ProfileProvider";
import Navbar from "@/components/Navbar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <div className="min-h-screen bg-slate-950 text-slate-50">
        <Navbar />
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </div>
    </ProfileProvider>
  );
}
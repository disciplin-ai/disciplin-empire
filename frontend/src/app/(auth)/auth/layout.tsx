import type { Metadata } from "next";
import "../../globals.css";
import { ProfileProvider } from "@/components/ProfileProvider";

export const metadata: Metadata = {
  title: "Disciplin",
  description: "Disciplin",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProfileProvider>
      <div className="min-h-screen bg-slate-950 text-slate-50">
        {children}
      </div>
    </ProfileProvider>
  );
}
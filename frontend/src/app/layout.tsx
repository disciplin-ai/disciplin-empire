// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

import Navbar from "../components/Navbar";
import { AuthProvider } from "../components/AuthProvider";
import { ProfileProvider } from "../components/ProfileProvider";
import { NutritionProvider } from "../components/NutritionProvider";

export const metadata: Metadata = {
  title: "Disciplin OS",
  description: "Personal martial arts operating system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50 antialiased">
        <AuthProvider>
          <ProfileProvider>
            <NutritionProvider>
              <div className="min-h-screen flex flex-col">
                {/* Top navigation visible on all pages */}
                <Navbar />

                {/* Main content */}
                <main className="pt-16 min-h-screen">{children}</main>
              </div>
            </NutritionProvider>
          </ProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

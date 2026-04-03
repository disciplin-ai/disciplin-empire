import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});

export const metadata: Metadata = {
  title: "Disciplin",
  description: "Disciplin",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode; // ✅ THIS FIXES YOUR ERROR
}) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body className="bg-slate-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
import type { Metadata, Viewport } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import { ProfileProvider } from "@/components/ProfileProvider"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
})

export const metadata: Metadata = {
  title: "Disciplin — Fight Camp OS",
  description:
    "Elite performance operating system for fighters. One correction controls the session.",
}

export const viewport: Viewport = {
  themeColor: "#020810",
  colorScheme: "dark",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark bg-[#020810]">
      <body
        className={`${inter.variable} ${geistMono.variable} font-sans antialiased bg-[#020810] text-white`}
      >
        <ProfileProvider>{children}</ProfileProvider>
      </body>
    </html>
  )
}
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ProfileProvider } from "@/components/ProfileProvider"
import { CoachProvider } from "@/components/CoachProvider"
import { WorkflowProvider } from "@/components/WorkflowProvider"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
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
    <html lang="en" className="dark bg-[#020810]" data-scroll-behavior="smooth">
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans antialiased bg-[#020810] text-white`}
      >
        <ProfileProvider>
          <CoachProvider>
            <WorkflowProvider>{children}</WorkflowProvider>
          </CoachProvider>
        </ProfileProvider>
      </body>
    </html>
  )
}

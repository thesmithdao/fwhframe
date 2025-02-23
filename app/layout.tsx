import type { Metadata } from "next"
import { Share_Tech_Mono } from "next/font/google"
import "./globals.css"

const share_tech_mono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
})

export const metadata: Metadata = {
  title: "Faucet Frame",
  description: "A Faucet inside a Warpcast Frame",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={share_tech_mono.className}
        style={{ width: "100%", height: "100vh" }}
      >
        {children}
      </body>
    </html>
  )
}

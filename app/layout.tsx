import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SyncProvider from "@/components/SyncProvider";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "REPS",
  description: "Log the set, load the bar.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "REPS",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0b0e",
  viewportFit: "cover",
  // Keeps the fixed bottom nav above the keyboard instead of under it.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="min-h-full">
        <div
          className="mx-auto max-w-md px-4"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 16px)",
            paddingBottom: "calc(96px + env(safe-area-inset-bottom))",
          }}
        >
          <SyncProvider>{children}</SyncProvider>
        </div>
        <BottomNav />
      </body>
    </html>
  );
}

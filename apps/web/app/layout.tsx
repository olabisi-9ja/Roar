import type { Metadata, Viewport } from "next";
import { Anton, Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { OfflineBanner, ServiceWorker } from "@/components/Pwa";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const barlow = Barlow({ variable: "--font-barlow", weight: ["400", "500", "600", "700"], subsets: ["latin"] });
const barlowCond = Barlow_Condensed({ variable: "--font-barlow-cond", weight: ["600", "700", "800"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Roar",
  description: "Every fan is another angle. AI turns the crowd's footage into one live match story.",
  applicationName: "Roar",
  icons: { icon: [{ url: "/mark.svg", type: "image/svg+xml" }, { url: "/icon-192.png", sizes: "192x192" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Roar", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#3A0648",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${barlow.variable} ${barlowCond.variable}`}>
      <body>
        <div className="app">
          <OfflineBanner />
          {children}
        </div>
        <ServiceWorker />
      </body>
    </html>
  );
}

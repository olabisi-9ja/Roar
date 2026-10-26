import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Anton, Barlow, Barlow_Condensed } from "next/font/google";
import { Nav } from "@/components/Nav";
import { SystemStatus } from "@/components/Status";
import "./globals.css";

const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
const barlow = Barlow({ variable: "--font-barlow", weight: ["400", "500", "600", "700"], subsets: ["latin"] });
const barlowCond = Barlow_Condensed({ variable: "--font-barlow-cond", weight: ["600", "700", "800"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Roar Control Room",
  description: "Curate the fan feed and manage stadium security incidents.",
  icons: { icon: "/mark.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${anton.variable} ${barlow.variable} ${barlowCond.variable} h-full antialiased`}>
      <body className="min-h-full md:flex">
        <aside className="flex flex-col gap-6 border-b border-[var(--line)] p-5 md:sticky md:top-0 md:h-screen md:w-64 md:flex-none md:border-r md:border-b-0">
          <Link href="/" className="flex items-center gap-3">
            <img src="/mark.svg" alt="" width={44} height={44} className="rounded-xl" />
            <span>
              <span className="display block text-3xl">Roar</span>
              <span className="label">Control room</span>
            </span>
          </Link>
          <Nav />
          <div className="mt-auto hidden md:block">
            <Suspense fallback={<p className="label">Checking system…</p>}>
              <SystemStatus />
            </Suspense>
          </div>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </body>
    </html>
  );
}

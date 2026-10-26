"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Overview"],
  ["/curate", "Feed curation"],
  ["/incidents", "Security"],
] as const;

export function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 md:flex-col" aria-label="Admin">
      {LINKS.map(([href, label]) => {
        const active = href === "/" ? path === "/" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-2xl px-4 py-3 font-[family-name:var(--font-barlow-cond)] text-lg font-bold uppercase tracking-wide transition-colors ${active ? "bg-[var(--yellow)] text-[var(--ink)]" : "text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-white"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

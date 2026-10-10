"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

// Three main things. Everything else lives in the avatar menu (components/Menu.tsx); SOS stays in the header.
const TABS: { href: string; label: string; icon: IconName; match: string[] }[] = [
  { href: "/live", label: "For You", icon: "live", match: ["/live", "/moment", "/home", "/stats"] },
  { href: "/capture", label: "Capture", icon: "cam", match: ["/capture"] },
  { href: "/play", label: "Play", icon: "play", match: ["/play"] },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {TABS.map((t) => {
        const on = t.match.some((m) => path === m || path.startsWith(m + "/"));
        return (
          <Link key={t.href} href={t.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            <Icon name={t.icon} />
            <span className={on ? "" : "nav-label"}>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

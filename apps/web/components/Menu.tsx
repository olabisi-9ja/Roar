"use client";

import Link from "next/link";
import { useRef } from "react";
import { Icon, type IconName } from "./Icon";
import { me } from "@/lib/data";

const ITEMS: { href: string; label: string; sub: string; icon: IconName }[] = [
  { href: "/home", label: "Match centre", sub: "Score, latest moments, games", icon: "home" },
  { href: "/stats", label: "Live stats", sub: "Possession, shots, timeline", icon: "stats" },
  { href: "/matches", label: "Change match", sub: "Roar League fixtures", icon: "search" },
  { href: "/me", label: "My profile", sub: "Captures, crowns, settings", icon: "user" },
];

/** Avatar button that opens everything that isn't one of the three main tabs. Native <dialog>: focus trap and Esc for free. */
export function MenuButton({ light = false }: { light?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = () => ref.current?.close();
  return (
    <>
      <button type="button" className={`av o`} aria-label="Open menu" aria-haspopup="dialog" onClick={() => ref.current?.showModal()} style={{ width: 40, height: 40, boxShadow: light ? "0 0 0 2px var(--paper)" : undefined }}>
        {me.initials}
      </button>
      <dialog ref={ref} className="sheet" aria-label="Menu" onClick={(e) => e.target === ref.current && close()}>
        <div className="col" style={{ gap: 4 }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <div className="flex"><span className="av o">{me.initials}</span><div><b className="h3">{me.name}</b><div className="small">Section {me.section} · {me.crowns.toLocaleString()} crowns</div></div></div>
            <button type="button" className="iconbtn" aria-label="Close menu" onClick={close}><Icon name="x" /></button>
          </div>
          {ITEMS.map((i) => (
            <Link key={i.href} href={i.href} className="li" onClick={close} style={{ textAlign: "left" }}>
              <span className="av t" style={{ width: 40, height: 40 }}><Icon name={i.icon} size="s" /></span>
              <span className="grow"><b className="h3" style={{ fontSize: 18 }}>{i.label}</b><span className="small" style={{ display: "block" }}>{i.sub}</span></span>
              <Icon name="chev" size="s" />
            </Link>
          ))}
          <Link href="/sos" className="pill full o" onClick={close} style={{ marginTop: 12 }}>SOS · Get help in the stadium</Link>
        </div>
      </dialog>
    </>
  );
}

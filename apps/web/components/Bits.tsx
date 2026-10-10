import Link from "next/link";
import { Icon } from "./Icon";
import { me } from "@/lib/data";
import { MenuButton } from "./Menu";

export function TopBar() {
  return (
    <div className="between">
      <Link href="/home" className="brand">
        <img className="mark" src="/mark.svg" alt="" />
        <span className="word">Roar</span>
      </Link>
      <div className="flex">
        <Link className="pill sm o" href="/sos">SOS</Link>
        <MenuButton />
      </div>
    </div>
  );
}

export function Back({ href, label = "Back" }: { href: string; label?: string }) {
  return (
    <Link className="iconbtn" href={href} aria-label={label}>
      <Icon name="back" />
    </Link>
  );
}

export function Crowns({ n }: { n: number }) {
  return <span className="chip"><Icon name="crown" size="s" style={{ color: "var(--yellow)" }} />{n.toLocaleString()}</span>;
}

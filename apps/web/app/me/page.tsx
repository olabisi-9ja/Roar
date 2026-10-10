import Link from "next/link";
import { Nav } from "@/components/Nav";
import { me } from "@/lib/data";

export default function Me() {
  return (
    <>
      <main className="scr enter">
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <div className="av o" style={{ width: 110, height: 110, margin: "0 auto", fontSize: 36, boxShadow: "0 0 0 5px var(--paper), 0 10px 26px rgba(58,6,72,.2)" }}>{me.initials}</div>
          <h1 className="d3" style={{ margin: "14px 0 0" }}>{me.name}</h1>
          <div className="small">Section {me.section} regular · 12 matches</div>
        </div>
        <div className="grid3" style={{ textAlign: "center" }}>
          <div className="card o" style={{ padding: 14 }}><div className="d3">{me.captures}</div><div className="h3" style={{ fontSize: 14 }}>Captures</div></div>
          <div className="card y" style={{ padding: 14 }}><div className="d3">{me.featured}</div><div className="h3" style={{ fontSize: 14 }}>Featured</div></div>
          <div className="card g" style={{ padding: 14 }}><div className="d3">{(me.crowns / 1000).toFixed(1)}k</div><div className="h3" style={{ fontSize: 14 }}>Crowns</div></div>
        </div>
        <div className="between"><h2 className="d4" style={{ margin: 0 }}>My moments</h2><Link className="lab" href="/capture" style={{ color: "var(--ink)" }}>Capture</Link></div>
        <div className="grid3">
          <Link className="thumb" href="/moment/goal-7214" style={{ width: "auto", height: 110, borderRadius: 18 }} aria-label="Goal 72:14" />
          <Link className="thumb" href="/moment/celebration-7220" style={{ width: "auto", height: 110, borderRadius: 18 }} aria-label="Celebration 72:20" />
          <Link className="thumb" href="/moment/save-6402" style={{ width: "auto", height: 110, borderRadius: 18 }} aria-label="Save 64:02" />
        </div>
        <Link className="pill full ghost" href="/welcome">Replay onboarding</Link>
      </main>
      <Nav />
    </>
  );
}

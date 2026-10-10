import Link from "next/link";

export default function Welcome() {
  return (
    <main className="scr no-nav enter">
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <img src="/mark.svg" alt="" style={{ width: 84 }} />
      </div>
      <h1 className="d1" style={{ textAlign: "center", fontSize: 104, margin: "-4px 0 0" }}>Roar</h1>
      <div style={{ position: "relative", height: 270, margin: "0 6px" }} aria-hidden="true">
        <div className="photo" style={{ position: "absolute", left: 10, top: 30, width: 150, height: 210, backgroundColor: "var(--yellow)", transform: "rotate(-4deg)" }}><span>Fan filming</span></div>
        <div className="photo" style={{ position: "absolute", right: 14, top: 6, width: 170, height: 150, backgroundColor: "var(--blue)", transform: "rotate(3deg)" }}><span>Crowd</span></div>
        <div className="photo" style={{ position: "absolute", right: 40, bottom: 0, width: 150, height: 110, backgroundColor: "var(--green)" }}><span>Celebration</span></div>
        <i className="cf" style={{ left: 170, top: 12, background: "var(--orange)", transform: "rotate(24deg)" }} />
        <i className="cf" style={{ left: 150, top: 250, background: "var(--ink)", transform: "rotate(-30deg)" }} />
        <i className="cf" style={{ right: 10, top: 170, background: "var(--yellow)", transform: "rotate(60deg)" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 className="h3" style={{ fontSize: 26, margin: 0 }}>Every fan is another angle</h2>
        <p className="body" style={{ marginTop: 8, padding: "0 12px" }}>
          Capture the match from your seat. AI turns the whole crowd&apos;s footage into one live story, with games to play while you watch.
        </p>
      </div>
      <div className="mt-auto" style={{ display: "flex", justifyContent: "center" }}>
        <Link className="pill big" href="/matches">Get started</Link>
      </div>
    </main>
  );
}

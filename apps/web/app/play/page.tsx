import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Nav } from "@/components/Nav";
import { Crowns } from "@/components/Bits";
import { me } from "@/lib/data";

export default function Play() {
  return (
    <>
      <main className="scr enter">
        <div className="between"><h1 className="d1" style={{ fontSize: 84, margin: 0 }}>Play</h1><Crowns n={me.crowns} /></div>
        <p className="body">Games written by AI from this match, live. Beat your section to the top.</p>

        <Link className="card o" href="/play/call-it" style={{ height: 290 }}>
          <div className="between"><span className="tag">Live</span><span className="tag w"><Icon name="ai" size="s" />AI</span></div>
          <div className="d2" style={{ marginTop: 10 }}>Call It</div>
          <p style={{ fontWeight: 600, marginTop: 6, maxWidth: 210 }}>Predict what happens next. AI writes a new call every few minutes from live match data.</p>
          <div className="photo" style={{ position: "absolute", right: 0, bottom: 0, width: 150, height: 120, borderRadius: "18px 0 0 0" }}><span>Fans cut-out</span></div>
          <i className="cf" style={{ left: 30, bottom: 40, background: "var(--yellow)", transform: "rotate(30deg)" }} />
          <i className="cf" style={{ left: 80, bottom: 60, background: "var(--ink)", transform: "rotate(-40deg)" }} />
        </Link>

        <div className="grid2">
          <Link className="card g" href="/play/quiz" style={{ height: 150 }}><span className="tag w">4 Qs</span><div className="d4" style={{ marginTop: 10 }}>Match Quiz</div><p className="small" style={{ color: "var(--ink)" }}>Built from this match</p></Link>
          <Link className="card y" href="/play/leaderboard" style={{ height: 150 }}><span className="tag w">Section C</span><div className="d4" style={{ marginTop: 10 }}>Leaderboard</div><p className="small" style={{ color: "var(--ink)" }}>You&apos;re 14th</p></Link>
        </div>

        <h2 className="d4" style={{ margin: 0 }}>Coming next</h2>
        <div className="li"><span className="av b"><Icon name="cam" /></span><span className="grow"><b className="h3" style={{ fontSize: 18 }}>Guess the Angle</b><span className="small" style={{ display: "block" }}>Which stand filmed this clip?</span></span><span className="tag line">Soon</span></div>
      </main>
      <Nav />
    </>
  );
}

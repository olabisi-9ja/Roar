"use client";

import { useEffect, useState } from "react";
import { useOffline } from "next/offline";
import { flushUploads } from "@/lib/uploads";

/** Registers the service worker and sends any clips queued while offline. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const mode = process.env.NODE_ENV === "production" ? "prod" : "dev";
      navigator.serviceWorker.register(`/sw.js?mode=${mode}`, { scope: "/", updateViaCache: "none" }).catch(() => {
        // No service worker (e.g. plain http on a LAN IP): the app still works online.
      });
    }
    flushUploads();
    window.addEventListener("online", flushUploads);
    return () => window.removeEventListener("online", flushUploads);
  }, []);
  return null;
}

export function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div role="status" style={{ position: "sticky", top: 0, zIndex: 40, background: "var(--yellow)", color: "var(--ink)", padding: "10px 16px", font: "700 14px var(--cond)", letterSpacing: "0.02em" }}>
      You&apos;re offline. Showing the last score we had. New clips upload when you&apos;re back.
    </div>
  );
}

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const DISMISS_KEY = "roar.installDismissed";

/** Install hint: a real button on Android/desktop Chrome, instructions on iPhone. */
export function InstallBanner() {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIos(isIos);
    if (isIos) setHidden(false);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  };

  return (
    <div className="card t" style={{ padding: "14px 16px", borderRadius: 20, display: "flex", alignItems: "center", gap: 12 }}>
      <img src="/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
      <div className="grow">
        <b className="h3" style={{ fontSize: 17 }}>Install Roar</b>
        <p className="small">{ios ? "Tap Share, then Add to Home Screen." : "Full screen, faster, and works when the stadium network drops."}</p>
      </div>
      {event && (
        <button type="button" className="pill sm" onClick={async () => { await event.prompt(); await event.userChoice; setHidden(true); }}>
          Install
        </button>
      )}
      <button type="button" className="iconbtn" style={{ width: 36, height: 36, boxShadow: "none", background: "transparent" }} aria-label="Dismiss" onClick={dismiss}>×</button>
    </div>
  );
}

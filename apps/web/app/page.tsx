"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const returningFan = () => {
  try {
    return !!localStorage.getItem("roar.matchId");
  } catch {
    return false;
  }
};

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const returning = returningFan();
    const to = returning ? "/live" : "/welcome";
    // Returning fans see the first beat of the animation, then go straight to For You.
    const t = setTimeout(() => router.replace(to), reduced ? 600 : returning ? 1200 : 3700);
    return () => clearTimeout(t);
  }, [router]);

  const skip = () => router.replace(returningFan() ? "/live" : "/welcome");

  return (
    <button type="button" className="splash" onClick={skip} aria-label="Roar. Tap to skip">
      <i className="sq sq-o" />
      <i className="sq sq-y" />
      <i className="sq sq-g" />
      <i className="sq sq-b" />
      <img className="mark-anim" src="/mark.svg" alt="" />
      <span className="skip lab">Tap to skip</span>
    </button>
  );
}

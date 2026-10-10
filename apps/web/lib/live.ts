"use client";

import { useCallback, useEffect, useState } from "react";
import type { Fixture, MatchDetail, MatchEvent, MatchList } from "@inside/types";
import type { Accent } from "./data";

// The API caches the provider, so polling it every 15s costs no extra provider calls.
const POLL_MS = 15_000;
const MATCH_KEY = "roar.matchId";

export function useApi<T>(path: string | null, poll = false) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api${path}`, { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        if (alive) {
          setData(body as T);
          setError(null);
        }
      } catch (e) {
        // Keep showing the last good data; just surface the error.
        if (alive) setError(e instanceof Error ? e.message : "Something went wrong");
      }
    };
    load();
    const t = poll ? setInterval(load, POLL_MS) : undefined;
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [path, poll]);

  return { data, error, loading: !data && !error };
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
  return json as T;
}

function readStored() {
  try {
    return localStorage.getItem(MATCH_KEY);
  } catch {
    return null;
  }
}

export function selectMatch(id: string) {
  try {
    localStorage.setItem(MATCH_KEY, id);
  } catch {
    // private mode: falls back to the default match
  }
}

/** The match the fan picked, or the best default: live first, then next up, then latest result. */
export function useCurrentMatch() {
  const list = useApi<MatchList>("/matches", true);
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => setStored(readStored()), []);

  const all = list.data ? [...list.data.live, ...list.data.upcoming, ...list.data.recent] : [];
  const id = (stored && all.some((f) => f.id === stored) ? stored : all[0]?.id) ?? null;
  const detail = useApi<MatchDetail>(id ? `/matches/${id}` : null, true);

  const pick = useCallback((next: string) => {
    selectMatch(next);
    setStored(next);
  }, []);

  return {
    list: list.data,
    match: detail.data,
    error: detail.error ?? list.error,
    loading: list.loading || (!!id && detail.loading),
    empty: !!list.data && all.length === 0,
    pick,
  };
}

export const scoreline = (f: Fixture) => (f.score ? `${f.score[0]}–${f.score[1]}` : "vs");

export function clock(f: Fixture) {
  if (f.status === "LIVE") return f.minute !== null ? `${f.minute}'` : f.statusText;
  if (f.status === "FINISHED") return "FT";
  return kickoffText(f.kickoff);
}

export function kickoffText(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export const minuteText = (e: MatchEvent) => (e.extra ? `${e.minute}+${e.extra}'` : `${e.minute}'`);

/** Official events are the anchors for Moments (TRD 2.4): fan clips around this minute join it. */
export function momentOf(e: MatchEvent, f: Fixture) {
  const team = e.team === "home" ? f.home.name : f.away.name;
  const by = e.player ?? team;
  switch (e.type) {
    case "Goal":
      return {
        label: e.detail === "Own Goal" ? "Own goal" : e.detail === "Penalty" ? "Penalty goal" : "Goal",
        title: `${by} scores!`,
        summary: e.assist ? `${team}. Assisted by ${e.assist}.` : `${team}. ${e.detail}.`,
        accent: "y" as Accent,
      };
    case "Card":
      return { label: e.detail, title: `${e.detail} for ${by}`, summary: team, accent: (e.detail.startsWith("Red") ? "o" : "y") as Accent };
    case "Sub":
      return { label: "Substitution", title: `${team} change`, summary: [e.player, e.assist].filter(Boolean).join(" ↔ "), accent: "b" as Accent };
    default:
      return { label: "VAR", title: e.detail, summary: team, accent: "b" as Accent };
  }
}

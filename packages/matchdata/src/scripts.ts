import type { MatchScript } from "./types.js";

// Roar League matchday 1. Hand-written storylines; the Match Writer agent produces more in the same shape.

export const SCRIPTS: MatchScript[] = [
  {
    id: "rl-01",
    seed: 7101,
    title: "Northgate United v Kestrel Park",
    storyline: "Kestrel Park control the first half and lead through a well-worked goal. Northgate press higher after the break, the game turns chaotic, and two late goals complete the comeback.",
    home: "ngu",
    away: "kes",
    momentum: [
      { from: 0, to: 30, home: 0.38 },
      { from: 30, to: 45, home: 0.45 },
      { from: 45, to: 60, home: 0.58 },
      { from: 60, to: 80, home: 0.66 },
      { from: 80, to: 100, home: 0.55 },
    ],
    goals: [
      { minute: 23, side: "away", scorer: "kes-9", assist: "kes-10" },
      { minute: 61, side: "home", scorer: "ngu-7", assist: "ngu-8" },
      { minute: 84, side: "home", scorer: "ngu-9", assist: "ngu-11", kind: "header" },
    ],
    cards: [
      { minute: 38, side: "away", player: "kes-6", color: "yellow" },
      { minute: 70, side: "home", player: "ngu-4", color: "yellow" },
    ],
    subs: [
      { minute: 58, side: "home", off: "ngu-10", on: "ngu-14" },
      { minute: 72, side: "away", off: "kes-11", on: "kes-19" },
      { minute: 79, side: "home", off: "ngu-5", on: "ngu-15" },
    ],
    addedTime: [2, 5],
  },
  {
    id: "rl-02",
    seed: 7202,
    title: "Ashbury Rovers v Saltmarsh Athletic",
    storyline: "A tight, tactical game. Saltmarsh score from the spot before the break; Ashbury dominate the ball but need until the 77th minute to break through.",
    home: "ash",
    away: "sal",
    momentum: [
      { from: 0, to: 45, home: 0.55 },
      { from: 45, to: 100, home: 0.63 },
    ],
    goals: [
      { minute: 41, side: "away", scorer: "sal-9", kind: "penalty" },
      { minute: 77, side: "home", scorer: "ash-10", assist: "ash-2" },
    ],
    cards: [{ minute: 40, side: "home", player: "ash-5", color: "yellow" }],
    subs: [
      { minute: 64, side: "home", off: "ash-11", on: "ash-19" },
      { minute: 81, side: "away", off: "sal-7", on: "sal-14" },
    ],
    addedTime: [3, 4],
  },
  {
    id: "rl-03",
    seed: 7303,
    title: "Thornfield City v Westvale Wanderers",
    storyline: "An end-to-end thriller. Thornfield race into a two-goal lead, Westvale hit back twice, and a stoppage-time winner settles it.",
    home: "thc",
    away: "wes",
    momentum: [
      { from: 0, to: 25, home: 0.64 },
      { from: 25, to: 70, home: 0.45 },
      { from: 70, to: 100, home: 0.52 },
    ],
    goals: [
      { minute: 9, side: "home", scorer: "thc-9", assist: "thc-7" },
      { minute: 18, side: "home", scorer: "thc-11" },
      { minute: 52, side: "away", scorer: "wes-10", assist: "wes-9" },
      { minute: 66, side: "away", scorer: "wes-9", assist: "wes-7" },
      { minute: 92, side: "home", scorer: "thc-14", assist: "thc-10" },
    ],
    cards: [
      { minute: 31, side: "away", player: "wes-4", color: "yellow" },
      { minute: 88, side: "home", player: "thc-6", color: "yellow" },
    ],
    subs: [
      { minute: 60, side: "home", off: "thc-8", on: "thc-14" },
      { minute: 74, side: "away", off: "wes-11", on: "wes-19" },
    ],
    addedTime: [1, 5],
  },
];

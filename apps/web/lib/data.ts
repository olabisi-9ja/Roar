// Still-demo data: the fan profile (until auth), the quiz and the leaderboard (until the games service).
// Live match data comes from the API: see lib/live.ts.

export type Accent = "o" | "y" | "g" | "b";

export const me = { name: "Ade O.", initials: "AO", section: "C", row: 12, crowns: 1240, captures: 34, featured: 9 };

export const quiz = [
  { q: "Who set up the 72:14 goal?", options: ["#10, through the middle", "#7, slide-rule pass", "#11, cut-back", "Nobody, solo run"], answer: 1 },
  { q: "Which stand filmed the most angles of the goal?", options: ["South stand", "East stand", "North stand", "Behind goal"], answer: 2 },
  { q: "How many shots on target have Arsenal had?", options: ["2", "4", "6", "9"], answer: 2 },
  { q: "What hit the bar at 64:02?", options: ["A header from #9", "A curling shot from #11", "A free kick from #10", "An own goal attempt"], answer: 1 },
];

export const leaderboard = [
  { rank: 1, name: "Emma M.", initials: "EM", crowns: 3104, accent: "y" as Accent },
  { rank: 2, name: "Sophie C.", initials: "SC", crowns: 2880, accent: "b" as Accent },
  { rank: 3, name: "Andrew W.", initials: "AW", crowns: 2640, accent: "g" as Accent },
  { rank: 14, name: "Ade O.", initials: "AO", crowns: 1240, accent: "o" as Accent, me: true },
  { rank: 15, name: "Olivia A.", initials: "OA", crowns: 1180, accent: "b" as Accent },
  { rank: 16, name: "David J.", initials: "DJ", crowns: 1020, accent: "g" as Accent },
  { rank: 17, name: "Charlotte H.", initials: "CH", crowns: 990, accent: "y" as Accent },
];

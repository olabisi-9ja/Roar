import type { Club, Player, Position } from "./types.js";
import { rng } from "./rng.js";

// Fictional clubs and players for the Roar League. Any resemblance to real people is unintended.

const FIRST = [
  "Tomas", "Kofi", "Luca", "Elias", "Marek", "Dayo", "Jonah", "Rui", "Idris", "Felix", "Nico", "Arlo", "Sami", "Teo",
  "Bram", "Kai", "Oren", "Emeka", "Callum", "Matteo", "Joel", "Ravi", "Anders", "Yusuf", "Leon", "Hugo", "Ade", "Pavel",
  "Ilan", "Noel", "Bilal", "Iker", "Malik", "Soren", "Dario", "Femi", "Rory", "Elio", "Tariq", "Jude", "Wale", "Zane",
];
const LAST = [
  "Ashdown", "Okoro", "Varga", "Lindvall", "Moreau", "Adeyemi", "Castell", "Brennan", "Haddad", "Novak", "Quaye",
  "Thorne", "Kowal", "Ferreira", "Ravenshaw", "Delmar", "Osei", "Halloran", "Sato", "Marsh", "Ekwueme", "Duarte",
  "Fenwick", "Larsen", "Mbatha", "Coyle", "Ibarra", "Whitlock", "Nakamura", "Petrov", "Achebe", "Rourke", "Valdez",
  "Kingsley", "Okafor", "Strand", "Moyo", "Carvell", "Ekstrom", "Bassey", "Hartigan", "Lozano",
];

// 4-3-3 starters, then three substitutes.
const SHAPE: [Position, number][] = [
  ["GK", 1], ["RB", 2], ["CB", 4], ["CB", 5], ["LB", 3], ["DM", 6], ["CM", 8], ["AM", 10], ["RW", 7], ["ST", 9], ["LW", 11],
  ["CM", 14], ["ST", 19], ["CB", 15],
];

function squad(clubId: string, seed: number): Player[] {
  const r = rng(seed);
  const used = new Set<string>();
  return SHAPE.map(([position, number]) => {
    let name = "";
    do name = `${r.pick(FIRST)} ${r.pick(LAST)}`;
    while (used.has(name));
    used.add(name);
    const attacker = ["ST", "LW", "RW", "AM"].includes(position);
    return {
      id: `${clubId}-${number}`,
      name,
      number,
      position,
      passing: round(r.range(0.62, 0.92) + (["CM", "DM", "AM"].includes(position) ? 0.04 : 0)),
      finishing: round(attacker ? r.range(0.55, 0.9) : r.range(0.2, 0.5)),
      pace: round(position === "GK" ? r.range(0.3, 0.5) : r.range(0.55, 0.95)),
    };
  });
}

const round = (n: number) => Math.round(Math.min(1, n) * 100) / 100;

function club(id: string, name: string, short: string, colors: [string, string], venue: string, seed: number): Club {
  return { id, name, short, colors, venue, players: squad(id, seed) };
}

export const CLUBS: Record<string, Club> = Object.fromEntries(
  [
    club("ngu", "Northgate United", "NGU", ["#F15326", "#FFFFFF"], "Northgate Park", 101),
    club("kes", "Kestrel Park", "KES", ["#00A6ED", "#3A0648"], "The Eyrie", 202),
    club("ash", "Ashbury Rovers", "ASH", ["#82BA03", "#FFFFFF"], "Ashbury Lane", 303),
    club("sal", "Saltmarsh Athletic", "SAL", ["#FEB703", "#3A0648"], "Harbour Road", 404),
    club("thc", "Thornfield City", "THC", ["#3A0648", "#FEB703"], "Thornfield Stadium", 505),
    club("wes", "Westvale Wanderers", "WES", ["#FFFFFF", "#00A6ED"], "Vale Ground", 606),
  ].map((c) => [c.id, c]),
);

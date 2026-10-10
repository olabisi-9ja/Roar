// Synthetic, football-realistic match data (hackathon rule: no real Premier League data).
// Pitch is 105 x 68 metres. Home attacks towards x = 105, away towards x = 0.

export type Side = "home" | "away";
export type Position = "GK" | "LB" | "CB" | "RB" | "DM" | "CM" | "AM" | "LW" | "RW" | "ST";

export type Player = {
  id: string;
  name: string;
  number: number;
  position: Position;
  /** 0..1 abilities that shape the generated events. */
  passing: number;
  finishing: number;
  pace: number;
};

export type Club = {
  id: string;
  name: string;
  short: string;
  colors: [string, string];
  venue: string;
  /** First 11 start in a 4-3-3; the rest are substitutes. */
  players: Player[];
};

/** The storyline a match is generated from. Written by hand or by the Match Writer agent. */
export type MatchScript = {
  id: string;
  seed: number;
  title: string;
  storyline: string;
  home: string;
  away: string;
  /** Share of control (0..1) for the home side across windows of the match. Gaps default to 0.5. */
  momentum: { from: number; to: number; home: number }[];
  goals: { minute: number; side: Side; scorer?: string; assist?: string; kind?: "open_play" | "penalty" | "header" }[];
  cards: { minute: number; side: Side; player?: string; color: "yellow" | "red" }[];
  subs: { minute: number; side: Side; off?: string; on?: string }[];
  /** Added time per half, in minutes. */
  addedTime?: [number, number];
};

export type EventType =
  | "kickoff"
  | "pass"
  | "carry"
  | "pressure"
  | "tackle"
  | "interception"
  | "shot"
  | "corner"
  | "foul"
  | "card"
  | "sub"
  | "possession_change"
  | "half_time"
  | "full_time"
  | "telemetry";

export type Outcome = "complete" | "incomplete" | "goal" | "saved" | "off_target" | "blocked" | "won" | "lost";

export type SynthEvent = {
  id: string;
  seq: number;
  /** Match clock in milliseconds since kick-off (continuous across both halves). */
  t: number;
  period: 1 | 2;
  minute: number;
  second: number;
  type: EventType;
  side?: Side;
  playerId?: string;
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  outcome?: Outcome;
  recipientId?: string;
  /** Metres. */
  distance?: number;
  /** Ball speed in km/h (passes and shots). */
  speedKmh?: number;
  /** 0..1, higher is harder (passes). */
  difficulty?: number;
  underPressure?: boolean;
  /** Expected goals (shots). */
  xg?: number;
  detail?: string;
  /** Per-player physical data, emitted once a minute on telemetry events. */
  players?: { playerId: string; distanceM: number; topSpeedKmh: number }[];
};

export type MatchDataset = {
  schema: "roar.synthetic-match/1";
  generator: string;
  script: MatchScript;
  home: Club;
  away: Club;
  events: SynthEvent[];
};

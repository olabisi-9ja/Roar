// Normalized AI result contract (TRD 5.4). Frontends and workers depend on this,
// not on any specific model's response shape.
export type EventType = "goal" | "celebration" | "player" | "crowd" | "foul" | "security" | "other";

export type Severity = "normal" | "medium" | "critical";

export interface AIResult {
  eventType: EventType;
  confidence: number;
  description: string;
  players: string[];
  severity: Severity;
  safetyRelevant: boolean;
  tags: string[];
}

// Live match data contract (Premier League). The API normalises the data provider into these shapes.
// All match data is synthetic and football-realistic (hackathon rule). See packages/matchdata.
export type StatsSource = "synthetic";
export type Team = { name: string; short: string; logo: string | null };
export type Fixture = {
  id: string;
  home: Team;
  away: Team;
  score: [number, number] | null;
  status: "LIVE" | "SCHEDULED" | "FINISHED" | "OFF";
  statusText: string;
  minute: number | null;
  kickoff: string;
  venue: string | null;
};
export type Stat = { label: string; home: number; away: number; unit?: string };
export type MatchEvent = {
  id: string;
  minute: number;
  extra: number | null;
  type: "Goal" | "Card" | "Sub" | "VAR";
  detail: string;
  team: "home" | "away";
  player: string | null;
  assist: string | null;
};
export type MatchDetail = { fixture: Fixture; stats: Stat[]; events: MatchEvent[]; source: StatsSource };
// Audience and curated moments (crowd, celebrations, atmosphere) published by editors or the AI curator.
export type MomentKind = "CROWD" | "CELEBRATION" | "GOAL" | "PLAYER" | "FOUL" | "SECURITY" | "OTHER";
export type CuratedMoment = {
  id: string;
  matchId: string;
  kind: MomentKind;
  title: string;
  description: string;
  minute: number | null;
  promoted: boolean;
  source: "editor" | "ai";
  status: "PROCESSING" | "PUBLISHED" | "REMOVED";
  media: { id: string; url: string; type: "PHOTO" | "VIDEO" } | null;
  createdAt: string;
};
export type AiStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED";
export type MediaItem = {
  id: string;
  matchId: string;
  type: "PHOTO" | "VIDEO";
  status: string;
  audience: string;
  section: string | null;
  url: string;
  uploadedAt: string;
  aiStatus?: AiStatus;
  aiError?: string | null;
  aiAttempts?: number;
};

export type MatchList = { live: Fixture[]; upcoming: Fixture[]; recent: Fixture[]; source: StatsSource; season?: number };

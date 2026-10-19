import type { IncidentStatus } from "@inside/database";

// Incident state machine. Staff can resolve quickly, but resolved and false-positive reports become
// read-only unless someone explicitly reopens them. The API owns the rules, not the dashboard buttons.
export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ["ACKNOWLEDGED", "ASSIGNED", "RESOLVED", "FALSE_POSITIVE"],
  ACKNOWLEDGED: ["ASSIGNED", "RESOLVED", "FALSE_POSITIVE", "OPEN"],
  ASSIGNED: ["RESOLVED", "FALSE_POSITIVE", "ACKNOWLEDGED", "OPEN"],
  RESOLVED: ["OPEN"],
  FALSE_POSITIVE: ["OPEN"],
};

export const INCIDENT_STATUSES = new Set<string>(Object.keys(INCIDENT_TRANSITIONS));

export const canTransitionIncident = (from: string, to: string): boolean =>
  INCIDENT_STATUSES.has(from) && (INCIDENT_TRANSITIONS[from as IncidentStatus] ?? []).includes(to as IncidentStatus);

/** Immediate rule-based severity, before the Safety Analyst agent has an opinion. */
export const severityForReport = (type: string): "CRITICAL" | "MEDIUM" => (type === "MEDICAL" || type === "FIRE" ? "CRITICAL" : "MEDIUM");

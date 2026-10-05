import { parseCampusTime } from "./campus-time";

export type FollowupHistoryEntry = { id: number; eventType: string; reason?: string; notes?: string; expectedBack?: string; createdAt: string; staffName: string };

export function historyDay(value: string): string {
  const date = parseCampusTime(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function groupFollowupHistory(entries: FollowupHistoryEntry[], month = "", day = "") {
  const groups = new Map<string, FollowupHistoryEntry[]>();
  const sorted = [...entries].sort((a, b) => (parseCampusTime(b.createdAt).getTime() || 0) - (parseCampusTime(a.createdAt).getTime() || 0) || b.id - a.id);
  for (const entry of sorted) {
    const key = historyDay(entry.createdAt);
    if ((month && !key.startsWith(month)) || (day && key !== day)) continue;
    groups.set(key, [...(groups.get(key) || []), entry]);
  }
  return Array.from(groups, ([date, items]) => ({ date, items }));
}

export function historyEventLabel(event: string) {
  return ({ CASE_CREATED: "Follow-up opened", ASSIGNED: "Teacher assigned", REASSIGNED: "Teacher reassigned", CONTACTED: "Family contacted", NO_ANSWER: "No answer", COULDNT_REACH: "Couldn’t reach family", RESOLVED: "Follow-up resolved", ESCALATED: "Sent to leadership" } as Record<string, string>)[event]
    || event.toLowerCase().replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
}

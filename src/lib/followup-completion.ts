type ContactEvent = { eventType: string; createdAt: string; staffName: string };
type FollowupState = {
  status: string;
  lastContactedAt?: string | null;
  children: { missedServiceDate?: string | null }[];
  history: ContactEvent[];
};

/** Completion belongs to this absence, not a contact from an earlier Sunday. */
export function followupCompletion(detail: FollowupState) {
  if (!["CONTACTED", "RESOLVED"].includes(detail.status)) return null;
  const event = [...detail.history].filter(item => ["CONTACTED", "RESOLVED"].includes(item.eventType))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const contactedAt = event?.createdAt || detail.lastContactedAt || null;
  const sunday = detail.children.map(child => child.missedServiceDate?.slice(0, 10)).filter((value): value is string => Boolean(value)).sort().at(-1);
  if (sunday && contactedAt && contactedAt.slice(0, 10) < sunday) return null;
  return { contactedAt, staffName: event?.staffName || null, sunday };
}

export function followupAssignee(ownerId?: number | string | null) {
  return ownerId && Number(ownerId) > 0 ? String(ownerId) : "";
}

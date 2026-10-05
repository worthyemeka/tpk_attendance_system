import type { ReactNode } from "react";
import "./record-badge.css";

export type BadgeTone = "orange" | "blue" | "green" | "purple" | "rose" | "amber" | "neutral";

// Colours are presentation only; database IDs continue to identify classes.
export function classBadgeTone(name?: string | null): BadgeTone {
  const label = (name || "").trim().toLowerCase();
  if (/\bteens?\b/.test(label)) return "purple";
  if (/\btribe\s+a\b/.test(label)) return "orange";
  if (/\btribe\s+b\b/.test(label)) return "blue";
  if (/\btribe\s+c\b/.test(label)) return "green";
  if (/\btribe\s+d\b/.test(label)) return "rose";
  return "neutral";
}

export function RecordBadge({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: BadgeTone; dot?: boolean }) {
  return <span className={`record-badge badge-${tone}`}>{dot && <i aria-hidden="true" />}{children}</span>;
}

export function ClassBadge({ name }: { name?: string | null }) {
  return <RecordBadge tone={classBadgeTone(name)} dot>{name || "Not assigned"}</RecordBadge>;
}

export function GenderBadge({ gender }: { gender?: string }) {
  const value = gender?.toUpperCase();
  return <RecordBadge tone={value === "FEMALE" ? "rose" : value === "MALE" ? "blue" : "neutral"}>{value === "FEMALE" ? "Female" : value === "MALE" ? "Male" : "Not recorded"}</RecordBadge>;
}

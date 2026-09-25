export type AccessLevel = "TPK_SUPER_ADMIN" | "TPK_FOLLOW_UP_ADMIN" | "TPK_ADMIN";
export type TeamStatus = "ACTIVE" | "PROBATION" | "INACTIVE";
export type TeacherSession = {
  staffUserId: number;
  name: string;
  firstName: string;
  lastName: string;
  title: "Auntie" | "Uncle";
  accessLevel: AccessLevel;
  teamStatus: TeamStatus;
  role: "TPK Teacher";
  profileImageUrl?: string | null;
  sessionToken: string;
};

// A production tunnel can be supplied when the PHP service lives outside
// Vercel. Local development intentionally falls back to Next's same-origin
// `/api` bridge, so no browser code needs a different endpoint locally.
export const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

export function readTeacherSession(): TeacherSession | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem("tpk-teacher") || "null");
    return saved?.sessionToken && saved?.staffUserId ? saved as TeacherSession : null;
  } catch { return null; }
}

export function saveTeacherSession(session: TeacherSession) { window.localStorage.setItem("tpk-teacher", JSON.stringify(session)); }
export function clearTeacherSession() { window.localStorage.removeItem("tpk-teacher"); }
export function authHeaders(session = readTeacherSession()): HeadersInit { return session ? { Authorization: `Bearer ${session.sessionToken}` } : {}; }
export function isSuperAdmin(session = readTeacherSession()) { return session?.accessLevel === "TPK_SUPER_ADMIN"; }
export function isFollowUpLead(session = readTeacherSession()) { return session?.accessLevel === "TPK_FOLLOW_UP_ADMIN"; }

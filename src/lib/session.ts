export type AccessLevel = "TPK_SUPER_ADMIN" | "TPK_FOLLOW_UP_ADMIN" | "TPK_ADMIN" | "EVENT_VOLUNTEER";
export type TeamStatus = "ACTIVE" | "PROBATION" | "INACTIVE";
export type TeacherSession = {
  staffUserId: number;
  name: string;
  firstName: string;
  lastName: string;
  title: "Auntie" | "Uncle" | "";
  accessLevel: AccessLevel;
  teamStatus: TeamStatus;
  role: "TPK Teacher" | "Event Volunteer";
  profileImageUrl?: string | null;
  sessionToken: string;
  /** Browser-clock deadline returned by the server, refreshed only by activity. */
  expiresAt?: number;
  lastActivityAt?: number;
};

// A production tunnel can be supplied when the PHP service lives outside
// Vercel. Local development intentionally falls back to Next's same-origin
// `/api` bridge, so no browser code needs a different endpoint locally.
// Production browser requests must stay same-origin so Vercel's /api proxy
// can forward them to the Oracle PHP backend. A localhost value is useful for
// local development only; in a deployed browser it points back at the phone
// or computer running the browser and makes the live app appear disconnected.
const configuredApiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
export const apiBase = process.env.NODE_ENV === "production" ? "" : configuredApiBase;

export function mediaUrl(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^(data:|blob:)/i.test(value)) return value;
  if (/^https?:\/\//i.test(value)) return value;
  const profileMatch = value.replace(/^\/+/, "").match(/(?:^|\/)uploads\/profiles\/([^/]+)$/i);
  if (profileMatch) {
    const filename = profileMatch[1];
    if (/^[A-Za-z0-9._-]+$/.test(filename)) {
      // Keep the browser URL on the normal uploads path. It is served as a
      // static file by Nginx/Apache in production and by the PHP router in
      // local development, so images work without an authenticated API call.
      return `${apiBase}/uploads/profiles/${encodeURIComponent(filename)}` || `/uploads/profiles/${encodeURIComponent(filename)}`;
    }
  }
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${apiBase}${path}` || path;
}

export function readTeacherSession(): TeacherSession | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = JSON.parse(window.localStorage.getItem("tpk-teacher") || "null");
    if (saved && ((typeof saved.expiresAt === "number" && saved.expiresAt <= Date.now()) ||
      (typeof saved.lastActivityAt === "number" && Date.now() - saved.lastActivityAt >= 48 * 60 * 60 * 1000))) {
      clearTeacherSession();
      return null;
    }
    return saved?.sessionToken && saved?.staffUserId ? saved as TeacherSession : null;
  } catch { return null; }
}

export const teacherSessionChangedEvent = "tpk-teacher-session-changed";
export function saveTeacherSession(session: TeacherSession) {
  window.localStorage.setItem("tpk-teacher", JSON.stringify(session));
  window.dispatchEvent(new Event(teacherSessionChangedEvent));
}
export function clearTeacherSession() {
  if (!window.localStorage.getItem("tpk-teacher")) return;
  window.localStorage.removeItem("tpk-teacher");
  window.dispatchEvent(new Event(teacherSessionChangedEvent));
}
export function authHeaders(session = readTeacherSession()): HeadersInit { return session ? { Authorization: `Bearer ${session.sessionToken}` } : {}; }
export function isSuperAdmin(session = readTeacherSession()) { return session?.accessLevel === "TPK_SUPER_ADMIN"; }
export function isFollowUpLead(session = readTeacherSession()) { return session?.accessLevel === "TPK_FOLLOW_UP_ADMIN"; }

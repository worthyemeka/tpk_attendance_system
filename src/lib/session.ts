export type AccessLevel = "TPK_SUPER_ADMIN" | "TPK_ADMIN";
export type TeamStatus = "ACTIVE" | "PROBATION" | "INACTIVE";
export type TeacherSession = {
  staffUserId: number;
  name: string;
  firstName: string;
  lastName: string;
  title: "Auntie" | "Uncle";
  accessLevel: AccessLevel;
  teamStatus: TeamStatus;
  role: "TPK Super Admin" | "TPK Admin";
  profileImageUrl?: string | null;
  sessionToken: string;
};

export const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

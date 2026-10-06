import { apiBase, authHeaders, clearTeacherSession, readTeacherSession, saveTeacherSession, teacherSessionChangedEvent, type TeacherSession } from "./session";

export const teacherIdleTimeoutMs = 48 * 60 * 60 * 1000;
const activityIntervalMs = 60_000;

type SessionResponse = { teacher: TeacherSession; expiresAtMs: number; serverTimeMs: number };

export function teacherSessionFromResponse(data: SessionResponse, token: string): TeacherSession & { expiresAt: number } {
  if (!data.teacher?.staffUserId || !Number.isFinite(data.expiresAtMs) || !Number.isFinite(data.serverTimeMs)) {
    throw new Error("The sign-in service returned an incomplete session.");
  }
  // Account for differences between the phone's clock and the server's clock.
  const remaining = Math.min(teacherIdleTimeoutMs, data.expiresAtMs - data.serverTimeMs);
  if (remaining <= 0) throw new Error("Your sign-in session has expired. Please sign in again.");
  return { ...data.teacher, sessionToken: token, expiresAt: Date.now() + remaining };
}

/** Validation never extends a session. Polling and background refreshes are not activity. */
export async function validateTeacherSession(activity = false): Promise<TeacherSession | null> {
  const session = readTeacherSession();
  if (!session) return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${apiBase}/api/teachers/session`, {
      method: activity ? "POST" : "GET", headers: authHeaders(session), cache: "no-store", signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      if (readTeacherSession()?.sessionToken === session.sessionToken) clearTeacherSession();
      return null;
    }
    if (!response.ok) throw new Error("The sign-in service is temporarily unavailable.");
    const payload = await response.json();
    const data = payload.data?.teacher ? payload.data : payload;
    // A logout, expiry or account switch while the request was in flight must not be undone.
    const current = readTeacherSession();
    if (!current || current.sessionToken !== session.sessionToken) return null;
    const refreshed = teacherSessionFromResponse(data, session.sessionToken);
    // A slower validation in another tab must not overwrite a newer heartbeat.
    if (current.expiresAt && current.expiresAt > refreshed.expiresAt) refreshed.expiresAt = current.expiresAt;
    refreshed.lastActivityAt = current.lastActivityAt;
    saveTeacherSession(refreshed);
    return refreshed;
  } finally { window.clearTimeout(timeout); }
}

/** Shared dashboard lifecycle: trusted user input renews; timers/focus only validate. */
export function monitorTeacherSession(onExpired: () => void): () => void {
  let stopped = false;
  let inFlight = false;
  let lastSent = 0;
  let expiryTimer: number | undefined;
  let activityTimer: number | undefined;
  let pendingActivity = false;
  const check = () => {
    window.clearTimeout(expiryTimer);
    const session = readTeacherSession();
    if (!session) { onExpired(); return; }
    const deadline = Math.min(session.expiresAt ?? Infinity, (session.lastActivityAt ?? Infinity) + teacherIdleTimeoutMs);
    if (Number.isFinite(deadline)) expiryTimer = window.setTimeout(check, Math.max(1, deadline - Date.now()));
  };
  const request = async (activity: boolean) => {
    if (stopped || inFlight) return;
    if (!readTeacherSession()) { check(); return; }
    inFlight = true;
    if (activity) { pendingActivity = false; lastSent = Date.now(); }
    try { await validateTeacherSession(activity); }
    catch { /* A temporary outage must not invent a longer session or force a fresh login. */ }
    finally {
      inFlight = false;
      if (!stopped) {
        check();
        if (pendingActivity) {
          window.clearTimeout(activityTimer);
          activityTimer = window.setTimeout(() => { void request(true); }, Math.max(0, activityIntervalMs - (Date.now() - lastSent)));
        }
      }
    }
  };
  const activity = (event: Event) => {
    if (!event.isTrusted || document.visibilityState !== "visible") return;
    const session = readTeacherSession();
    if (!session) { check(); return; }
    // Do not emit a full session-change event on every keystroke.
    window.localStorage.setItem("tpk-teacher", JSON.stringify({ ...session, lastActivityAt: Date.now() }));
    pendingActivity = true;
    window.clearTimeout(activityTimer);
    const delay = Math.max(0, activityIntervalMs - (Date.now() - lastSent));
    activityTimer = window.setTimeout(() => { void request(true); }, delay);
  };
  const wake = () => { if (document.visibilityState === "visible") { check(); void request(false); } };
  const storage = (event: StorageEvent) => { if (event.key === "tpk-teacher" || event.key === null) check(); };
  const events = ["pointerdown", "keydown", "touchstart", "scroll"];
  events.forEach(name => window.addEventListener(name, activity, { passive: true, capture: true }));
  window.addEventListener(teacherSessionChangedEvent, check);
  window.addEventListener("storage", storage);
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", wake);
  const validationTimer = window.setInterval(() => { check(); if (document.visibilityState === "visible") void request(false); }, 5 * 60_000);
  check();
  void request(false);
  return () => {
    stopped = true;
    window.clearTimeout(expiryTimer); window.clearTimeout(activityTimer); window.clearInterval(validationTimer);
    events.forEach(name => window.removeEventListener(name, activity, true));
    window.removeEventListener(teacherSessionChangedEvent, check); window.removeEventListener("storage", storage);
    window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake);
  };
}

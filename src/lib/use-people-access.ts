"use client";
import { useEffect, useState } from "react";
import { apiBase, authHeaders, readTeacherSession, teacherSessionChangedEvent } from "./session";

export type PeopleAccess = "checking" | "allowed" | "denied" | "unavailable";
export function usePeopleAccess(active = true): PeopleAccess {
  const [access, setAccess] = useState<PeopleAccess>("checking");
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let sequence = 0;
    let checkedToken: string | undefined;
    const check = async (reset = false) => {
      const request = ++sequence;
      const session = readTeacherSession();
      if (reset && session?.sessionToken !== checkedToken) setAccess("checking");
      checkedToken = session?.sessionToken;
      if (!session) { setAccess("denied"); return; }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`${apiBase}/api/v1/me/people-access`, { headers: authHeaders(session), cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!cancelled && request === sequence && readTeacherSession()?.sessionToken === session.sessionToken) {
          setAccess(response.ok && payload.success ? (payload.data?.canViewPeople === true ? "allowed" : "denied") : response.status === 401 || response.status === 403 ? "denied" : "unavailable");
        }
      } catch { if (!cancelled && request === sequence) setAccess("unavailable"); }
      finally { window.clearTimeout(timeout); }
    };
    const changed = () => { void check(true); };
    const wake = () => { if (document.visibilityState === "visible") void check(); };
    void check(true);
    const timer = window.setInterval(wake, 60_000);
    window.addEventListener(teacherSessionChangedEvent, changed);
    window.addEventListener("storage", changed);
    document.addEventListener("visibilitychange", wake);
    return () => { cancelled = true; ++sequence; window.clearInterval(timer); window.removeEventListener(teacherSessionChangedEvent, changed); window.removeEventListener("storage", changed); document.removeEventListener("visibilitychange", wake); };
  }, [active]);
  return access;
}

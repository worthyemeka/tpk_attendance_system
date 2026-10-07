"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readTeacherSession } from "@/lib/session";
import { monitorTeacherSession } from "@/lib/teacher-session-lifecycle";
import { usePeopleAccess } from "@/lib/use-people-access";

export function PeopleRecordsGuard({ children }: { children: React.ReactNode }) {
  const access = usePeopleAccess();
  if (access === "checking") return <section role="status"><p>Checking record access…</p></section>;
  if (access !== "allowed") return <section className="people-access-notice" role="status"><h1>{access === "unavailable" ? "Record access could not be checked" : "People records are restricted"}</h1><p>{access === "unavailable" ? "Please try again shortly. No private records have been loaded." : "Only this week’s Heads of Service and assistants, Follow-Up Leads and Super Admins can view children, guardian and family records."}</p><a href="/account/overview">Back to dashboard</a></section>;
  return <>{children}</>;
}

export function AccountGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const expired = () => { setReady(false); router.replace(`/teacher/login?next=${encodeURIComponent(pathname + window.location.search)}`); };
    const session = readTeacherSession();
    if (!session) { expired(); return; }
    if(session.accessLevel==="EVENT_VOLUNTEER"&&pathname!=="/account/event-volunteer") { setReady(false);router.replace("/account/event-volunteer");return; }
    setReady(true);
    return monitorTeacherSession(expired);
  }, [pathname, router]);
  if (!ready) return <main className="route-loading"><span /><span /><span /></main>;
  return <>{children}</>;
}

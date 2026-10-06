"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readTeacherSession } from "@/lib/session";
import { monitorTeacherSession } from "@/lib/teacher-session-lifecycle";

export function AccountGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const expired = () => { setReady(false); router.replace(`/teacher/login?next=${encodeURIComponent(pathname + window.location.search)}`); };
    const session = readTeacherSession();
    if (!session) { expired(); return; }
    setReady(true);
    return monitorTeacherSession(expired);
  }, [pathname, router]);
  if (!ready) return <main className="route-loading"><span /><span /><span /></main>;
  return <>{children}</>;
}

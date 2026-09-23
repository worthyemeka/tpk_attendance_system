"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { readTeacherSession } from "@/lib/session";

export function AccountGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const session = readTeacherSession();
    if (!session) { router.replace(`/teacher/login?next=${encodeURIComponent(pathname)}`); return; }
    setReady(true);
  }, [pathname, router]);
  if (!ready) return <main className="route-loading"><span /><span /><span /></main>;
  return <>{children}</>;
}

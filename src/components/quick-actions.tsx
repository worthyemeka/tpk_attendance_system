"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowUpRight, FiChevronRight, FiClock, FiSearch, FiUserPlus } from "react-icons/fi";
import type { IconType } from "react-icons";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { readActiveService } from "@/lib/active-service";

export function QuickActions() {
  const session = readTeacherSession();
  const superAdmin = session?.accessLevel === "TPK_SUPER_ADMIN";
  const [canAssistedCheckIn, setCanAssistedCheckIn] = useState(false);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const check = async () => {
      try {
        const active = readActiveService();
        const current = active?.id
          ? { id: active.id }
          : await fetch(`${apiBase}/api/v1/service-sessions/current`, { headers: authHeaders(session) }).then((response) => response.json()).then((body) => body.success ? body.data : null);
        if (!current?.id) return;
        const response = await fetch(`${apiBase}/api/v1/check-ins?serviceSessionId=${current.id}`, { headers: authHeaders(session) });
        const body = await response.json();
        if (!cancelled) setCanAssistedCheckIn(Boolean(body.success && body.data?.canAssistedCheckin));
      } catch { if (!cancelled) setCanAssistedCheckIn(false); }
    };
    void check();
    return () => { cancelled = true; };
  }, [session?.staffUserId, session?.sessionToken]);
  const actions: Array<[string, string, string, IconType]> = [
    ...(canAssistedCheckIn ? [["Assist a Check-In", "Open the desk check-in form", "/account/check-in/assisted", FiUserPlus] as [string, string, string, IconType]] : []),
    ["Find a Child", "Search live child records", "/account/children", FiSearch],
    ["Start a Pick-Up", "Verify a child’s collector", "/account/pick-up", FiArrowUpRight],
    [superAdmin ? "View Follow-Ups" : "My Follow-Ups", "Review children needing care", "/account/relations", FiClock],
    ...(superAdmin ? [["Manage Roster", "Plan upcoming team duties", "/account/roster", FiClock] as [string, string, string, IconType]] : []),
  ];
  return <section className="panel actions-panel"><div className="panel-heading"><div><h2>Quick Actions</h2><p>Common tasks</p></div></div><div className="action-list">{actions.map(([title, subtitle, href, Icon]) => <Link href={href} key={title}><Icon /><span><b>{title}</b><small>{subtitle}</small></span><FiChevronRight /></Link>)}</div></section>;
}

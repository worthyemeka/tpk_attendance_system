"use client";

import Link from "next/link";
import { FiArrowUpRight, FiChevronRight, FiClock, FiSearch, FiUserPlus } from "react-icons/fi";
import type { IconType } from "react-icons";
import { readTeacherSession } from "@/lib/session";

export function QuickActions() {
  const superAdmin = readTeacherSession()?.accessLevel === "TPK_SUPER_ADMIN";
  const actions: Array<[string, string, string, IconType]> = [
    ["Assist a Check-In", "Help a parent complete check-in", "/check-in/parent?assisted=1", FiUserPlus],
    ["Find a Child", "Search live child records", "/account/children", FiSearch],
    ["Start a Pick-Up", "Verify a child’s collector", "/account/pick-up", FiArrowUpRight],
    [superAdmin ? "View Follow-Ups" : "My Follow-Ups", "Review children needing care", "/account/relations", FiClock],
    ...(superAdmin ? [["Manage Roster", "Plan upcoming team duties", "/account/roster", FiClock] as [string, string, string, IconType]] : []),
  ];
  return <section className="panel actions-panel"><div className="panel-heading"><div><h2>Quick Actions</h2><p>Common tasks</p></div></div><div className="action-list">{actions.map(([title, subtitle, href, Icon]) => <Link href={href} key={title}><Icon /><span><b>{title}</b><small>{subtitle}</small></span><FiChevronRight /></Link>)}</div></section>;
}

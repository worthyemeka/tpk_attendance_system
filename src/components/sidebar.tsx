"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiBarChart2, FiBookOpen, FiCheckSquare, FiChevronRight, FiClock, FiHome, FiLogOut, FiSettings, FiUser, FiUserCheck, FiUsers } from "react-icons/fi";
import { apiBase, authHeaders, clearTeacherSession, readTeacherSession, type TeacherSession } from "@/lib/session";

type Item = readonly [string, string, typeof FiHome];
const superSunday: readonly Item[] = [["Overview", "/account/overview", FiHome], ["Check-In", "/account/check-in", FiCheckSquare], ["Pick-Up", "/account/pick-up", FiLogOut], ["Classrooms", "/account/classrooms", FiUsers]];
const superPeople: readonly Item[] = [["Children", "/account/children", FiUser], ["Guardians", "/account/guardians", FiUserCheck], ["Families", "/account/families", FiUsers], ["Team", "/account/team", FiUsers]];
const superMinistry: readonly Item[] = [["Team & Roster", "/account/roster", FiClock], ["Relations & Follow-Up", "/account/relations", FiUserCheck], ["Classes & Curriculum", "/account/classes", FiBookOpen], ["Reports", "/account/reports", FiBarChart2]];
const adminSunday: readonly Item[] = [["Overview", "/account/overview", FiHome], ["Check-In", "/account/check-in", FiCheckSquare], ["My Classrooms", "/account/classrooms", FiUsers]];
function initials(session: TeacherSession) { return `${session.firstName?.[0] || ""}${session.lastName?.[0] || ""}`.toUpperCase() || "TP"; }
function Group({ title, items }: { title: string; items: readonly Item[] }) { const pathname = usePathname(); return <section className="side-group"><p className="side-label">{title}</p>{items.map(([label, href, Icon]) => <Link key={label} href={href} className={pathname === href ? "active" : ""}><Icon /><span>{label}</span></Link>)}</section>; }

export function Sidebar() {
  const router = useRouter(); const [session, setSession] = useState<TeacherSession | null>(null); const [open, setOpen] = useState(false);
  useEffect(() => setSession(readTeacherSession()), []);
  if (!session) return null;
  const superAdmin = session.accessLevel === "TPK_SUPER_ADMIN";
  async function signOut() { try { await fetch(`${apiBase}/api/teachers/logout`, { method: "POST", headers: authHeaders(session) }); } finally { clearTeacherSession(); router.replace("/teacher/login"); } }
  return <aside className="sidebar"><Link className="brand" href="/account/overview"><Image src="/brand/petra-logo.jpg" alt="Petra Church" width={54} height={54} className="petra-logo" priority /><span className="brand-copy"><Image src="/brand/tpk-logo.png" alt="TribePetra Kids" width={118} height={27} className="tpk-logo" priority /><small>Wuse Campus</small></span></Link>
    <Group title="Sunday" items={superAdmin ? superSunday : adminSunday} />
    {superAdmin && <><Group title="People" items={superPeople} /><Group title="Ministry" items={superMinistry} /></>}
    {!superAdmin && <Group title="My Ministry" items={[["My Roster", "/account/roster", FiClock], ["My Follow-Ups", "/account/relations", FiUserCheck]]} />}
    <section className="side-group settings-link"><Link href="/account/settings"><FiSettings /><span>Settings</span></Link></section>
    <div className="sidebar-footer-wrap"><button className="sidebar-footer" onClick={() => setOpen((value) => !value)} aria-expanded={open}>{session.profileImageUrl ? <img className="avatar avatar-image" src={`${apiBase}${session.profileImageUrl}`} alt="" /> : <div className="avatar">{initials(session)}<i /></div>}<div><b>{session.title} {session.firstName}</b><small>{session.role}</small><em><i />{session.teamStatus === "PROBATION" ? "Probation" : "Online"}</em></div><FiChevronRight /></button>{open && <div className="profile-menu"><Link href="/account/profile" onClick={() => setOpen(false)}>My Profile</Link><Link href="/account/settings" onClick={() => setOpen(false)}>Account Settings</Link><button onClick={signOut}>Sign Out</button></div>}</div>
    <p className="sidebar-tagline">CHECK IN <b>•</b> BELONG <b>•</b> GROW</p><style jsx>{`.sidebar-footer-wrap{position:relative;margin-top:auto}.sidebar-footer{width:100%;border:0;background:transparent;color:inherit;text-align:left;cursor:pointer}.profile-menu{position:absolute;z-index:9;bottom:77px;left:0;right:0;padding:6px;background:#292a29;border:1px solid #464746;border-radius:9px;box-shadow:0 12px 24px #0005}.profile-menu a,.profile-menu button{display:block;width:100%;padding:9px;border:0;background:transparent;color:#fff;text-align:left;text-decoration:none;border-radius:6px;font:700 11px var(--font-body)}.profile-menu a:hover,.profile-menu button:hover{background:#3b3c3b}.avatar-image{object-fit:cover}`}</style></aside>;
}

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBarChart2, FiBox, FiCheckSquare, FiChevronRight, FiHome, FiLogOut, FiSettings, FiUser, FiUserCheck, FiUsers } from "react-icons/fi";

const sunday = [["Overview", "/account/overview", FiHome], ["Check-In", "/account/check-in", FiCheckSquare], ["Pick-Up", "/account/pick-up", FiLogOut], ["Classrooms", "/account/classrooms", FiUsers]] as const;
const people = [["Families", "/account/families", FiUsers], ["Children", "/account/children", FiUser], ["Guardians", "/account/guardians", FiUserCheck]] as const;
const manage = [["Classes", "/account/classes", FiBox], ["Sunday Team", "/account/volunteers", FiUsers], ["Reports", "/account/reports", FiBarChart2]] as const;
function Group({ title, items }: { title?: string; items: readonly (readonly [string, string, typeof FiHome])[] }) { const pathname = usePathname(); return <section className="side-group">{title && <p className="side-label">{title}</p>}{items.map(([label, href, Icon]) => <Link key={label} href={href} className={pathname === href ? "active" : ""}><Icon /><span>{label}</span></Link>)}</section>; }
export function Sidebar() { return <aside className="sidebar"><Link className="brand" href="/account/overview"><Image src="/brand/petra-logo.jpg" alt="Petra Church" width={54} height={54} className="petra-logo" priority /><span className="brand-copy"><Image src="/brand/tpk-logo.png" alt="TribePetra Kids" width={118} height={27} className="tpk-logo" priority style={{ filter: "none" }} /><small>Wuse Campus</small></span></Link><Group title="Sunday" items={sunday} /><Group title="People" items={people} /><Group title="Manage" items={manage} /><section className="side-group settings-link"><Link href="/account/settings"><FiSettings /><span>Settings</span></Link></section><div className="sidebar-footer"><div className="avatar">KA<i /></div><div><b>Kemi Adeyemi</b><small>TPK Admin</small><em><i />Online</em></div><FiChevronRight /></div><p className="sidebar-tagline">CHECK IN <b>•</b> BELONG <b>•</b> GROW</p></aside>; }

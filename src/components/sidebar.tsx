"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiBarChart2, FiBox, FiCheckSquare, FiChevronRight, FiHome, FiLogOut, FiSettings, FiUser, FiUserCheck, FiUsers } from "react-icons/fi";
const sunday=[["Overview","/",FiHome],["Check-In","/check-in",FiCheckSquare],["Pick-Up","/pick-up",FiLogOut],["Classrooms","/classes",FiUsers]] as const;
const people=[["Families","/families",FiUsers],["Children","/children",FiUser],["Guardians","/families",FiUserCheck]] as const;
const manage=[["Classes","/classes",FiBox],["Sunday Team","/volunteers",FiUsers],["Reports","/reports",FiBarChart2]] as const;
function Group({title,items}:{title?:string;items:readonly(readonly[string,string,typeof FiHome])[]}){const path=usePathname();return <section className="side-group">{title&&<p className="side-label">{title}</p>}{items.map(([label,href,Icon])=><Link key={label} href={href} className={path===href?"active":""}><Icon/><span>{label}</span></Link>)}</section>}
export function Sidebar(){return <aside className="sidebar"><Link className="brand" href="/"><Image src="/brand/petra-logo.jpg" alt="Petra Church" width={54} height={54} className="petra-logo" priority/><span className="brand-copy"><Image src="/brand/tpk-logo.jpg" alt="TribePetra Kids" width={118} height={27} className="tpk-logo" priority/><small>Wuse Campus</small></span></Link><Group title="Sunday" items={sunday}/><Group title="People" items={people}/><Group title="Manage" items={manage}/><section className="side-group settings-link"><Link href="/settings"><FiSettings/><span>Settings</span></Link></section><div className="sidebar-footer"><div className="avatar">KA<i/></div><div><b>Kemi Adeyemi</b><small>TPK Admin</small><em><i/>Online</em></div><FiChevronRight/></div><p className="sidebar-tagline">CHECK IN <b>•</b> BELONG <b>•</b> GROW</p></aside>}

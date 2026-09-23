"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCheckCircle, FiChevronRight, FiLogOut, FiSettings, FiShield, FiUsers } from "react-icons/fi";
import { apiBase, authHeaders, clearTeacherSession, readTeacherSession, type TeacherSession } from "@/lib/session";

type SystemStatus = { connected: boolean; checkedAt: string; campus?: { name?: string }; serviceSession?: { id: number; name: string; serviceDate: string } | null; accessLevel: string; teamStatus: string };

export default function SettingsPage() {
  const router = useRouter();
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const current = readTeacherSession();
    if (!current) { router.replace("/teacher/login"); return; }
    setSession(current);
    fetch(`${apiBase}/api/v1/system/status`, { headers: authHeaders(current) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || "The live data connection is unavailable.");
        setStatus(result.data);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "The live data connection is unavailable."));
  }, [router]);

  const signOut = async () => { if (session) await fetch(`${apiBase}/api/teachers/logout`, { method: "POST", headers: authHeaders(session) }).catch(() => undefined); clearTeacherSession(); router.replace("/teacher/login"); };
  const superAdmin = session?.accessLevel === "TPK_SUPER_ADMIN";

  return <section className="settings-page"><header><p className="eyebrow">Petra Wuse</p><h1>Settings</h1><p className="intro">Your account, ministry access and live connection.</p></header><section className="settings-grid"><article className="panel connection"><div className="setting-icon"><FiCheckCircle /></div><div><h2>{status?.connected ? "Live data connected" : "Checking live data…"}</h2><p>{status?.connected ? `Connected to ${status.campus?.name || "Petra Wuse"}. All views update from the same current records.` : error || "Checking your data connection."}</p>{status?.serviceSession && <small>Open service: {status.serviceSession.name} · {status.serviceSession.serviceDate}</small>}</div></article><article className="panel"><div className="setting-icon"><FiShield /></div><div><h2>Account access</h2><p>{session?.role || "TPK team"} · {session?.teamStatus === "PROBATION" ? "Probation" : session?.teamStatus === "INACTIVE" ? "Inactive" : "Active"}</p><Link href="/account/profile">View and update my profile <FiChevronRight /></Link></div></article>{superAdmin && <article className="panel"><div className="setting-icon"><FiUsers /></div><div><h2>Ministry administration</h2><p>Manage team access and status from one live ministry record.</p><Link href="/account/team">Manage the team <FiChevronRight /></Link></div></article>}<article className="panel"><div className="setting-icon"><FiSettings /></div><div><h2>Service operations</h2><p>Check-in, pickup, classrooms and reports all use the same campus data.</p><Link href="/account/overview">Open overview <FiChevronRight /></Link></div></article><article className="panel signout"><div className="setting-icon"><FiLogOut /></div><div><h2>Sign out</h2><p>End this team session on this device.</p><button onClick={signOut}>Sign out <FiChevronRight /></button></div></article></section><style jsx>{`.settings-page h1,.settings-page h2{font-family:Georgia,serif}.settings-page header{margin-bottom:23px}.settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;max-width:980px}.settings-grid .panel{min-height:145px;display:flex;gap:16px;padding:21px}.setting-icon{flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:10px;background:#fff0e9;color:var(--orange);font-size:22px}.connection .setting-icon{background:#e7f7ee;color:#087757}.settings-grid h2{margin:0;font-size:22px}.settings-grid p{margin:7px 0 10px;color:var(--muted);font-size:13px;line-height:1.45}.settings-grid a,.settings-grid button{display:inline-flex;align-items:center;gap:5px;border:0;padding:0;background:none;color:var(--orange);font:800 12px var(--font-body);text-decoration:none;cursor:pointer}.settings-grid small{display:block;color:#087757;font-size:11px;font-weight:800}.signout .setting-icon{background:#fff0ef;color:#c8452c}.signout button{color:#c8452c}@media(max-width:720px){.settings-grid{grid-template-columns:1fr}}`}</style></section>;
}

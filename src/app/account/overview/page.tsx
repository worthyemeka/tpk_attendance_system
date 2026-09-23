"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiCheckCircle, FiChevronRight, FiClock, FiUsers } from "react-icons/fi";
import { QuickActions } from "@/components/quick-actions";
import { UserGreeting } from "@/components/user-greeting";

type DashboardClass = { id: number; name: string; ageLabel: string; checkedIn: number; total: number };
type DashboardData = { metrics: { checkedIn: number; pickedUp: number; stillPresent: number; activeClasses: number }; classes: DashboardClass[] };
const fallback: DashboardData = { metrics: { checkedIn: 0, pickedUp: 0, stillPresent: 0, activeClasses: 0 }, classes: [] };
const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function AccountOverview() {
  const [dashboard, setDashboard] = useState<DashboardData>(fallback);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const stored = localStorage.getItem("tpk-teacher");
    const teacher = stored ? JSON.parse(stored) as { staffUserId?: number } : null;
    if (!teacher?.staffUserId) return;
    fetch(`${apiBase}/api/v1/dashboard/overview`, { headers: { "X-TPK-User-Id": String(teacher.staffUserId) } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((response: { success: boolean; data: DashboardData }) => { if (response.success) { setDashboard(response.data); setLive(true); } })
      .catch(() => setLive(false));
  }, []);
  const { metrics, classes } = dashboard;
  return <div className="overview"><header className="overview-header"><div><p className="eyebrow">Petra Wuse {live && <span className="live-status">Live</span>}</p><UserGreeting /><p className="intro">Here’s what’s happening at TribePetra Kids today.</p></div></header><section className="metrics"><Metric icon={<FiUsers />} value={String(metrics.checkedIn)} title="Checked In" sub="Children checked in this service" tone="orange" /><Metric icon={<FiCheckCircle />} value={String(metrics.pickedUp)} title="Picked Up" sub="Children safely collected" tone="green" /><Metric icon={<FiClock />} value={String(metrics.stillPresent)} title="Still Present" sub="Children currently in class" tone="yellow" /><Metric icon={<FiUsers />} value={String(metrics.activeClasses)} title="Active Classes" sub="Classes receiving children today" tone="dark" /></section><section className="dashboard-grid"><div className="left-column"><section className="panel attendance-panel"><div className="panel-heading"><div><h2>Attendance by Class</h2><p>Children currently checked in by class</p></div><Link href="/account/classrooms" className="outline-button">View classrooms <FiChevronRight /></Link></div><div className="attendance-list">{classes.length ? classes.map((item) => <div className="attendance-row" key={item.id}><div><b>{item.name}</b><span>{item.ageLabel}</span></div><div className="progress"><i style={{ width: `${item.total ? item.checkedIn / item.total * 100 : 0}%` }} /></div><strong>{item.checkedIn}</strong></div>) : <p className="account-empty">No live child records are available yet. Import the approved response export to populate this dashboard.</p>}</div></section><section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent Check-Ins</h2><p>The latest children to arrive</p></div><Link href="/account/check-in" className="outline-button">View all check-ins <FiChevronRight /></Link></div><p className="account-empty">Live parent check-ins will appear here.</p></section></div><aside className="right-column"><QuickActions /><section className="panel attention-panel"><div className="panel-heading"><div><h2>Needs Attention</h2><p>Items that need your attention</p></div></div><div className="attention-list"><div className="attention-item"><i className="amber"><FiClock /></i><span>Follow-ups and class-assignment reviews will appear here.</span><FiChevronRight /></div></div></section></aside></section><style jsx global>{`.account-empty{padding:24px 0 8px;color:#687184;font-size:12px}.overview-header{padding-top:0}.live-status{display:inline-block;margin-left:8px;border-radius:999px;padding:3px 7px;background:#e4f7ed;color:#08734e;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}`}</style></div>;
}
function Metric({ icon, value, title, sub, tone }: { icon: React.ReactNode; value: string; title: string; sub: string; tone: "orange" | "green" | "yellow" | "dark" }) { return <article className={`metric-card ${tone}`}><span className="metric-icon">{icon}</span><div><strong>{value}</strong><h3>{title}</h3><p>{sub}</p></div></article>; }

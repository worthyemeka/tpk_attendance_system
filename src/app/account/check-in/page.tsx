"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FiCheck, FiClock, FiExternalLink, FiSearch } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { subscribeToActiveService } from "@/lib/active-service";

type CheckInRow = { id: number; firstName: string; lastName: string; className?: string; status: string; checkedInAt: string; firstVisit: boolean; guardianFirstName?: string; guardianLastName?: string; checkInFormUrl?: string | null };
type RequestChild = { id: number; firstName: string; lastName?: string };
type CheckInRequest = { id: number; status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED"; requestedAt: string; guardianFirstName?: string; guardianLastName?: string; guardianPhone?: string; children: RequestChild[] };

export default function AccountCheckInPage() {
  const session = readTeacherSession();
  const [items, setItems] = useState<CheckInRow[]>([]);
  const [requests, setRequests] = useState<CheckInRequest[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [canOperate, setCanOperate] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [serviceSessionId, setServiceSessionId] = useState<number | undefined>();

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError("");
    try {
      if (!serviceSessionId) { setItems([]); setCanOperate(false); return; }
      const response = await fetch(`${apiBase}/api/v1/check-ins?serviceSessionId=${serviceSessionId}&search=${encodeURIComponent(query)}`, { headers: authHeaders(session) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "We could not load check-ins.");
      setItems(result.data.items || []);
      setCanOperate(Boolean(result.data.canOperate));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not load check-ins."); }
    finally { setLoading(false); }
  }, [query, serviceSessionId, session]);

  const loadRequests = useCallback(async () => {
    if (!session) return;
    try {
      if (!serviceSessionId) { setCanApprove(false); setRequests([]); return; }
      const response = await fetch(`${apiBase}/api/v1/check-in-requests?serviceSessionId=${serviceSessionId}`, { headers: authHeaders(session) });
      const result = await response.json();
      if (response.status === 403) { setCanApprove(false); setRequests([]); return; }
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load check-in requests.");
      setCanApprove(Boolean(result.data.canApprove)); setRequests(result.data.items || []); setRequestError("");
    } catch (reason) { setRequestError(reason instanceof Error ? reason.message : "We could not load check-in requests."); }
  }, [serviceSessionId, session]);

  useEffect(() => subscribeToActiveService(service => setServiceSessionId(service?.id)), []);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 180); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => { void loadRequests(); const timer = window.setInterval(() => { void loadRequests(); }, 7_500); return () => window.clearInterval(timer); }, [loadRequests]);

  const approve = async (requestId: number) => {
    if (!session) return;
    setApprovingId(requestId); setRequestError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/check-in-requests/${requestId}/approve`, { method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: "{}" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not approve this check-in request.");
      await Promise.all([load(), loadRequests()]);
    } catch (reason) { setRequestError(reason instanceof Error ? reason.message : "We could not approve this check-in request."); }
    finally { setApprovingId(null); }
  };

  const pending = requests.filter((request) => request.status === "PENDING");
  return <section className="staff-checkin">
    <header><div><p className="eyebrow">Petra Wuse</p><h1>Check-In</h1><p className="intro">Monitor live arrivals and confirm the parent requests assigned to you.</p></div></header>
    {!canOperate && serviceSessionId && <p className="readonly-notice">Read-only today — desk check-in is available only to the teacher assigned to Assembly. You can still monitor the live arrivals below.</p>}
    {canApprove && <section className="approval-panel"><div className="approval-heading"><span><FiClock /></span><div><h2>Parent check-in requests</h2><p>As today’s Head of Service, you approve each request before attendance and a pickup code are created.</p></div><b>{pending.length} waiting</b></div>{requestError && <p className="error">{requestError}</p>}<div className="request-grid">{pending.map((request) => <article className="request-card" key={request.id}><div><b>{[request.guardianFirstName, request.guardianLastName].filter(Boolean).join(" ") || "Parent / Guardian"}</b><small>{request.guardianPhone || "Phone unavailable"} · {new Intl.DateTimeFormat("en-NG", { timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(request.requestedAt))}</small></div><p>{request.children.map((child) => `${child.firstName}${child.lastName ? ` ${child.lastName}` : ""}`).join(" · ")}</p><button className="approve-button" disabled={approvingId === request.id} onClick={() => approve(request.id)}>{approvingId === request.id ? "Approving…" : <><FiCheck />Approve check-in</>}</button></article>)}{!pending.length && <p className="request-empty">No parent check-in requests are waiting right now.</p>}</div></section>}
    <section className="panel"><div className="checkin-toolbar"><label><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search child or guardian" /></label><span>{loading ? "Loading…" : `${items.length} live check-ins`}</span></div>{error ? <p className="error">{error}</p> : <div className="table-wrap"><table><thead><tr><th>Child</th><th>Class</th><th>Guardian</th><th>Visit</th><th>Check-In</th><th>Status</th><th>Form</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.firstName} {item.lastName}</b></td><td>{item.className || "Class assignment required"}</td><td>{[item.guardianFirstName, item.guardianLastName].filter(Boolean).join(" ") || "—"}</td><td>{item.firstVisit ? "First Visit" : "Returning"}</td><td>{new Intl.DateTimeFormat("en-NG", { timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(item.checkedInAt))}</td><td>{item.status.replaceAll("_", " ")}</td><td>{item.checkInFormUrl ? <a className="form-link" href={item.checkInFormUrl} rel="noreferrer" target="_blank">View check-in form <FiExternalLink /></a> : "—"}</td></tr>)}{!items.length && !loading && <tr><td colSpan={7} className="empty">No children have checked in for the current service.</td></tr>}</tbody></table></div>}</section>
    <style jsx>{`
      .staff-checkin header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}.staff-checkin h1,.staff-checkin h2{font-family:var(--font-display),Georgia,serif}.readonly-notice{margin:-7px 0 18px;padding:11px 13px;border:1px solid #f0dfb6;border-radius:10px;background:#fff9e9;color:#896515;font-size:12px;line-height:1.45}.approval-panel{margin-bottom:22px;border:1px solid #f1d2c2;border-radius:14px;padding:20px;background:#fffaf5}.approval-heading{display:flex;align-items:flex-start;gap:12px}.approval-heading>span{display:grid;place-items:center;width:39px;height:39px;border-radius:50%;background:#fff0e8;color:#f54e2c}.approval-heading h2{margin:0;font-size:24px}.approval-heading p{margin:4px 0 0;max-width:650px;color:var(--muted);font-size:13px}.approval-heading>b{margin-left:auto;border-radius:99px;padding:7px 10px;background:#fff0e8;color:#d84223;font-size:12px}.request-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px;margin-top:16px}.request-card{border:1px solid var(--line);border-radius:11px;padding:15px;background:#fff}.request-card b,.request-card small{display:block}.request-card small{margin-top:4px;color:var(--muted);font-size:11px}.request-card p{min-height:36px;margin:13px 0;color:#314969;font-size:13px}.approve-button{width:100%;height:40px;display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:8px;background:#ff4b28;color:#fff;font:800 13px var(--font-body);cursor:pointer}.approve-button:disabled{opacity:.6;cursor:wait}.request-empty{margin:0;color:var(--muted);font-size:13px}.checkin-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}.checkin-toolbar label{height:42px;min-width:min(440px,70%);display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid var(--line);border-radius:8px}.checkin-toolbar input{width:100%;border:0;background:transparent;outline:0;font:13px var(--font-body)}.checkin-toolbar span{font-size:11px;color:var(--muted)}.error{color:#c8452c}.form-link{display:inline-flex;align-items:center;gap:5px;color:#e6492c;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}@media(max-width:590px){.staff-checkin header{display:grid;gap:13px}.checkin-toolbar{display:grid}.checkin-toolbar label{min-width:0;width:100%}.approval-heading>b{display:none}.approval-heading h2{font-size:21px}}
    `}</style>
  </section>;
}

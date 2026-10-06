"use client";

import { AppSelect } from "@/components/app-dropdown";
import { ClassBadge, RecordBadge } from "@/components/record-badge";
import { OperationalChild, OperationalStatus } from "@/components/operational-table";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiCheck, FiClock, FiDownload, FiExternalLink, FiSearch } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { readActiveService, subscribeToActiveService } from "@/lib/active-service";
import { downloadTablePdf } from "@/lib/table-pdf";
import { parseCampusTime } from "@/lib/campus-time";

type CheckInRow = { id: number; firstName: string; lastName: string; className?: string; status: string; source?: "ASSISTED" | "PARENT_QR"; checkedInAt?: string | null; firstVisit: boolean; guardianFirstName?: string; guardianLastName?: string; checkInFormUrl?: string | null };
type RequestChild = { id: number; firstName: string; lastName?: string };
type CheckInRequest = { id: number; status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED"; requestedAt: string; guardianFirstName?: string; guardianLastName?: string; guardianPhone?: string; children: RequestChild[] };
type ExportSort = "lastNameAsc" | "lastNameDesc" | "firstNameAsc" | "firstNameDesc";

function formatCheckInTime(value?: string | null) {
  if (!value) return "—";
  const date = parseCampusTime(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", { timeStyle: "short", timeZone: "Africa/Lagos" }).format(date);
}

function openPrintReport(title:string,columns:string[],rows:string[][]) {
  const service=readActiveService();
  return downloadTablePdf("tpk-check-in-report.pdf",{title,columns,rows,widths:[150,95,150,65,70,110,110],subtitle:`${service?.serviceDate||""} - ${service?.label||"Service"}`});
}

export default function AccountCheckInPage() {
  const session = useMemo(readTeacherSession, []);
  const searchParams = useSearchParams();
  const requestedServiceId = Number(searchParams.get("serviceSessionId")) || undefined;
  const pendingRequestedServiceId = useRef<number | undefined>(requestedServiceId);
  const [items, setItems] = useState<CheckInRow[]>([]);
  const [requests, setRequests] = useState<CheckInRequest[]>([]);
  const [canApprove, setCanApprove] = useState(false);
  const [canOperate, setCanOperate] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [exportSort, setExportSort] = useState<ExportSort>("lastNameAsc");
  const initialServiceId = readActiveService()?.id;
  const [serviceSessionId, setServiceSessionId] = useState<number | undefined>(initialServiceId);
  const loadSequence = useRef(0);
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    if (!session) { setLoading(false); return; }
    const sequence = ++loadSequence.current;
    setLoading(true); setError("");
    try {
      if (!serviceSessionId) { if (sequence === loadSequence.current) { setItems([]); setCanOperate(false); } return; }
      const response = await fetch(`${apiBase}/api/v1/check-ins?serviceSessionId=${serviceSessionId}&search=${encodeURIComponent(query)}`, { headers: { ...authHeaders(session), "Cache-Control": "no-cache" }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "We could not load check-ins.");
      if (sequence === loadSequence.current) {
        setItems(result.data.items || []);
        setCanOperate(Boolean(result.data.canOperate));
      }
    } catch (reason) { if (sequence === loadSequence.current) setError(reason instanceof Error ? reason.message : "We could not load check-ins."); }
    finally { if (sequence === loadSequence.current) setLoading(false); }
  }, [query, serviceSessionId, session]);

  const loadRequests = useCallback(async () => {
    if (!session) return;
    const sequence = ++requestSequence.current;
    try {
      if (!serviceSessionId) { if (sequence === requestSequence.current) { setCanApprove(false); setRequests([]); setRequestError(""); } return; }
      let response = await fetch(`${apiBase}/api/v1/check-in-requests?serviceSessionId=${serviceSessionId}`, { headers: { ...authHeaders(session), "Cache-Control": "no-cache" }, cache: "no-store" });
      let result = await response.json();
      if (sequence !== requestSequence.current) return;
      if (response.status === 403) { setCanApprove(false); setRequests([]); setRequestError(""); return; }
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load check-in requests.");
      setCanApprove(Boolean(result.data.canApprove)); setRequests(result.data.items || []); setRequestError("");
    } catch (reason) { if (sequence === requestSequence.current) setRequestError(reason instanceof Error ? reason.message : "We could not load check-in requests."); }
  }, [serviceSessionId, session]);

  useEffect(() => {
    const unsubscribe = subscribeToActiveService(service => setServiceSessionId(service?.id));
    /* A notification can target an exact service. Use it once on arrival,
       then keep following the existing top-bar selector. */
    if (pendingRequestedServiceId.current) {
      setServiceSessionId(pendingRequestedServiceId.current);
      pendingRequestedServiceId.current = undefined;
      return unsubscribe;
    }
    /* The top bar normally publishes the active service. Keep the page usable
       when opened directly before that bar has hydrated, without clobbering
       an already-selected service. */
    if (!readTeacherSession()) return unsubscribe;
    if (readActiveService()?.id) return unsubscribe;
    let cancelled = false;
    fetch(`${apiBase}/api/v1/service-sessions/current`, { headers: authHeaders(session) })
      .then(response => response.json())
      .then(result => {
        if (!cancelled && result.success && result.data?.id) setServiceSessionId(Number(result.data.id));
      })
      .catch(() => undefined);
    return () => { cancelled = true; unsubscribe(); };
  }, [session]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, query ? 180 : 0); const refresh = window.setInterval(() => void load(), 7_500); return () => { window.clearTimeout(timer); window.clearInterval(refresh); }; }, [load, query]);
  useEffect(() => { void loadRequests(); const timer = window.setInterval(() => { void loadRequests(); }, 7_500); return () => window.clearInterval(timer); }, [loadRequests]);
  useEffect(() => {
    setItems([]);
    setRequests([]);
    setCanOperate(false);
    setCanApprove(false);
    setError("");
    setRequestError("");
  }, [serviceSessionId]);

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
  const sortedItems = useMemo(() => {
    const direction = exportSort.endsWith("Desc") ? -1 : 1;
    const byLastName = exportSort.startsWith("lastName");
    return [...items].sort((left, right) => {
      const primary = (byLastName ? left.lastName : left.firstName).localeCompare(byLastName ? right.lastName : right.firstName, "en", { sensitivity: "base" }) ||
        (byLastName ? left.firstName : left.lastName).localeCompare(byLastName ? right.firstName : right.lastName, "en", { sensitivity: "base" });
      return primary * direction;
    });
  }, [exportSort, items]);
  const exportPdf = () => openPrintReport("TPK Check-In Report", ["Child", "Class", "Guardian", "Visit", "Check-In", "Source", "Status"], sortedItems.map((item) => [
    `${item.firstName} ${item.lastName}`,
    item.className || "Class assignment required",
    [item.guardianFirstName, item.guardianLastName].filter(Boolean).join(" ") || "—",
    item.firstVisit ? "First Visit" : "Returning",
    formatCheckInTime(item.checkedInAt),
    item.source === "ASSISTED" ? "Assisted check-in" : "Parent check-in",
    item.status.replaceAll("_", " "),
  ])).catch(reason=>setError(reason instanceof Error?reason.message:"We could not export this report. Please try again."));
  return <section className="staff-checkin">
    <header><div><p className="eyebrow">Petra Wuse</p><h1>Check-In</h1><p className="intro">{canOperate?"Monitor live arrivals and confirm the parent requests assigned to you.":"See children arriving for the selected service, updated automatically."}</p></div></header>
    {canApprove && <section className="approval-panel"><div className="approval-heading"><span><FiClock /></span><div><h2>Parent check-in requests</h2><p>As an authorised service lead, approve each request before attendance and a pickup code are created.</p></div><b>{pending.length} waiting</b></div>{requestError && <p className="error">{requestError}</p>}<div className="request-grid">{pending.map((request) => <article className="request-card" key={request.id}><div><b>{[request.guardianFirstName, request.guardianLastName].filter(Boolean).join(" ") || "Parent / Guardian"}</b><small>{request.guardianPhone || "Phone unavailable"} · {new Intl.DateTimeFormat("en-NG", { timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(request.requestedAt))}</small></div><p>{request.children.map((child) => `${child.firstName}${child.lastName ? ` ${child.lastName}` : ""}`).join(" · ")}</p><button className="approve-button" disabled={approvingId === request.id} onClick={() => approve(request.id)}>{approvingId === request.id ? "Approving…" : <><FiCheck />Approve check-in</>}</button></article>)}{!pending.length && <p className="request-empty">No parent check-in requests are waiting right now.</p>}</div></section>}
    <section className="panel checkin-records"><div className="checkin-records-heading"><div><p className="eyebrow">Attendance register</p><h2>Children checked in</h2><p>{canOperate?"Arrivals, pickup status and tickets for the selected service.":"Live arrivals and pickup status for the selected service."}</p></div><b>{items.length} children</b></div><div className="checkin-toolbar"><label aria-label="Search children or guardians"><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search child or guardian" /></label><div className="checkin-toolbar-actions"><span>{loading ? (items.length ? "Updating…" : "Loading arrivals…") : "Up to date"}</span><label className="export-sort"><span>Sort by name</span><AppSelect aria-label="Sort children by name" value={exportSort} onChange={(event) => setExportSort(event.target.value as ExportSort)}><option value="lastNameAsc">Last name A–Z</option><option value="lastNameDesc">Last name Z–A</option><option value="firstNameAsc">First name A–Z</option><option value="firstNameDesc">First name Z–A</option></AppSelect></label><button className="outline-button" type="button" onClick={exportPdf} disabled={!items.length}><FiDownload /> Export PDF</button></div></div>{error ? <p className="error">{error}</p> : <div className="table-wrap operations-table-frame" aria-busy={loading}><table className="operations-table" aria-label="Children checked in"><thead><tr><th>Child</th><th>Class</th><th>Guardian</th><th>Visit</th><th>Check-In</th><th>Source</th><th>Status</th>{canOperate&&<th>Ticket</th>}</tr></thead><tbody>{sortedItems.map((item) => <tr key={item.id}><td data-label="Child"><OperationalChild firstName={item.firstName} lastName={item.lastName} /></td><td data-label="Class"><ClassBadge name={item.className} /></td><td data-label="Guardian">{[item.guardianFirstName, item.guardianLastName].filter(Boolean).join(" ") || "—"}</td><td data-label="Visit"><RecordBadge tone={item.firstVisit ? "amber" : "neutral"}>{item.firstVisit ? "First visit" : "Returning"}</RecordBadge></td><td data-label="Arrival" className="operational-time">{formatCheckInTime(item.checkedInAt)}</td><td data-label="Check-in method">{item.source === "ASSISTED" ? "Desk check-in" : "Parent form"}</td><td data-label="Status"><OperationalStatus status={item.status} /></td>{canOperate&&<td data-label="Pickup ticket">{item.checkInFormUrl ? <a className="form-link operational-ticket" href={item.checkInFormUrl} rel="noreferrer" target="_blank">Open ticket <FiExternalLink /></a> : "—"}</td>}</tr>)}{!items.length && loading && <tr><td colSpan={canOperate?8:7} className="empty" role="status">Loading arrivals…</td></tr>}{!items.length && !loading && <tr><td colSpan={canOperate?8:7} className="empty">No children have checked in for the selected service.</td></tr>}</tbody></table></div>}</section>
    <style jsx>{`
      .staff-checkin header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}.staff-checkin h1,.staff-checkin h2{font-family:var(--font-body)}.readonly-notice{margin:-7px 0 18px;padding:11px 13px;border:1px solid #f0dfb6;border-radius:10px;background:#fff9e9;color:#896515;font-size:12px;line-height:1.45}.approval-panel{margin-bottom:22px;border:1px solid #f1d2c2;border-radius:14px;padding:20px;background:#fffaf5}.approval-heading{display:flex;align-items:flex-start;gap:12px}.approval-heading>span{display:grid;place-items:center;width:39px;height:39px;border-radius:50%;background:#fff0e8;color:#f54e2c}.approval-heading h2{margin:0;font-size:24px}.approval-heading p{margin:4px 0 0;max-width:650px;color:var(--muted);font-size:13px}.approval-heading>b{margin-left:auto;border-radius:99px;padding:7px 10px;background:#fff0e8;color:#d84223;font-size:12px}.request-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px;margin-top:16px}.request-card{border:1px solid var(--line);border-radius:11px;padding:15px;background:#fff}.request-card b,.request-card small{display:block}.request-card small{margin-top:4px;color:var(--muted);font-size:11px}.request-card p{min-height:36px;margin:13px 0;color:#314969;font-size:13px}.approve-button{width:100%;height:40px;display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:8px;background:#ff4b28;color:#fff;font:800 13px var(--font-body);cursor:pointer}.approve-button:disabled{opacity:.6;cursor:wait}.request-empty{margin:0;color:var(--muted);font-size:13px}.checkin-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}.checkin-toolbar label{height:42px;min-width:min(440px,70%);display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid var(--line);border-radius:8px}.checkin-toolbar input{width:100%;border:0;background:transparent;outline:0;font:13px var(--font-body)}.checkin-toolbar span{font-size:11px;color:var(--muted)}.checkin-toolbar-actions{display:flex;align-items:center;gap:10px}.checkin-toolbar-actions .outline-button{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.export-sort{display:flex!important;align-items:center;gap:6px;min-width:auto!important;height:auto!important;padding:0!important;border:0!important;border-radius:0!important;color:var(--muted);font-size:11px;white-space:nowrap}.export-sort select{height:38px;max-width:150px;padding:0 28px 0 9px;border:1px solid var(--line);border-radius:8px;background:#fff;color:#314969;font:700 11px var(--font-body);outline:0}.error{color:#c8452c}.form-link{display:inline-flex;align-items:center;gap:5px;color:#e6492c;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}@media(max-width:590px){.staff-checkin header{display:grid;gap:13px}.checkin-toolbar{display:grid}.checkin-toolbar label{min-width:0;width:100%}.checkin-toolbar-actions{justify-content:space-between;flex-wrap:wrap}.export-sort{width:100%;justify-content:space-between}.export-sort select{max-width:none;flex:1}.approval-heading>b{display:inline-flex;margin-left:0}.approval-heading h2{font-size:21px}}
    `}</style>
  </section>;
}

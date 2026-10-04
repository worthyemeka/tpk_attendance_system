"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FiCheck, FiClock, FiDownload, FiExternalLink, FiSearch } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { readActiveService, subscribeToActiveService } from "@/lib/active-service";

type CheckInRow = { id: number; firstName: string; lastName: string; className?: string; status: string; source?: "ASSISTED" | "PARENT_QR"; checkedInAt?: string | null; firstVisit: boolean; guardianFirstName?: string; guardianLastName?: string; checkInFormUrl?: string | null };
type RequestChild = { id: number; firstName: string; lastName?: string };
type CheckInRequest = { id: number; status: "PENDING" | "APPROVED" | "DECLINED" | "CANCELLED"; requestedAt: string; guardianFirstName?: string; guardianLastName?: string; guardianPhone?: string; children: RequestChild[] };
type ExportSort = "lastNameAsc" | "lastNameDesc" | "firstNameAsc" | "firstNameDesc";

function formatCheckInTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-NG", { timeStyle: "short", timeZone: "Africa/Lagos" }).format(date);
}

const printValue = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);

function openPrintReport(title: string, headers: string[], rows: string[][]) {
  const report = window.open("", "_blank", "noopener,noreferrer");
  if (!report) return;
  const head = headers.map((header) => `<th>${printValue(header)}</th>`).join("");
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${printValue(cell)}</td>`).join("")}</tr>`).join("");
  report.document.write(`<!doctype html><html><head><title>${printValue(title)}</title><style>body{font:14px Arial,sans-serif;color:#1c2d4d;padding:32px}h1{font-size:22px;margin:0 0 6px}p{color:#697792;margin:0 0 22px}table{width:100%;border-collapse:collapse}th,td{text-align:left;border:1px solid #dfe4eb;padding:9px}th{background:#f6f1ea;font-size:11px;text-transform:uppercase;letter-spacing:.04em}td{font-size:12px}@media print{body{padding:0}}</style></head><body><h1>${printValue(title)}</h1><p>Exported ${printValue(new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date()))}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  report.document.close();
  report.focus();
  report.print();
}

export default function AccountCheckInPage() {
  const session = readTeacherSession();
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
    if (!session) return;
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
      if (response.status === 403) { setCanApprove(false); setRequests([]); setRequestError(result.error?.message || "You are not assigned to approve this service."); return; }
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
  }, [session?.staffUserId, session?.sessionToken]);

  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 180); return () => window.clearTimeout(timer); }, [load]);
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
  ]));
  return <section className="staff-checkin">
    <header><div><p className="eyebrow">Petra Wuse</p><h1>Check-In</h1><p className="intro">Monitor live arrivals and confirm the parent requests assigned to you.</p></div></header>
    {!canOperate && serviceSessionId && <p className="readonly-notice">Desk check-in and parent approval are available to authorised service leads for the selected service.</p>}
    {canApprove && <section className="approval-panel"><div className="approval-heading"><span><FiClock /></span><div><h2>Parent check-in requests</h2><p>As an authorised service lead, approve each request before attendance and a pickup code are created.</p></div><b>{pending.length} waiting</b></div>{requestError && <p className="error">{requestError}</p>}<div className="request-grid">{pending.map((request) => <article className="request-card" key={request.id}><div><b>{[request.guardianFirstName, request.guardianLastName].filter(Boolean).join(" ") || "Parent / Guardian"}</b><small>{request.guardianPhone || "Phone unavailable"} · {new Intl.DateTimeFormat("en-NG", { timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(request.requestedAt))}</small></div><p>{request.children.map((child) => `${child.firstName}${child.lastName ? ` ${child.lastName}` : ""}`).join(" · ")}</p><button className="approve-button" disabled={approvingId === request.id} onClick={() => approve(request.id)}>{approvingId === request.id ? "Approving…" : <><FiCheck />Approve check-in</>}</button></article>)}{!pending.length && <p className="request-empty">No parent check-in requests are waiting right now.</p>}</div></section>}
    <section className="panel"><div className="checkin-toolbar"><label><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search child or guardian" /></label><div className="checkin-toolbar-actions"><span>{loading ? "Loading…" : `${items.length} live check-ins`}</span><label className="export-sort"><span>Sort export</span><select value={exportSort} onChange={(event) => setExportSort(event.target.value as ExportSort)}><option value="lastNameAsc">Last name A–Z</option><option value="lastNameDesc">Last name Z–A</option><option value="firstNameAsc">First name A–Z</option><option value="firstNameDesc">First name Z–A</option></select></label><button className="outline-button" type="button" onClick={exportPdf} disabled={!items.length}><FiDownload /> Export PDF</button></div></div>{error ? <p className="error">{error}</p> : <div className="table-wrap"><table><thead><tr><th>Child</th><th>Class</th><th>Guardian</th><th>Visit</th><th>Check-In</th><th>Source</th><th>Status</th><th>Ticket</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td><b>{item.firstName} {item.lastName}</b></td><td>{item.className || "Class assignment required"}</td><td>{[item.guardianFirstName, item.guardianLastName].filter(Boolean).join(" ") || "—"}</td><td>{item.firstVisit ? "First Visit" : "Returning"}</td><td>{formatCheckInTime(item.checkedInAt)}</td><td>{item.source === "ASSISTED" ? "Assisted check-in" : "Parent check-in"}</td><td>{item.status.replaceAll("_", " ")}</td><td>{item.checkInFormUrl ? <a className="form-link" href={item.checkInFormUrl} rel="noreferrer" target="_blank">Open ticket <FiExternalLink /></a> : "—"}</td></tr>)}{!items.length && !loading && <tr><td colSpan={8} className="empty">No children have checked in for the selected service.</td></tr>}</tbody></table></div>}</section>
    <style jsx>{`
      .staff-checkin header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:22px}.staff-checkin h1,.staff-checkin h2{font-family:var(--font-display),Georgia,serif}.readonly-notice{margin:-7px 0 18px;padding:11px 13px;border:1px solid #f0dfb6;border-radius:10px;background:#fff9e9;color:#896515;font-size:12px;line-height:1.45}.approval-panel{margin-bottom:22px;border:1px solid #f1d2c2;border-radius:14px;padding:20px;background:#fffaf5}.approval-heading{display:flex;align-items:flex-start;gap:12px}.approval-heading>span{display:grid;place-items:center;width:39px;height:39px;border-radius:50%;background:#fff0e8;color:#f54e2c}.approval-heading h2{margin:0;font-size:24px}.approval-heading p{margin:4px 0 0;max-width:650px;color:var(--muted);font-size:13px}.approval-heading>b{margin-left:auto;border-radius:99px;padding:7px 10px;background:#fff0e8;color:#d84223;font-size:12px}.request-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:12px;margin-top:16px}.request-card{border:1px solid var(--line);border-radius:11px;padding:15px;background:#fff}.request-card b,.request-card small{display:block}.request-card small{margin-top:4px;color:var(--muted);font-size:11px}.request-card p{min-height:36px;margin:13px 0;color:#314969;font-size:13px}.approve-button{width:100%;height:40px;display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:8px;background:#ff4b28;color:#fff;font:800 13px var(--font-body);cursor:pointer}.approve-button:disabled{opacity:.6;cursor:wait}.request-empty{margin:0;color:var(--muted);font-size:13px}.checkin-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}.checkin-toolbar label{height:42px;min-width:min(440px,70%);display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid var(--line);border-radius:8px}.checkin-toolbar input{width:100%;border:0;background:transparent;outline:0;font:13px var(--font-body)}.checkin-toolbar span{font-size:11px;color:var(--muted)}.checkin-toolbar-actions{display:flex;align-items:center;gap:10px}.checkin-toolbar-actions .outline-button{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.error{color:#c8452c}.form-link{display:inline-flex;align-items:center;gap:5px;color:#e6492c;font-size:12px;font-weight:800;text-decoration:none;white-space:nowrap}@media(max-width:590px){.staff-checkin header{display:grid;gap:13px}.checkin-toolbar{display:grid}.checkin-toolbar label{min-width:0;width:100%}.checkin-toolbar-actions{justify-content:space-between}.approval-heading>b{display:none}.approval-heading h2{font-size:21px}}
    `}</style>
  </section>;
}

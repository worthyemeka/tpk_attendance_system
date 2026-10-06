"use client";
/* The dynamic status labels mirror the API vocabulary exactly. */
/* eslint-disable react/no-unescaped-entities */
import { AppSelect } from "@/components/app-dropdown";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiMessageCircle,
  FiPhone,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { StatCard, type StatCardTone } from "@/components/stat-card";
import { DataViewToggle, type DataView } from "@/components/data-view-toggle";
import { ClassBadge, RecordBadge } from "@/components/record-badge";
import { useProfileDialog } from "@/components/use-profile-dialog";
import "./followup-refinements.css";
import { FollowupHistory } from "./followup-history";
import { DirectoryPagination } from "./directory-pagination";
import { followupAssignee, followupCompletion } from "@/lib/followup-completion";
type Case = {
  id: number;
  familyId: number;
  familyName: string;
  status: string;
  leadershipStatus: string;
  childrenCount: number;
  children: string;
  classes: string;
  lastAttended?: string;
  missedSundays?: number;
  guardianId?: number;
  guardianName?: string;
  guardianPhone?: string;
  ownerName: string;
  ownerId?: number | string | null;
  lastContactedAt?: string | null;
  followUpSentBy?: string | null;
};
type Detail = Omit<Case, "children"> & {
  reason?: string;
  notes?: string;
  expectedBack?: string;
  primaryContact?: {
    firstName: string;
    lastName: string;
    primaryPhone?: string;
    secondaryPhone?: string;
    relationship?: string;
  };
  children: {
    id: number;
    firstName: string;
    lastName: string;
    className?: string;
    lastAttended?: string;
    missedServiceDate?: string;
    taskType?: string;
  }[];
  history: {
    id: number;
    eventType: string;
    reason?: string;
    notes?: string;
    expectedBack?: string;
    createdAt: string;
    staffName: string;
  }[];
};
type Summary = {
  needFollowUp: number;
  contacted: number;
  couldntReach: number;
  needsLeadership: number;
  childrenAcrossNeedFollowUp: number;
  canManage?: boolean;
};
type ClassOption = { id: number; name: string };
type Assignee = { id: number; name: string; profileImageUrl?: string | null };
type FollowupRecipient = { id: number; name: string; phone: string };
const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const date = (v?: string) =>
  v
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${v.slice(0, 10)}T12:00:00`))
    : "Not yet attended";
const childNames = (s: string) =>
  s
    .split(" | ")
    .map((x) => x.split(":").slice(1).join(":"))
    .filter(Boolean)
    .join(", ");
export function FollowupWorkspace() {
  const session = useMemo(() => readTeacherSession(), []);
  const [summary, setSummary] = useState<Summary>({
      needFollowUp: 0,
      contacted: 0,
      couldntReach: 0,
      needsLeadership: 0,
      childrenAcrossNeedFollowUp: 0,
    }),
    [rows, setRows] = useState<Case[]>([]),
    [tab, setTab] = useState("needs"),
    [query, setQuery] = useState(""),
    [classes, setClasses] = useState<ClassOption[]>([]),
    [classId, setClassId] = useState(""),
    [missed, setMissed] = useState(""),
    [month, setMonth] = useState(""),
    [year, setYear] = useState(""),
    [ownerId, setOwnerId] = useState(""),
    [status, setStatus] = useState(""),
    [assignees, setAssignees] = useState<Assignee[]>([]),
    [followupRecipients, setFollowupRecipients] = useState<FollowupRecipient[]>([]),
    [page, setPage] = useState(1),
    [pageSizeOverride, setPageSizeOverride] = useState<number|null>(null),
    [total, setTotal] = useState(0),
    [childrenTotal, setChildrenTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [detail, setDetail] = useState<Detail | null>(null),
    [drawerTab, setDrawerTab] = useState<"children" | "contact" | "history">(
      "children",
    ),
    [outcome, setOutcome] = useState("CONTACTED"),
    [reason, setReason] = useState(""),
    [notes, setNotes] = useState(""),
    [expectedBack, setExpectedBack] = useState(""),
    [error, setError] = useState(""),
    [display, setDisplay] = useState<DataView>("LIST");
  const request = useRef(0);
  const pageSize=pageSizeOverride??(display==="GRID"?12:10);
  useEffect(() => {
    const saved = window.localStorage.getItem("tpk:followups-display");
    if (saved === "GRID" || saved === "LIST") setDisplay(saved);
    else if (window.matchMedia("(max-width: 1024px)").matches) setDisplay("GRID");
  }, []);
  const setFollowupDisplay = (value: DataView) => {
    setDisplay(value);
    setPageSizeOverride(null);
    setPage(1);
    window.localStorage.setItem("tpk:followups-display", value);
  };
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!session) { setLoading(false); return; }
    const current = ++request.current;
    setLoading(true); setError("");
    try {
      const p = new URLSearchParams({ tab, page: String(page), limit: String(pageSize) });
      if (query) p.set("search", query);
      if (classId) p.set("classId", classId);
      if (missed) p.set("missed", missed);
      if (month) p.set("month", month);
      if (year) p.set("year", year);
      if (ownerId) p.set("ownerId", ownerId);
      if (status) p.set("status", status);
      const [a, b] = await Promise.all([
        fetch(`${apiBase}/api/v1/follow-ups?${p}`, {
          headers: authHeaders(session),
          signal, cache: "no-store",
        }),
        fetch(`${apiBase}/api/v1/follow-ups/summary`, {
          headers: authHeaders(session),
          signal, cache: "no-store",
        }),
      ]);
      const ar = await a.json(),
        br = await b.json();
      if (!a.ok || !ar.success || !b.ok || !br.success)
        throw new Error("We couldn’t load follow-ups. Please try again.");
      if (current !== request.current || signal?.aborted) return;
      setRows(ar.data || []);
      setTotal(Number(ar.meta?.total || 0));
      setChildrenTotal(Number(ar.meta?.childrenTotal || 0));
      if (br.success) setSummary(br.data);
      const lastPage = Math.max(1, Math.ceil(Number(ar.meta?.total || 0) / pageSize));
      if (page > lastPage) setPage(lastPage);
      setError("");
    } catch {
      if (current !== request.current || signal?.aborted) return;
      setError("We couldn’t load follow-ups. Please try again.");
    } finally {
      if (current === request.current && !signal?.aborted) setLoading(false);
    }
  }, [session, tab, page, pageSize, query, classId, missed, month, year, ownerId, status]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 180 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load]);
  useEffect(() => {
    if (!session) return;
    void fetch(`${apiBase}/api/v1/classes`, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((body) => { if (body.success) setClasses(body.data || []); })
      .catch(() => undefined);
  }, [session]);
  useEffect(() => {
    if (!session) return;
    void fetch(`${apiBase}/api/v1/follow-ups/recipients`, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((body) => {
        if (body.success) setFollowupRecipients((body.data || []).filter((person: FollowupRecipient) => person.name && person.phone));
      })
      .catch(() => undefined);
  }, [session]);
  const canManage = session?.accessLevel === "TPK_SUPER_ADMIN" || session?.accessLevel === "TPK_FOLLOW_UP_ADMIN";
  useEffect(() => {
    if (!session || !canManage) return;
    void fetch(`${apiBase}/api/v1/follow-ups/assignees`, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((body) => { if (body.success) setAssignees(body.data || []); })
      .catch(() => undefined);
  }, [canManage, session]);
  const open = async (id: number) => {
    if (!session) return;
    const r = await fetch(`${apiBase}/api/v1/follow-ups/${id}`, {
        headers: authHeaders(session),
      }),
      b = await r.json();
    if (b.success) {
      setDetail(b.data);
      setDrawerTab("children");
      setOutcome("CONTACTED");
      setReason(b.data.reason || "");
      setNotes(b.data.notes || "");
      setExpectedBack(b.data.expectedBack || "");
    } else setError(b.error?.message || "We could not open this follow-up.");
  };
  const save = async () => {
    if (!detail || !session) return;
    const r = await fetch(`${apiBase}/api/v1/follow-ups/${detail.id}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ outcome, reason, notes, expectedBack }),
      }),
      b = await r.json();
    if (!b.success) {
      setError(b.error?.message || "We could not save this follow-up.");
      return;
    }
    await open(detail.id);
    void load();
  };
  const assign = async (staffUserId: number) => {
    if (!detail || !session) return;
    const response = await fetch(`${apiBase}/api/v1/follow-ups/${detail.id}/assignment`, {
      method: "PATCH", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify({ staffUserId }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) { setError(result.error?.message || "We could not assign this follow-up."); return; }
    await open(detail.id); void load();
  };
  const years = useMemo(() => Array.from({ length: Math.max(1, new Date().getFullYear() - 2026 + 1) }, (_, index) => String(2026 + index)), []);
  const tabs = [
    ["needs", `Needs Follow-Up (${summary.needFollowUp})`],
    ["contacted", `Contacted (${summary.contacted})`],
    ["leadership", `Follow-Up Report Sent (${summary.needsLeadership})`],
  ];
  const hasFilters = Boolean(query || classId || missed || month || year || ownerId || status);
  const clearFilters = () => { setQuery(""); setClassId(""); setMissed(""); setMonth(""); setYear(""); setOwnerId(""); setStatus(""); setPage(1); };
  return (
    <>
      <section className="followup followup-refined">
        <header>
          <p className="eyebrow">Petra Wuse</p>
          <h1>Relations &amp; Follow-Up</h1>
          <p>
            Check in with families whose children have been away and keep
            leadership updated.
          </p>
        </header>
        <section className="cards">
          <Card
            value={summary.needFollowUp}
            label="Families to Follow Up"
            text={`${summary.childrenAcrossNeedFollowUp} children across ${summary.needFollowUp} families`}
            tone="red"
          />
          <Card
            value={summary.contacted}
            label="Contacted"
            text="Families contacted"
            tone="green"
          />
          <Card
            value={summary.couldntReach}
            label="Couldn't Reach"
            text="Try again later"
            tone="amber"
          />
          <Card
            value={summary.needsLeadership}
            label="Follow-Up Report Sent"
            text="Sent to TPK leadership"
            tone="purple"
          />
        </section>
        <nav className="tabs" aria-label="Follow-up progress">
          {tabs.map(([id, label]) => (
            <button
              className={tab === id ? "on" : ""}
              key={id}
              aria-current={tab === id ? "page" : undefined}
              onClick={() => {
                setTab(id);
                setStatus("");
                setPage(1);
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <section className="tools">
          <label>
            <FiSearch />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search family, child or guardian…"
              aria-label="Search family, child, guardian or phone"
            />
          </label>
          <span className="app-dropdown-host">
            <AppSelect
              aria-label="Filter by class"
              onChange={(e) => {
                setClassId(e.target.value);
                setPage(1);
              }}
              value={classId}
            >
              <option value="">All Classes</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </AppSelect>
          </span>
          <span className="app-dropdown-host">
            <AppSelect
              aria-label="Filter by missed Sundays"
              onChange={(e) => {
                setMissed(e.target.value);
                setPage(1);
              }}
              value={missed}
            >
              <option value="">All missed Sundays</option>
              <option value="1">1+ Sunday</option>
              <option value="2">2+ Sundays</option>
              <option value="3">3+ Sundays</option>
            </AppSelect>
          </span>
          <span className="app-dropdown-host"><AppSelect aria-label="Filter by month" onChange={(e) => { setMonth(e.target.value); setPage(1); }} value={month}><option value="">All months</option>{months.map((label, index) => <option key={label} value={String(index + 1)}>Filter by {label}</option>)}</AppSelect></span>
          <span className="app-dropdown-host"><AppSelect aria-label="Filter by year" onChange={(e) => { setYear(e.target.value); setPage(1); }} value={year}><option value="">All years</option>{years.map((value) => <option key={value} value={value}>Filter by {value}</option>)}</AppSelect></span>
          {canManage && <span className="app-dropdown-host"><AppSelect aria-label="Filter by assigned teacher" value={ownerId} onChange={event => { setOwnerId(event.target.value); setPage(1); }}><option value="">All assignments</option><option value="unassigned">Not assigned</option>{assignees.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</AppSelect></span>}
          {tab === "needs" && <span className="app-dropdown-host"><AppSelect aria-label="Filter by progress" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All pending progress</option><option value="NEEDS_FOLLOW_UP">Needs follow-up</option><option value="COULDNT_REACH">Couldn’t reach</option></AppSelect></span>}
        </section>
        <div className="followup-results-heading"><div><h2>{loading ? "Loading families…" : `${total} ${total === 1 ? "family" : "families"}${hasFilters ? " matching your filters" : tab === "needs" ? " need follow-up" : " in this view"}`}</h2><p>{loading ? "Getting the latest follow-up records." : `${childrenTotal} ${childrenTotal === 1 ? "child" : "children"} across these families. Open a family to assign a call or record an update.`}</p></div><div>{hasFilters && <button type="button" className="followup-clear" onClick={clearFilters}>Clear filters</button>}<DataViewToggle value={display} onChange={setFollowupDisplay} gridLabel="Follow-up cards" listLabel="Follow-up table" /></div></div>
        {error ? (
          <div role="alert" className="followup-error"><p>{error}</p><button type="button" onClick={() => void load()}>Try again</button></div>
        ) : loading ? (
          <div className="followup-loading" role="status" aria-label="Loading follow-up records">{Array.from({length:5},(_,index)=><div key={index} className="skeleton" />)}</div>
        ) : (
          display === "LIST" ? <div className="table">
            <table aria-label="Family follow-up cases">
              <thead>
                <tr>
                  <th>Family / Children</th>
                  <th>Classes</th>
                  <th>Last Attended</th>
                  <th>Missed</th>
                  <th>Contact</th>
                  <th>Assigned To</th>
                  <th>Progress</th>
                  <th><span className="followup-sr-only">Open family</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} onClick={() => void open(row.id)}>
                    <td>
                      <div className="followup-family"><i aria-hidden="true">{row.familyName.slice(0,2).toUpperCase()}</i><div><b>{row.familyName} Family</b><small>{row.childrenCount} {Number(row.childrenCount) === 1 ? "child" : "children"} · {childNames(row.children)}</small></div></div>
                    </td>
                    <td><div className="followup-class-badges">{row.classes.split(", ").map(name => <ClassBadge key={name} name={name === "—" ? undefined : name} />)}</div></td>
                    <td>{date(row.lastAttended)}</td>
                    <td>
                      <RecordBadge tone="amber">
                        {row.missedSundays || 1} Sunday
                        {(row.missedSundays || 1) === 1 ? "" : "s"}
                      </RecordBadge>
                    </td>
                    <td>
                      <b>{row.guardianName || "Primary guardian"}</b>
                      <small>{row.guardianPhone || "Phone unavailable"}</small>
                    </td>
                    <td><span className={row.ownerName === "Unassigned" ? "followup-unassigned" : "followup-assigned"}>{row.ownerName === "Unassigned" ? "Not assigned" : row.ownerName}</span></td>
                    <td>
                      <Badge status={row.status} />
                    </td>
                    <td>
                      <button className="followup-open" type="button" aria-label={`Open ${row.familyName} family follow-up`} onClick={event => { event.stopPropagation(); void open(row.id); }}>View <FiChevronRight /></button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td className="empty" colSpan={8}>
                      <b>No follow-up cases found</b>
                      <small>
                        Cases appear when an attendance trigger needs a family
                        conversation.
                      </small>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div> : <div className="followup-grid">
            {rows.map((row) => <article key={row.id} onClick={() => void open(row.id)}>
              <header><span><b>{row.childrenCount === 1 ? childNames(row.children) : `${row.familyName} Family`}</b><small>{row.childrenCount} {row.childrenCount === 1 ? "child" : "children"} · {row.classes}</small></span><Badge status={row.status} /></header>
              <div><span><small>Last attended</small><b>{date(row.lastAttended)}</b></span><span><small>Missed</small><em>{row.missedSundays || 1} Sunday{(row.missedSundays || 1) === 1 ? "" : "s"}</em></span></div>
              <footer><span><small>Contact · {row.ownerName === "Unassigned" ? "Not assigned" : row.ownerName}</small><b>{row.guardianName || "Primary guardian"}</b></span><button className="followup-open" type="button" aria-label={`Open ${row.familyName} family follow-up`} onClick={event => { event.stopPropagation(); void open(row.id); }}>View <FiChevronRight /></button></footer>
            </article>)}
            {!rows.length && <p className="followup-grid-empty">No follow-up cases found.</p>}
          </div>
        )}
        <DirectoryPagination page={page} total={total} pageSize={pageSize} noun="families" loading={loading} onPageChange={setPage} onPageSizeChange={size=>{setPageSizeOverride(size);setPage(1);}}/>
        {detail && (
          <Drawer
            detail={detail}
            close={() => setDetail(null)}
            tab={drawerTab}
            setTab={setDrawerTab}
            outcome={outcome}
            setOutcome={setOutcome}
            reason={reason}
            setReason={setReason}
            notes={notes}
            setNotes={setNotes}
            expected={expectedBack}
            setExpected={setExpectedBack}
            save={save}
            canManage={canManage}
            assignees={assignees}
            assign={assign}
            followupRecipients={followupRecipients}
          />
        )}
      </section>
      <style jsx>{style}</style>
      <style jsx>{systemStyle}</style>
      <style jsx>{toolbarStyle}</style>
      <style jsx>{`
        .followup-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.followup-grid article{cursor:pointer;border:1px solid #e6e8eb;border-radius:10px;background:#fff;padding:14px;transition:border-color .16s,box-shadow .16s}.followup-grid article:hover{border-color:#f4a18b;box-shadow:0 8px 22px #14213c0d}.followup-grid header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.followup-grid header>span:first-child{display:grid;gap:3px;min-width:0}.followup-grid header b{overflow:hidden;color:#1c2e4c;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.followup-grid header small,.followup-grid small{color:#71809a;font-size:10px}.followup-grid article>div{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px;padding:11px 0;border-top:1px solid #edf0f2;border-bottom:1px solid #edf0f2}.followup-grid article>div span{display:grid;gap:4px}.followup-grid article>div b{color:#3e506d;font-size:11px}.followup-grid article footer{display:flex;align-items:center;justify-content:space-between;margin-top:11px}.followup-grid footer span{display:grid;gap:3px}.followup-grid footer b{color:#273b5d;font-size:11px}.followup-grid footer>svg{color:#58708f;font-size:18px}.followup-grid-empty{grid-column:1/-1;margin:0;padding:34px;border:1px dashed #dce2ea;border-radius:9px;color:#71809a;text-align:center;font-size:12px}@media(max-width:1050px){.followup-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.followup-grid{grid-template-columns:1fr}}
      `}</style>
    </>
  );
}
function Card({
  value,
  label,
  text,
  tone,
}: {
  value: number;
  label: string;
  text: string;
  tone: StatCardTone | "red" | "amber";
}) {
  return <StatCard icon={tone === "green" ? <FiCheckCircle /> : tone === "amber" ? <FiClock /> : <FiUsers />} value={value} title={label} description={text} tone={tone === "red" ? "orange" : tone === "amber" ? "yellow" : tone} />;
}
function Badge({ status }: { status: string }) {
  const text = status === "COULDNT_REACH" ? "Couldn’t reach" : status.toLowerCase().replaceAll("_", " ").replace(/^./, x => x.toUpperCase());
  return <RecordBadge dot tone={status === "CONTACTED" || status === "RESOLVED" ? "green" : status === "COULDNT_REACH" ? "amber" : "rose"}>{text}</RecordBadge>;
}
function Drawer({
  detail,
  close,
  tab,
  setTab,
  outcome,
  setOutcome,
  reason,
  setReason,
  notes,
  setNotes,
  expected,
  setExpected,
  save,
  canManage,
  assignees,
  assign,
  followupRecipients,
}: {
  detail: Detail;
  close: () => void;
  tab: "children" | "contact" | "history";
  setTab: (x: "children" | "contact" | "history") => void;
  outcome: string;
  setOutcome: (x: string) => void;
  reason: string;
  setReason: (x: string) => void;
  notes: string;
  setNotes: (x: string) => void;
  expected: string;
  setExpected: (x: string) => void;
  save: () => void;
  canManage: boolean;
  assignees: Assignee[];
  assign: (staffUserId: number) => void;
  followupRecipients: FollowupRecipient[];
}) {
  useProfileDialog(close, ".followup .backdrop aside");
  const g = detail.primaryContact;
  const [assignee, setAssignee] = useState(() => followupAssignee(detail.ownerId));
  const [recipientId, setRecipientId] = useState("");
  useEffect(() => setAssignee(followupAssignee(detail.ownerId)), [detail.id, detail.ownerId]);
  const completion = followupCompletion(detail);
  const assignedId = followupAssignee(detail.ownerId);
  useEffect(() => setRecipientId(followupRecipients[0] ? String(followupRecipients[0].id) : ""), [detail.id, followupRecipients]);
  const recipient = followupRecipients.find((person) => String(person.id) === recipientId);
  const recipientMessage = "TPK follow-up update\n\nPlease check your TPK board for the latest family follow-up details.";
  const recipientHref = recipient ? `https://wa.me/${recipient.phone.replace(/\D/g, "").replace(/^0/, "234")}?text=${encodeURIComponent(recipientMessage)}` : "#";
  return (
    <div className="backdrop" onMouseDown={close}>
      <aside role="dialog" aria-modal="true" aria-label="Family follow-up" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" aria-label="Close family follow-up" onClick={close}>
          <FiX />
        </button>
        <h2>
          {detail.childrenCount === 1
            ? `${detail.children[0]?.firstName || ""} ${detail.children[0]?.lastName || ""}`.trim()
            : `${detail.familyName} Family`}
        </h2>
        <Badge status={detail.status} />
        <p>
          {detail.childrenCount} {Number(detail.childrenCount) === 1 ? "child" : "children"} · {detail.missedSundays || 1} {(detail.missedSundays || 1) === 1 ? "Sunday" : "Sundays"}
          {" "}missed
        </p>
        {completion && <div className="followup-complete" role="status">
          <span className="followup-complete-icon"><FiCheckCircle /></span>
          <div><h3>Family contacted</h3><p>{completion.sunday ? `Follow-up for the week of ${date(completion.sunday)} is complete.` : "This family’s follow-up is complete."} No further call is needed for this follow-up.</p>
            {completion.contactedAt && <small>{completion.staffName ? `Contacted by ${completion.staffName} · ` : "Contact recorded · "}{date(completion.contactedAt)}</small>}
            <button type="button" onClick={() => setTab("history")}>View follow-up history <FiChevronRight /></button>
          </div>
        </div>}
        <nav>
          {(["children", "contact", "history"] as const).map((x) => (
            <button
              className={tab === x ? "on" : ""}
              key={x}
              onClick={() => setTab(x)}
            >
              {x[0].toUpperCase() + x.slice(1)}
            </button>
          ))}
        </nav>
        {tab === "children" && (
          <section>
            <h3>{completion ? "Children in this follow-up" : "Children Requiring Follow-Up"}</h3>
            {detail.children.map((c) => (
              <article className="child" key={c.id}>
                <b>
                  {c.firstName} {c.lastName}
                </b>
                <small>{c.className || "Class pending"}</small>
                <small>
                  Last attended: {date(c.lastAttended)} · Trigger:{" "}
                  {c.taskType === "TWO_WEEK_ABSENCE" ? "2 Sundays" : "1 Sunday"}
                </small>
              </article>
            ))}
          </section>
        )}
        {tab === "contact" && (
          <section>
            {canManage && !completion && <div className="assignment-box">
              <span className="assignment-kicker">Follow-up lead</span>
              <h3>{assignedId ? "Assigned follow-up teacher" : "Assign this family call"}</h3>
              <p>Only the selected teacher will receive and see this task in My Follow-Ups.</p>
              <div><AppSelect aria-label="Assigned follow-up teacher" value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Choose a regular teacher</option>{assignedId && !assignees.some(person => String(person.id) === assignedId) && <option value={assignedId}>{detail.ownerName || "Assigned teacher"}</option>}{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</AppSelect><button type="button" disabled={!assignee || assignee === assignedId} onClick={() => assign(Number(assignee))}>{assignedId ? "Update teacher" : "Assign call"}</button></div>
            </div>}
            <div className="contact">
              <h3>Primary Contact</h3>
              <b>{g ? `${g.firstName} ${g.lastName}` : "Not recorded"}</b>
              <small>{g?.relationship || "Guardian"}</small>
              <p>{g?.primaryPhone || "Phone unavailable"}</p>
              {!completion && <div>
                <a href={g?.primaryPhone ? `tel:${g.primaryPhone}` : "#"}>
                  <FiPhone />
                  Call Guardian
                </a>
                <a
                  href={
                    g?.primaryPhone
                      ? `https://wa.me/${g.primaryPhone.replace(/\D/g, "").replace(/^0/, "234")}`
                      : "#"
                  }
                  target="_blank"
                >
                  <FiMessageCircle />
                  WhatsApp
                </a>
              </div>}
            </div>
            {completion && <div className="contact followup-saved-summary"><h3>Saved follow-up</h3>{detail.ownerName && detail.ownerName !== "Unassigned" && <p><b>Assigned teacher</b><span>{detail.ownerName}</span></p>}{detail.reason && <p><b>Reason for absence</b><span>{detail.reason}</span></p>}{detail.notes && <p><b>Conversation notes</b><span>{detail.notes}</span></p>}{detail.expectedBack && <p><b>Expected back</b><span>{date(detail.expectedBack)}</span></p>}</div>}
            {!completion && followupRecipients.length > 0 && <div className="contact lead-contact">
              <h3>Message a follow-up lead</h3>
              <small>Choose a lead and WhatsApp will open with a short dashboard prompt.</small>
              <AppSelect value={recipientId} onChange={(event) => setRecipientId(event.target.value)} aria-label="Follow-up lead">
                {followupRecipients.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </AppSelect>
              <a className="lead-contact-link" href={recipientHref} target="_blank" rel="noreferrer" aria-disabled={!recipient}>
                <FiMessageCircle /> Message selected lead
              </a>
            </div>}
            {!completion && <div className="record">
              <h3>Record Follow-Up</h3>
              {[
                ["CONTACTED", "Yes, I spoke with them"],
                ["NO_ANSWER", "No answer"],
                ["NUMBER_UNAVAILABLE", "Number unavailable"],
                ["TRY_AGAIN", "Try again later"],
              ].map(([v, l]) => (
                <label key={v}>
                  <input
                    type="radio"
                    checked={outcome === v}
                    onChange={() => setOutcome(v)}
                  />
                  {l}
                </label>
              ))}
              <label>
                Reason for absence
                <AppSelect
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                >
                  <option value="">Choose reason</option>
                  <option>Travelled</option>
                  <option>Child was unwell</option>
                  <option>Family was unavailable</option>
                  <option>School / activity conflict</option>
                  <option>Transport</option>
                  <option>Other</option>
                </AppSelect>
              </label>
              <label>
                Notes
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a short note about the conversation…"
                />
              </label>
              <label>
                Expected back (optional)
                <input
                  type="date"
                  value={expected}
                  onChange={(e) => setExpected(e.target.value)}
                />
              </label>
              <button className="save" onClick={save}>
                Save Follow-Up
              </button>
            </div>}
          </section>
        )}
        {tab === "history" && <FollowupHistory key={detail.id} entries={detail.history} />}
      </aside>
    </div>
  );
}
const style = `.followup{max-width:1540px}.followup h1,.followup h2,.followup h3{font-family:var(--font-display),Georgia,serif}.followup header{margin:5px 0 17px}.followup h1{font-size:40px;margin:7px 0 4px}.followup header p:last-child{margin:0;color:#647088;font-size:17px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.tabs{display:flex;gap:24px;margin:22px 0 15px;border-bottom:1px solid #e7e1d9}.tabs button{height:38px;border:0;border-bottom:2px solid transparent;background:transparent;color:#5d6c86;font:800 12px var(--font-body)}.tabs .on{border-color:#ff5634;color:#172641}.tools{display:grid;grid-template-columns:minmax(250px,1fr) repeat(4,minmax(130px,160px));gap:10px}.tools label{height:42px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#71809a}.tools input{border:0;outline:0;width:100%;font:12px var(--font-body)}.tools :global(.app-dropdown-host),.tools :global(select){height:42px;width:100%}.count{font-weight:800;font-size:13px;color:#34435d}.table{overflow:auto;border:1px solid #ebe5de;border-radius:10px;background:#fff}.table table{width:100%;min-width:900px;border-collapse:collapse}.table th{padding:12px;text-align:left;background:#faf9f6;color:#707b91;font-size:9px}.table td{padding:10px 12px;border-top:1px solid #eee8e1;font-size:11px;color:#41506a}.table tr{cursor:pointer}.table tbody tr:hover td{background:#fffaf7}.table td b,.table td small{display:block}.table td small{margin-top:3px;color:#71809a;font-size:10px}.table em,.badge{display:inline-block;padding:6px 8px;border-radius:7px;font-style:normal;font-size:9px;font-weight:800}.table em,.badge.NEEDS_FOLLOW_UP{background:#fff0ef;color:#e33e2d}.badge.CONTACTED{background:#eaf8ef;color:#087a4b}.badge.COULDNT_REACH{background:#fff2dd;color:#b86a00}.empty{text-align:center;padding:30px!important}.backdrop{position:fixed;z-index:90;inset:0;background:#0717301c}.backdrop aside{position:absolute;right:0;top:0;width:min(100%,430px);height:100%;overflow:auto;background:#fffdfa;box-shadow:-14px 0 35px #0717301c;padding:28px;box-sizing:border-box}.close{position:absolute;right:15px;top:15px;border:0;background:transparent;font-size:20px}.backdrop h2{font-size:25px;margin:16px 0 8px}.backdrop>aside>p{margin:10px 0;color:#62718a;font-size:12px}.backdrop nav{display:flex;margin:20px -28px 0;padding:0 20px;border-bottom:1px solid #ebe5de}.backdrop nav button{height:42px;flex:1;border:0;border-bottom:2px solid transparent;background:transparent;font:700 11px var(--font-body)}.backdrop nav .on{border-color:#ff5634;color:#e14b2e}.backdrop section{padding-top:18px}.backdrop h3{font-size:18px;margin:0 0 12px}.child,.history{display:grid;gap:4px;padding:12px;margin:8px 0;border:1px solid #ebe5de;border-radius:8px}.child b,.history b{font-size:12px}.child small,.history small,.history p,.muted{margin:0;color:#687993;font-size:10px}.assignment-box,.contact,.record{padding:14px;margin-bottom:14px;border:1px solid #ebe5de;border-radius:9px}.assignment-box{background:#fff8f2}.assignment-kicker{color:#e95331;font-size:9px;font-weight:900;letter-spacing:.09em;text-transform:uppercase}.assignment-box p{color:#687993;font-size:11px;line-height:1.45}.assignment-box div{display:grid;grid-template-columns:1fr auto;gap:8px}.assignment-box select,.assignment-box button{min-height:39px;border-radius:8px;font:700 11px var(--font-body)}.assignment-box select{border:1px solid #dbe0e9;background:#fff;padding:0 8px}.assignment-box button{border:0;background:#ff5a34;color:#fff;padding:0 12px;cursor:pointer}.assignment-box button:disabled{opacity:.55;cursor:not-allowed}.contact>b,.contact small{display:block}.contact small{color:#687993;font-size:10px}.contact p{font-size:12px}.contact div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.contact a,.save{height:38px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:7px;text-decoration:none;font:800 10px var(--font-body)}.contact a:first-child,.save{background:#078c55;color:#fff}.contact a:last-child{border:1px solid #dbe0e9;color:#087a4b}.lead-contact select{width:100%;height:38px;margin-top:10px;border:1px solid #dbe0e9;border-radius:7px;background:#fff;padding:0 8px;font:11px var(--font-body)}.lead-contact .lead-contact-link{margin-top:9px;border:1px solid #dbe0e9;color:#087a4b}.record label{display:grid;gap:5px;margin:10px 0;font-size:10px;font-weight:700}.record label:has(input[type=radio]){display:flex;align-items:center}.record select,.record input:not([type=radio]),.record textarea{min-height:36px;border:1px solid #dbe0e9;border-radius:7px;padding:7px;font:11px var(--font-body)}.record textarea{min-height:65px}.save{width:100%;border:0;background:#ff5a34;margin-top:5px}@media(max-width:1000px){.cards{grid-template-columns:repeat(2,1fr)}.tools{grid-template-columns:1fr 1fr}.tools label{grid-column:1/-1}}@media(max-width:600px){.followup h1{font-size:34px}.cards,.tools{grid-template-columns:1fr}.tabs{gap:5px;overflow:auto}.tabs button{white-space:nowrap}.assignment-box div{grid-template-columns:1fr}.backdrop aside{top:auto;bottom:0;width:100%;height:90%;border-radius:18px 18px 0 0}}`;

const systemStyle = `
  .followup{max-width:1540px}.followup header{margin:4px 0 18px}.followup h1{font-size:40px;letter-spacing:-1.3px}.cards{margin-bottom:21px}.card{min-height:120px;padding:16px 20px;background:linear-gradient(135deg,#fff0ed,#fff);grid-template-columns:1fr;gap:4px}.card i{grid-row:auto;width:37px;height:37px;border-radius:11px;background:#fee1da;font-size:20px}.card strong{font:800 30px/1 var(--font-body);letter-spacing:-1.5px}.card b{font-size:13px}.card small{font-size:11px}.card.green{background:linear-gradient(135deg,#effaf4,#fff)}.card.amber{background:linear-gradient(135deg,#fff6e6,#fff)}.card.purple{background:linear-gradient(135deg,#f3efff,#fff)}.tabs{margin:0;border-bottom:1px solid #e7e1d9}.tabs button{height:39px}.tools{grid-template-columns:minmax(260px,1.55fr) minmax(128px,.62fr) minmax(155px,.72fr) minmax(132px,.62fr) auto;gap:11px;margin-top:15px;align-items:start}.tools label{height:44px;gap:9px;padding:0 13px}.tools input{font:600 12px var(--font-body)}.tools :global(.app-dropdown-host),.tools :global(select){height:44px}.more{height:44px;display:flex;align-items:center;justify-content:center;gap:8px;padding:0 13px;white-space:nowrap;cursor:pointer}.count{margin:19px 0 10px}.table table{min-width:980px}.table th{letter-spacing:.05em;text-transform:uppercase}.table td{font-size:12px}.table td:last-child{width:42px}.table td:last-child svg{font-size:18px;color:#526884}.empty{padding:34px!important}.empty small{display:block;margin-top:4px;font-size:11px}@media(max-width:1100px){.tools{grid-template-columns:1fr 1fr 1fr}.tools label{grid-column:1/-1}}@media(max-width:650px){.followup header p:last-child{font-size:14px}.cards{gap:10px}.card{min-height:100px;padding:13px}.card strong{font-size:26px}.card b{font-size:11px}.card small{font-size:10px}.tools{grid-template-columns:1fr}.tools :global(.app-dropdown-host){width:100%}.more{width:100%}}
`;

const toolbarStyle = `
  .tools{display:flex!important;flex-wrap:nowrap;gap:11px;align-items:center;margin-top:15px}
  .tools>label{flex:1 1 300px;min-width:0}
  .tools>:global(.app-dropdown-host){flex:0 1 155px;min-width:130px}
  .tools>:global(.app-dropdown-host):nth-of-type(3){flex-basis:170px}
  .more-wrap{position:relative;flex:0 0 auto}.tools>.more-wrap>.more{width:auto!important}.more-menu{position:absolute;z-index:30;top:50px;right:0;display:grid;min-width:180px;padding:5px;border:1px solid #dbe0e9;border-radius:9px;background:#fffdfa;box-shadow:0 14px 28px #11213b18}.more-menu button{height:35px;border:0;border-radius:6px;background:transparent;color:#26354d;text-align:left;padding:0 10px;font:700 11px var(--font-body);cursor:pointer;white-space:nowrap}.more-menu button:hover{background:#fff0eb;color:#e54a2a}
  @media(max-width:480px){.tools{display:grid!important;grid-template-columns:1fr}.tools>label,.tools>:global(.app-dropdown-host),.tools>.more-wrap,.tools>.more-wrap>.more{width:100%!important}.tools>:global(.app-dropdown-host){min-width:0}.more-menu{right:auto;left:0;width:100%}}
`;

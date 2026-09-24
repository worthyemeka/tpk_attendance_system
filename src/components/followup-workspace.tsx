"use client";
/* The dynamic status labels mirror the API vocabulary exactly. */
/* eslint-disable react/no-unescaped-entities */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiFilter,
  FiMessageCircle,
  FiPhone,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
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
  followUpSentBy?: string | null;
};
type Detail = Case & {
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
};
type ClassOption = { id: number; name: string };
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
    [status, setStatus] = useState(""),
    [missed, setMissed] = useState(""),
    [moreOpen, setMoreOpen] = useState(false),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [detail, setDetail] = useState<Detail | null>(null),
    [drawerTab, setDrawerTab] = useState<"children" | "contact" | "history">(
      "children",
    ),
    [outcome, setOutcome] = useState("CONTACTED"),
    [reason, setReason] = useState(""),
    [notes, setNotes] = useState(""),
    [expectedBack, setExpectedBack] = useState(""),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!session) return;
    try {
      const p = new URLSearchParams({ tab, page: String(page), limit: "25" });
      if (query) p.set("search", query);
      if (classId) p.set("classId", classId);
      if (status) p.set("status", status);
      if (missed) p.set("missed", missed);
      const [a, b] = await Promise.all([
        fetch(`${apiBase}/api/v1/follow-ups?${p}`, {
          headers: authHeaders(session),
        }),
        fetch(`${apiBase}/api/v1/follow-ups/summary`, {
          headers: authHeaders(session),
        }),
      ]);
      const ar = await a.json(),
        br = await b.json();
      if (!ar.success)
        throw new Error(ar.error?.message || "We could not load follow-ups.");
      setRows(ar.data || []);
      setTotal(ar.meta?.total || 0);
      if (br.success) setSummary(br.data);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "We could not load follow-ups.",
      );
    }
  }, [session, tab, page, query, classId, status, missed]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!session) return;
    void fetch(`${apiBase}/api/v1/classes`, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((body) => { if (body.success) setClasses(body.data || []); })
      .catch(() => undefined);
  }, [session]);
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
  const tabs = [
    ["needs", `Needs Follow-Up (${summary.needFollowUp})`],
    ["contacted", `Contacted (${summary.contacted})`],
    ["leadership", `Follow-Up Report Sent (${summary.needsLeadership})`],
  ];
  return (
    <>
      <section className="followup">
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
            label="Need Follow-Up"
            text={`${summary.childrenAcrossNeedFollowUp} children across ${summary.needFollowUp} families`}
            tone="red"
          />
          <Card
            value={summary.contacted}
            label="Contacted"
            text="Follow-up completed"
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
        <nav className="tabs">
          {tabs.map(([id, label]) => (
            <button
              className={tab === id ? "on" : ""}
              key={id}
              onClick={() => {
                setTab(id);
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
            />
          </label>
          <span className="app-dropdown-host">
            <select
              onChange={(e) => {
                setClassId(e.target.value);
                setPage(1);
              }}
              value={classId}
            >
              <option value="">All Classes</option>
              {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </span>
          <span className="app-dropdown-host">
            <select
              onChange={(e) => {
                setMissed(e.target.value);
                setPage(1);
              }}
              value={missed}
            >
              <option value="">All Missed</option>
              <option value="1">1+ Sunday</option>
              <option value="2">2+ Sundays</option>
              <option value="3">3+ Sundays</option>
            </select>
          </span>
          <span className="app-dropdown-host">
            <select
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              value={status}
            >
              <option value="">All Statuses</option>
              <option value="NEEDS_FOLLOW_UP">Needs Follow-Up</option>
              <option value="CONTACTED">Contacted</option>
              <option value="COULDNT_REACH">Couldn't Reach</option>
            </select>
          </span>
          <div className="more-wrap">
            <button className="more" onClick={() => setMoreOpen((open) => !open)} type="button">
              <FiFilter />
              More Filters
              <FiChevronDown />
            </button>
            {moreOpen && <div className="more-menu">
              <button onClick={() => { setTab("leadership"); setPage(1); setMoreOpen(false); }} type="button">Follow-Up Reports Sent</button>
              <button onClick={() => { setQuery(""); setClassId(""); setMissed(""); setStatus(""); setPage(1); setMoreOpen(false); }} type="button">Clear all filters</button>
            </div>}
          </div>
        </section>
        <p className="count">
          {total}{" "}
          {tab === "needs" ? "families need follow-up" : "follow-up cases"}
        </p>
        {error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="table">
            <table>
              <thead>
                <tr>
                  <th>Family / Children</th>
                  <th>Classes</th>
                  <th>Last Attended</th>
                  <th>Missed</th>
                  <th>Contact</th>
                  <th>Follow-Up Sent By</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} onClick={() => void open(row.id)}>
                    <td>
                      <b>
                        {row.childrenCount === 1
                          ? childNames(row.children)
                          : `${row.familyName} Family · ${row.childrenCount} children`}
                      </b>
                      <small>{childNames(row.children)}</small>
                    </td>
                    <td>{row.classes}</td>
                    <td>{date(row.lastAttended)}</td>
                    <td>
                      <em>
                        {row.missedSundays || 1} Sunday
                        {(row.missedSundays || 1) === 1 ? "" : "s"}
                      </em>
                    </td>
                    <td>
                      <b>{row.guardianName || "Primary guardian"}</b>
                      <small>{row.guardianPhone || "Phone unavailable"}</small>
                    </td>
                    <td>{row.followUpSentBy || "Not sent"}</td>
                    <td>
                      <Badge status={row.status} />
                    </td>
                    <td>
                      <FiChevronRight />
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
          </div>
        )}{" "}
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
          />
        )}
      </section>
      <style jsx>{style}</style>
      <style jsx>{systemStyle}</style>
      <style jsx>{toolbarStyle}</style>
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
  tone: string;
}) {
  return (
    <article className={`card ${tone}`}>
      <i>
        {tone === "green" ? (
          <FiCheckCircle />
        ) : tone === "amber" ? (
          <FiClock />
        ) : (
          <FiUsers />
        )}
      </i>
      <strong>{value}</strong>
      <b>{label}</b>
      <small>{text}</small>
    </article>
  );
}
function Badge({ status }: { status: string }) {
  const text =
    status === "COULDNT_REACH"
      ? "Couldn't Reach"
      : status.replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase());
  return <span className={`badge ${status}`}>{text}</span>;
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
}) {
  const g = detail.primaryContact;
  return (
    <div className="backdrop" onMouseDown={close}>
      <aside onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>
          <FiX />
        </button>
        <h2>
          {detail.childrenCount === 1
            ? childNames(detail.children)
            : `${detail.familyName} Family`}
        </h2>
        <Badge status={detail.status} />
        <p>
          {detail.childrenCount} children · {detail.missedSundays || 1} Sundays
          missed
        </p>
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
            <h3>Children Requiring Follow-Up</h3>
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
            <div className="contact">
              <h3>Primary Contact</h3>
              <b>{g ? `${g.firstName} ${g.lastName}` : "Not recorded"}</b>
              <small>{g?.relationship || "Guardian"}</small>
              <p>{g?.primaryPhone || "Phone unavailable"}</p>
              <div>
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
              </div>
            </div>
            <div className="record">
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
                <select
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
                </select>
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
            </div>
          </section>
        )}
        {tab === "history" && (
          <section>
            <h3>Follow-Up History</h3>
            {detail.history.length ? (
              detail.history.map((h) => (
                <article className="history" key={h.id}>
                  <b>{h.eventType.replaceAll("_", " ")}</b>
                  <small>
                    {date(h.createdAt)} · {h.staffName}
                  </small>
                  {h.reason && <p>Reason: {h.reason}</p>}
                  {h.notes && <p>{h.notes}</p>}
                </article>
              ))
            ) : (
              <p className="muted">No contact history recorded yet.</p>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}
const style = `.followup{max-width:1540px}.followup h1,.followup h2,.followup h3{font-family:var(--font-display),Georgia,serif}.followup header{margin:5px 0 17px}.followup h1{font-size:40px;margin:7px 0 4px}.followup header p:last-child{margin:0;color:#647088;font-size:17px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{min-height:104px;padding:15px 18px;border:1px solid #eee8e0;border-radius:10px;background:#fff0ed;display:grid;grid-template-columns:42px 1fr;align-content:center}.card i{grid-row:span 3;display:grid;place-items:center;width:36px;height:36px;background:#ffe0d5;color:#e9502d;border-radius:10px;font-style:normal}.card strong{font-size:29px}.card b{font-size:12px}.card small{font-size:10px;color:#63718a}.card.green{background:#effaf4}.card.green i{background:#dff6e8;color:#138754}.card.amber{background:#fff7e7}.card.amber i{background:#fff0ca;color:#cf7f10}.card.purple{background:#f3efff}.card.purple i{background:#e9deff;color:#6f3cd4}.tabs{display:flex;gap:24px;margin:22px 0 15px;border-bottom:1px solid #e7e1d9}.tabs button{height:38px;border:0;border-bottom:2px solid transparent;background:transparent;color:#5d6c86;font:800 12px var(--font-body)}.tabs .on{border-color:#ff5634;color:#172641}.tools{display:grid;grid-template-columns:minmax(250px,1fr) 160px 150px auto;gap:10px}.tools label{height:42px;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#71809a}.tools input{border:0;outline:0;width:100%;font:12px var(--font-body)}.tools :global(.app-dropdown-host),.tools :global(select){height:42px;width:100%}.tools :global(select){border:1px solid #dbe0e9;border-radius:8px;background:#fff;padding:0 9px;font:700 11px var(--font-body)}.more{height:42px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;font:800 11px var(--font-body)}.count{font-weight:800;font-size:13px;color:#34435d}.table{overflow:auto;border:1px solid #ebe5de;border-radius:10px;background:#fff}.table table{width:100%;min-width:900px;border-collapse:collapse}.table th{padding:12px;text-align:left;background:#faf9f6;color:#707b91;font-size:9px}.table td{padding:10px 12px;border-top:1px solid #eee8e1;font-size:11px;color:#41506a}.table tr{cursor:pointer}.table tbody tr:hover td{background:#fffaf7}.table td b,.table td small{display:block}.table td small{margin-top:3px;color:#71809a;font-size:10px}.table em,.badge{display:inline-block;padding:6px 8px;border-radius:7px;font-style:normal;font-size:9px;font-weight:800}.table em,.badge.NEEDS_FOLLOW_UP{background:#fff0ef;color:#e33e2d}.badge.CONTACTED{background:#eaf8ef;color:#087a4b}.badge.COULDNT_REACH{background:#fff2dd;color:#b86a00}.empty{text-align:center;padding:30px!important}.backdrop{position:fixed;z-index:90;inset:0;background:#0717301c}.backdrop aside{position:absolute;right:0;top:0;width:min(100%,430px);height:100%;overflow:auto;background:#fffdfa;box-shadow:-14px 0 35px #0717301c;padding:28px;box-sizing:border-box}.close{position:absolute;right:15px;top:15px;border:0;background:transparent;font-size:20px}.backdrop h2{font-size:25px;margin:16px 0 8px}.backdrop>aside>p{margin:10px 0;color:#62718a;font-size:12px}.backdrop nav{display:flex;margin:20px -28px 0;padding:0 20px;border-bottom:1px solid #ebe5de}.backdrop nav button{height:42px;flex:1;border:0;border-bottom:2px solid transparent;background:transparent;font:700 11px var(--font-body)}.backdrop nav .on{border-color:#ff5634;color:#e14b2e}.backdrop section{padding-top:18px}.backdrop h3{font-size:18px;margin:0 0 12px}.child,.history{display:grid;gap:4px;padding:12px;margin:8px 0;border:1px solid #ebe5de;border-radius:8px}.child b,.history b{font-size:12px}.child small,.history small,.history p,.muted{margin:0;color:#687993;font-size:10px}.contact,.record{padding:14px;margin-bottom:14px;border:1px solid #ebe5de;border-radius:9px}.contact>b,.contact small{display:block}.contact small{color:#687993;font-size:10px}.contact p{font-size:12px}.contact div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.contact a,.save{height:38px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:7px;text-decoration:none;font:800 10px var(--font-body)}.contact a:first-child,.save{background:#078c55;color:#fff}.contact a:last-child{border:1px solid #dbe0e9;color:#087a4b}.record label{display:grid;gap:5px;margin:10px 0;font-size:10px;font-weight:700}.record label:has(input[type=radio]){display:flex;align-items:center}.record select,.record input:not([type=radio]),.record textarea{min-height:36px;border:1px solid #dbe0e9;border-radius:7px;padding:7px;font:11px var(--font-body)}.record textarea{min-height:65px}.save{width:100%;border:0;background:#ff5a34;margin-top:5px}@media(max-width:1000px){.cards{grid-template-columns:repeat(2,1fr)}.tools{grid-template-columns:1fr 1fr}.tools label{grid-column:1/-1}}@media(max-width:600px){.followup h1{font-size:34px}.cards,.tools{grid-template-columns:1fr}.tabs{gap:5px;overflow:auto}.tabs button{white-space:nowrap}.backdrop aside{top:auto;bottom:0;width:100%;height:90%;border-radius:18px 18px 0 0}}`;

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

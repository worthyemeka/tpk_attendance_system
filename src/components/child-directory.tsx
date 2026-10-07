"use client";

import { AppSelect } from "@/components/app-dropdown";
import { printDownloaderFooter } from "@/lib/branded-print";
import { DirectoryPagination } from "./directory-pagination";
import Link from "next/link";
import {useProfileDialog} from "@/components/use-profile-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FiCalendar,
  FiBookOpen,
  FiUser,
  FiChevronDown,
  FiChevronRight,
  FiDownload,
  FiEdit3,
  FiHeart,
  FiPhone,
  FiSearch,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { StatCard, type StatCardTone } from "@/components/stat-card";
import { DataViewToggle, type DataView } from "@/components/data-view-toggle";
import { ChildrenGrid, ChildrenList } from "@/components/children-records";
import "./child-directory-refinement.css";
import { ClassBadge, GenderBadge, RecordBadge } from "./record-badge";

type Session = ReturnType<typeof readTeacherSession>;
type Child = {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  schoolGrade?: string;
  classId?: number;
  className?: string;
  active: boolean;
  age?: number;
  guardianId?: number;
  guardianName?: string;
  guardianPhone?: string;
  lastAttended?: string;
  joinedAt?: string;
};
type Guardian = {
  id: number;
  firstName: string;
  lastName: string;
  primaryPhone?: string;
  relationship?: string;
  primary?: boolean;
  authorisedPickup?: boolean;
};
type Detail = Child & {
  guardians: Guardian[];
  careInformationAvailable?: boolean;
  authorisedPickups?: {
    id: number;
    firstName: string;
    lastName: string;
    phone?: string;
    relationship?: string;
  }[];
  attendanceHistory?: Attendance[];
};
type Attendance = {
  serviceDate: string;
  serviceName?: string;
  serviceType?: string;
  status: string;
  checkedInAt?: string;
};
type AttendanceSummary = {
  sundaysPresent: number;
  sundaysMissed: number;
  items: Attendance[];
};
type Summary = {
  registeredChildren: number;
  active: number;
  presentThisSunday?: number;
  male?: number;
  female?: number;
  currentSundayDate?: string;
};
type ClassItem = { id: number; name: string };
type AttendanceReportChild = {
  id: number;
  firstName: string;
  lastName: string;
  className: string;
  guardianName: string;
  status: "PRESENT" | "ABSENT";
};
type AttendanceReportClass = {
  id: number | null;
  name: string;
  registered: number;
  present: number;
  absent: number;
  presentChildren: AttendanceReportChild[];
  absentChildren: AttendanceReportChild[];
};
type AttendanceReport = {
  serviceDate?: string | null;
  serviceSession?: { name?: string; serviceType?: string } | null;
  summary: { registered: number; present: number; absent: number };
  present: AttendanceReportChild[];
  absent: AttendanceReportChild[];
  classes: AttendanceReportClass[];
};

const initials = (first: string, last: string) =>
  `${first[0] || ""}${last[0] || ""}`.toUpperCase();
const pretty = (value?: string) =>
  value
    ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (x) => x.toUpperCase())
    : "—";
const date = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(
        new Date(
          value.length > 10 ? value.replace(" ", "T") : `${value}T12:00:00`,
        ),
      )
    : "Not yet attended";
const safe = (value?: string) =>
  value && value.trim() ? value : "Not recorded";
const reportValue = (value: unknown) =>
  String(value ?? "—").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] || character,
  );
const reportChildName = (child: AttendanceReportChild) =>
  `${child.firstName} ${child.lastName}`.trim();

function openChildrenAttendanceReport(report: AttendanceReport, target?: Window | null) {
  const reportWindow = target || window.open("", "_blank");
  if (!reportWindow) return false;
  const service = report.serviceSession?.name || "Sunday attendance";
  const dateLabel = report.serviceDate ? date(report.serviceDate) : "No completed Sunday recorded";
  const childTable = (children: AttendanceReportChild[]) =>
    children.length
      ? children
          .map(
            (child) =>
              `<tr><td>${reportValue(reportChildName(child))}</td><td>${reportValue(child.className)}</td><td>${reportValue(child.guardianName)}</td></tr>`,
          )
          .join("")
      : `<tr><td colspan="3" class="empty">No children in this section.</td></tr>`;
  const classTable = report.classes
    .map(
      (item) =>
        `<tr><td>${reportValue(item.name)}</td><td>${item.registered}</td><td>${item.present}</td><td>${item.absent}</td><td>${reportValue(item.presentChildren.map(reportChildName).join(" · ") || "—")}</td><td>${reportValue(item.absentChildren.map(reportChildName).join(" · ") || "—")}</td></tr>`,
    )
    .join("");
  reportWindow.document.write(
    `<!doctype html><html><head><title>TPK Children Attendance Report</title><style>body{font:13px Arial,sans-serif;color:#172b4d;padding:30px}h1{font-size:24px;margin:0 0 5px}h2{font-size:16px;margin:28px 0 10px;color:#e65331}p{color:#667793;margin:0 0 18px}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.summary div{border:1px solid #dfe5ec;border-radius:8px;padding:12px;background:#f8fafc}.summary b{display:block;font-size:20px;color:#152644}.summary span{font-size:11px;color:#687995}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{text-align:left;border:1px solid #dfe4eb;padding:8px;vertical-align:top}th{background:#f6f1ea;font-size:10px;text-transform:uppercase;letter-spacing:.04em}td{font-size:11px}.empty{text-align:center;color:#78869b;padding:18px}@media print{body{padding:0}.summary{break-inside:avoid}h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid;break-after:auto}}</style></head><body><h1>TPK Children Attendance Report</h1><p>${reportValue(service)} · ${reportValue(dateLabel)}</p><div class="summary"><div><b>${report.summary.registered}</b><span>Registered children</span></div><div><b>${report.summary.present}</b><span>Present</span></div><div><b>${report.summary.absent}</b><span>Absent</span></div></div><h2>Present children</h2><table><thead><tr><th>Child</th><th>Class</th><th>Guardian</th></tr></thead><tbody>${childTable(report.present)}</tbody></table><h2>Absent children</h2><table><thead><tr><th>Child</th><th>Class</th><th>Guardian</th></tr></thead><tbody>${childTable(report.absent)}</tbody></table><h2>Attendance by class</h2><table><thead><tr><th>Class</th><th>Registered</th><th>Present</th><th>Absent</th><th>Present children</th><th>Absent children</th></tr></thead><tbody>${classTable || `<tr><td colspan="6" class="empty">No classes found.</td></tr>`}</tbody></table></body></html>`,
  );
  reportWindow.document.close();
  const brandHeader=reportWindow.document.createElement("header");
  brandHeader.style.cssText="display:flex;align-items:center;gap:14px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #dfe4eb";
  brandHeader.innerHTML=`<img alt="Petra Christian Centre" src="${reportValue(window.location.origin)}/brand/petra-logo.jpg" width="48" height="48" style="object-fit:contain"/><img alt="TribePetra Kids" src="${reportValue(window.location.origin)}/brand/tpk-logo.png" width="54" height="54" style="object-fit:contain"/><strong style="font-size:11px;letter-spacing:.04em">TRIBEPETRA KIDS - MABUSHI (REGIONAL) CAMPUS</strong>`;
  reportWindow.document.body.prepend(brandHeader);
  reportWindow.document.body.insertAdjacentHTML("beforeend",printDownloaderFooter());
  reportWindow.focus();
  void Promise.all(Array.from(reportWindow.document.querySelectorAll("img"),image=>image.decode().catch(()=>{if(image.parentElement?.tagName==="SPAN")image.remove();}))).then(()=>{if(!reportWindow.closed)reportWindow.print();});
  return true;
}

export function ChildDirectory(props: {needsClassAssignment?:boolean}={}) {
  const[ready,setReady]=useState(false);
  useEffect(()=>{setReady(true);},[]);
  if(!ready)return <p role="status">Loading children…</p>;
  return <FullChildDirectory {...props}/>;
}
function FullChildDirectory({needsClassAssignment=false}: {needsClassAssignment?:boolean}={}) {
  const session = useMemo<Session>(() => readTeacherSession(), []);
  const searchParams = useSearchParams();
  const openedChildId = useRef<number | null>(null);
  const [rows, setRows] = useState<Child[]>([]),
    [classes, setClasses] = useState<ClassItem[]>([]),
    [summary, setSummary] = useState<Summary>({
      registeredChildren: 0,
      active: 0,
    });
  const [query, setQuery] = useState(""),
    [classId, setClassId] = useState(""),
    [gender, setGender] = useState(""),
    [sort, setSort] = useState("name"),
    [order, setOrder] = useState("asc"),
    [display, setDisplay] = useState<DataView>("LIST"),
    [exports, setExports] = useState(false);
  const [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Detail | null>(null),
    [tab, setTab] = useState<
      "overview" | "guardians" | "care" | "attendance" | "followup"
    >("overview"),
    [care, setCare] = useState<Record<string, unknown> | null>(null),
    [attendance, setAttendance] = useState<AttendanceSummary>({
      sundaysPresent: 0,
      sundaysMissed: 0,
      items: [],
    }),
    [followups, setFollowups] = useState<Record<string, unknown>[]>([]),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };
  useEffect(() => {
    const saved = window.localStorage.getItem("tpk:children-display");
    if (saved === "GRID" || saved === "LIST") setDisplay(saved);
    else if (window.matchMedia("(max-width: 1024px)").matches) setDisplay("GRID");
  }, []);
  const setChildDisplay = (value: DataView) => {
    setDisplay(value);
    setPage(1);
    window.localStorage.setItem("tpk:children-display", value);
  };
  const load = useCallback(async (signal?: AbortSignal) => {
    if (!session) return;
    setLoading(true);
    try {
      const p = new URLSearchParams({
        page: String(page),
        limit: String(display === "GRID" ? 12 : 25),
        sort,
        order,
      });
      if (query) p.set("search", query);
      if (classId) p.set("classId", classId);
      if (gender) p.set("gender", gender);
      if (needsClassAssignment) p.set("classAssignmentRequired", "1");
      const r = await fetch(`${apiBase}/api/v1/children?${p}`, {
          headers: authHeaders(session),
          signal,
        }),
        b = await r.json();
      if (signal?.aborted) return;
      if (!r.ok || !b.success)
        throw new Error(b.error?.message || "We could not load child records.");
      setRows(b.data || []);
      setTotal(Number(b.meta?.total || 0));
      setError("");
    } catch (e) {
      if (signal?.aborted) return;
      setError(
        e instanceof Error ? e.message : "We could not load child records.",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [classId, gender, order, page, query, session, sort, display, needsClassAssignment]);
  const loadSummary = useCallback(async () => {
    if (!session) return;
    try {
      const r = await fetch(`${apiBase}/api/v1/children/summary`, {
          headers: authHeaders(session),
        }),
        b = await r.json();
      if (b.success) setSummary(b.data);
    } catch {}
  }, [session]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 180 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, query]);
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);
  useEffect(() => {
    if (!session) return;
    void fetch(`${apiBase}/api/v1/classes`, { headers: authHeaders(session) })
      .then((r) => r.json())
      .then((b) => b.success && setClasses(b.data || []))
      .catch(() => undefined);
  }, [session]);
  const open = useCallback(
    async (id: number) => {
      if (!session) return;
      setError("");
      setSelected(null);
      setTab("overview");
      setCare(null);
      try {
        const r = await fetch(`${apiBase}/api/v1/children/${id}`, {
            headers: authHeaders(session),
          }),
          b = await r.json();
        if (!r.ok || !b.success)
          throw new Error(b.error?.message || "We could not load this child.");
        setSelected(b.data);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "We could not load this child.",
        );
      }
    },
    [session],
  );
  useEffect(() => {
    const id = Number(searchParams.get("childId"));
    if (id && openedChildId.current !== id) {
      openedChildId.current = id;
      void open(id);
    }
  }, [open, searchParams]);
  useEffect(() => {
    if (!session || !selected) return;
    if (tab === "care")
      Promise.all(
        ["care-profile", "emergency-profile"].map((path) =>
          fetch(`${apiBase}/api/v1/children/${selected.id}/${path}`, {
            headers: authHeaders(session),
          }).then((r) => r.json()),
        ),
      )
        .then(([careRes, emergencyRes]) =>
          setCare({
            ...((careRes.success && careRes.data) || {}),
            ...((emergencyRes.success && emergencyRes.data) || {}),
          }),
        )
        .catch(() => setCare(null));
    if (tab === "attendance")
      fetch(
        `${apiBase}/api/v1/children/${selected.id}/attendance?month=${month}`,
        { headers: authHeaders(session) },
      )
        .then((r) => r.json())
        .then((b) =>
          setAttendance(
            b.success
              ? b.data
              : { sundaysPresent: 0, sundaysMissed: 0, items: [] },
          ),
        )
        .catch(() =>
          setAttendance({ sundaysPresent: 0, sundaysMissed: 0, items: [] }),
        );
    if (tab === "followup")
      fetch(`${apiBase}/api/v1/children/${selected.id}/follow-ups`, {
        headers: authHeaders(session),
      })
        .then((r) => r.json())
        .then((b) => setFollowups(b.success ? b.data || [] : []))
        .catch(() => setFollowups([]));
  }, [month, selected, session, tab]);
  const exportCsv = () => {
    const lines = [
      "Child,Date of birth,Age,Gender,Class,Primary guardian,Guardian phone",
      ...rows.map((r) =>
        [
          `${r.firstName} ${r.lastName}`,
          r.dateOfBirth || "",
          r.age ?? "",
          pretty(r.gender),
          r.className || "",
          r.guardianName || "",
          r.guardianPhone || "",
        ]
          .map((v) => `\"${String(v).replaceAll('"', '""')}\"`)
          .join(","),
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "tpk-children.csv";
    a.click();
    URL.revokeObjectURL(url);
    setExports(false);
  };
  const exportAttendancePdf = async () => {
    setExports(false);
    if (!session || exporting) return;
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setError("Allow pop-ups for this site to print the attendance PDF.");
      return;
    }
    reportWindow.document.write("<!doctype html><title>Preparing attendance report…</title><p style=\"font:14px Arial;padding:24px\">Preparing attendance report…</p>");
    setExporting(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/children/attendance-report`, {
        headers: authHeaders(session),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(result.error?.message || "We could not prepare the attendance report.");
      openChildrenAttendanceReport(result.data as AttendanceReport, reportWindow);
    } catch (e) {
      reportWindow.close();
      setError(e instanceof Error ? e.message : "We could not prepare the attendance report.");
    } finally {
      setExporting(false);
    }
  };
  const perPage = display === "GRID" ? 12 : 25;
  const clear = () => {
    setQuery("");
    setClassId("");
    setGender("");
    setSort("name");
    setOrder("asc");
    setPage(1);
  };
  const toggleSort = (next: string) => {
    setOrder((current) =>
      sort === next ? (current === "asc" ? "desc" : "asc") : "asc",
    );
    setSort(next);
    setPage(1);
  };
  return (
    <>
      <section className="children-directory">
        <header className="child-header">
          <div>
            <p className="eyebrow">People</p>
            <h1>Children</h1>
            <p>Find a child, contact their guardian, or review their attendance.</p>
          </div>
          {session?.accessLevel === "TPK_SUPER_ADMIN" && <Link className="add-child" href="/account/children/register">
            <b>+</b>Register children
          </Link>}
        </header>
        <section className="child-summary">
          <Card
            icon={<FiUsers />}
            value={summary.registeredChildren}
            label="Registered Children"
            text="All child records"
            click={clear}
          />
          <Card
            icon={<FiUserCheck />}
            value={summary.presentThisSunday || 0}
            label="Present This Sunday"
            text={
              summary.currentSundayDate
                ? date(summary.currentSundayDate)
                : "No Sunday service recorded"
            }
            tone="green"
            click={clear}
          />
          <Card
            icon={<FiUsers />}
            value={summary.male || 0}
            label="Male"
            text="Registered boys"
            tone="blue"
            click={() => reset(() => setGender("MALE"))}
          />
          <Card
            icon={<FiUsers />}
            value={summary.female || 0}
            label="Female"
            text="Registered girls"
            tone="amber"
            click={() => reset(() => setGender("FEMALE"))}
          />
        </section>
        <section className="child-tools">
          <label className="child-search">
            <FiSearch />
            <input
              value={query}
              onChange={(e) => reset(() => setQuery(e.target.value))}
              aria-label="Search children"
              placeholder="Search by child, guardian or phone…"
            />
          </label>
          <span className="app-dropdown-host">
            <AppSelect
              aria-label="Filter children by class"
              value={classId}
              onChange={(e) => reset(() => setClassId(e.target.value))}
            >
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </AppSelect>
          </span>
          <span className="app-dropdown-host">
            <AppSelect
              aria-label="Filter children by gender"
              value={gender}
              onChange={(e) => reset(() => setGender(e.target.value))}
            >
              <option value="">All genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </AppSelect>
          </span>
          <div className="child-export">
            <button onClick={() => setExports((v) => !v)}>
              <FiDownload />
              Export
              <FiChevronDown />
            </button>
            {exports && (
              <div>
                <button onClick={() => void exportAttendancePdf()} disabled={exporting}>
                  {exporting ? "Preparing…" : "Attendance report (PDF)"}
                </button>
                <button onClick={exportCsv}>Children directory (CSV)</button>
              </div>
            )}
          </div>
        </section>
        <div className="directory-results-heading">
          <div><p className="children-count" role="status">{loading ? "Updating children…" : `${total} ${total === 1 ? "child" : "children"}`}</p><p className="directory-results-note">Open a profile to see family details and attendance.</p></div>
          <div className="directory-view-controls">
            {(query || classId || gender) && <button type="button" className="directory-clear" onClick={clear}>Clear filters</button>}
            <label className="directory-sort"><span>Sort by</span><AppSelect aria-label="Sort children" value={`${sort}:${order}`} onChange={(event) => { const [field, direction] = event.target.value.split(":"); setSort(field); setOrder(direction); setPage(1); }}>
              <option value="name:asc">Name: A–Z</option><option value="name:desc">Name: Z–A</option>
              <option value="age:asc">Age: youngest first</option><option value="age:desc">Age: oldest first</option>
              <option value="class:asc">Class: A–Z</option><option value="class:desc">Class: Z–A</option>
              <option value="gender:asc">Gender: A–Z</option><option value="gender:desc">Gender: Z–A</option>
              <option value="guardian:asc">Guardian: A–Z</option><option value="guardian:desc">Guardian: Z–A</option>
              <option value="lastAttended:desc">Last attended: newest</option><option value="lastAttended:asc">Last attended: oldest</option>
            </AppSelect></label>
            <DataViewToggle value={display} onChange={setChildDisplay} gridLabel="View children as cards" listLabel="View children as a list" />
          </div>
        </div>
        {error ? (
          <p className="child-error">{error}</p>
        ) : (
          <>
            {rows.length > 0 && (display === "LIST" ?
              <ChildrenList rowOffset={(page - 1) * perPage} rows={rows} onOpen={(id) => void open(id)} sort={sort} order={order} onSort={toggleSort} /> :
              <ChildrenGrid rows={rows} onOpen={(id) => void open(id)} />)}
            {!loading && !rows.length && <section className="directory-empty">
              <i><FiSearch /></i>
              <h2>{query || classId || gender ? "No matching children" : "No children registered yet"}</h2>
              <p>{query || classId || gender ? "Try another name, class or gender, or clear your filters to see everyone." : "Register your first child to start building the directory."}</p>
              {query || classId || gender ? <button type="button" onClick={clear}>Clear filters</button> : <Link href="/account/check-in/assisted">Register a child <FiChevronRight /></Link>}
            </section>}
            <DirectoryPagination page={page} total={total} pageSize={perPage} noun="children" loading={loading} onPageChange={setPage}/>
          </>
        )}
      </section>
      {selected && (
        <Drawer
          child={selected}
          tab={tab}
          setTab={setTab}
          close={() => setSelected(null)}
          care={care}
          attendance={attendance}
          followups={followups}
          month={month}
          setMonth={setMonth}
          classes={classes}
          refresh={async () => {
            await open(selected.id);
            void load();
            void loadSummary();
          }}
        />
      )}
      <style jsx>{`
        ${styles}${childEditStyles}
      `}</style>

    </>
  );
}

/** Mount the same child card without navigating away from its source page. */
export function ChildProfileDialog(props: {childId:number;close:()=>void;onUpdated?:()=>void;initialMonth?:string}) {
  const[ready,setReady]=useState(false);useEffect(()=>{setReady(true);},[]);
  if(!ready)return <p role="status">Loading child…</p>;
  return <FullChildProfileDialog {...props}/>;
}
function FullChildProfileDialog({childId,close,onUpdated,initialMonth}: {childId:number;close:()=>void;onUpdated?:()=>void;initialMonth?:string}) {
  const session=useMemo(()=>readTeacherSession(),[]);
  const [child,setChild]=useState<Detail|null>(null);
  const [tab,setTab]=useState<"overview"|"guardians"|"care"|"attendance"|"followup">("overview");
  const [care,setCare]=useState<Record<string,unknown>|null>(null);
  const [attendance,setAttendance]=useState<AttendanceSummary>({sundaysPresent:0,sundaysMissed:0,items:[]});
  const [followups,setFollowups]=useState<Record<string,unknown>[]>([]);
  const [classes,setClasses]=useState<ClassItem[]>([]);
  const [month,setMonth]=useState(initialMonth||new Date().toISOString().slice(0,7));
  const [error,setError]=useState("");
  const [tabLoading,setTabLoading]=useState(false);
  const [tabError,setTabError]=useState("");
  const [retry,setRetry]=useState(0);
  const [detailRetry,setDetailRetry]=useState(0);
  useProfileDialog(close,".child-profile-loading",!child);
  const loadChild=useCallback(async(signal?:AbortSignal)=>{
    if(!session)throw new Error("Please sign in again to view this child.");
    const response=await fetch(`${apiBase}/api/v1/children/${childId}`,{headers:authHeaders(session),signal});
    const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error?.message||"We could not load this child.");
    if(!signal?.aborted)setChild(body.data);
  },[childId,session]);
  useEffect(()=>{const controller=new AbortController();setChild(null);setError("");setTab("overview");void loadChild(controller.signal).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"We could not load this child.");});return()=>controller.abort();},[loadChild,retry]);
  useEffect(()=>{if(!session)return;const controller=new AbortController();void fetch(`${apiBase}/api/v1/classes`,{headers:authHeaders(session),signal:controller.signal}).then(response=>response.json()).then(body=>{if(body.success&&!controller.signal.aborted)setClasses(body.data||[]);}).catch(()=>undefined);return()=>controller.abort();},[session]);
  useEffect(()=>{
    setTabError("");setTabLoading(false);
    if(!session||!child||!["care","attendance","followup"].includes(tab))return;
    const controller=new AbortController();setTabLoading(true);setTabError("");
    const read=async(path:string)=>{const response=await fetch(`${apiBase}/api/v1/children/${childId}/${path}`,{headers:authHeaders(session),signal:controller.signal});const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error?.message||"These details could not load. Please try again.");return body.data;};
    const loadTab=async()=>{
      if(tab==="care"){const [profile,emergency]=await Promise.all([read("care-profile"),read("emergency-profile")]);if(!controller.signal.aborted)setCare({...profile,...emergency});}
      if(tab==="attendance"){const result=await read(`attendance?month=${month}`);if(!controller.signal.aborted)setAttendance(result);}
      if(tab==="followup"){const result=await read("follow-ups");if(!controller.signal.aborted)setFollowups(result||[]);}
    };
    void loadTab().catch(reason=>{if(!controller.signal.aborted)setTabError(reason instanceof Error?reason.message:"These details could not load.");}).finally(()=>{if(!controller.signal.aborted)setTabLoading(false);});
    return()=>controller.abort();
  },[childId,child,month,session,tab,detailRetry]);
  return <div className="classroom-child-profile-host">
    {child?<Drawer child={child} tab={tab} setTab={setTab} close={close} care={care} attendance={attendance} followups={followups} month={month} setMonth={setMonth} classes={classes} detailLoading={tabLoading} detailError={tabError} retryDetails={()=>setDetailRetry(value=>value+1)} refresh={async()=>{await loadChild();onUpdated?.();}}/>:<div className="child-drawer-backdrop profile-backdrop" onMouseDown={close}><aside className="child-drawer profile-panel child-profile-loading" role="dialog" aria-modal="true" aria-label="Child profile" onMouseDown={event=>event.stopPropagation()}><button className="close" type="button" aria-label="Close child profile" onClick={close}><FiX/></button><section><h2>Child profile</h2>{error?<><p role="alert">{error}</p><button type="button" onClick={()=>setRetry(value=>value+1)}>Try again</button></>:<p role="status">Loading child’s details…</p>}</section></aside></div>}
    <style jsx global>{`${styles.slice(styles.indexOf(".child-drawer-backdrop"),styles.indexOf("@media(max-width:1100px)"))}${childEditStyles}
      .classroom-child-profile-host .child-drawer{background:#fff;box-shadow:none;color:#203451}
      .classroom-child-profile-host .child-profile-loading section{padding-top:64px}
      .classroom-child-profile-host .child-drawer :is(h2,h3){font-family:var(--font-body),Arial,sans-serif}
      .classroom-child-profile-host .child-drawer .detail-state{margin:16px 24px;padding:16px;border:1px solid #e3e7ed;border-radius:12px;background:#fff;font-size:13px}
      .classroom-child-profile-host .child-drawer .detail-state button{margin-top:10px;min-height:40px}
      @media(max-width:650px){.classroom-child-profile-host .child-drawer{width:100%;top:0;bottom:0;height:100dvh;border-radius:0}.classroom-child-profile-host .child-drawer header{padding-left:20px;padding-right:48px}.classroom-child-profile-host .child-drawer .profile-facts{grid-template-columns:1fr}}
    `}</style>
  </div>;
}

function Card({
  icon,
  value,
  label,
  text,
  tone = "blue",
  click,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  text: string;
  tone?: StatCardTone | "amber";
  click: () => void;
}) {
  return <StatCard icon={icon} value={value} title={label} description={text} tone={tone === "amber" ? "yellow" : tone} onClick={click} />;
}
function Drawer({
  child,
  tab,
  setTab,
  close,
  care,
  attendance,
  followups,
  month,
  setMonth,
  classes,
  refresh,
  detailLoading=false,
  detailError="",
  retryDetails,
}: {
  child: Detail;
  tab: "overview" | "guardians" | "care" | "attendance" | "followup";
  setTab: (
    v: "overview" | "guardians" | "care" | "attendance" | "followup",
  ) => void;
  close: () => void;
  care: Record<string, unknown> | null;
  attendance: AttendanceSummary;
  followups: Record<string, unknown>[];
  month: string;
  setMonth: (v: string) => void;
  classes: ClassItem[];
  refresh: () => Promise<void>;
  detailLoading?:boolean;
  detailError?:string;
  retryDetails?:()=>void;
}) {
  useProfileDialog(close, ".child-drawer");
  const [editing, setEditing] = useState(false);
  const hasCare =
    care &&
    Object.entries(care).some(
      ([key, value]) =>
        !["child_id", "created_at", "updated_at"].includes(key) &&
        Boolean(value),
    );
  return (
    <div className="child-drawer-backdrop profile-backdrop" onMouseDown={close}>
      <aside className="child-drawer profile-panel" role="dialog" aria-modal="true" aria-label="Child profile" onMouseDown={(e) => e.stopPropagation()}>
        <button className="close" type="button" aria-label="Close child profile" onClick={close}>
          <FiX />
        </button>
        {editing ? (
          <ChildEditForm
            child={child}
            classes={classes}
            cancel={() => setEditing(false)}
            saved={async () => {
              await refresh();
              setEditing(false);
            }}
          />
        ) : (
          <>
            <header>
              <i>{initials(child.firstName, child.lastName)}</i>
              <div>
                <small className="profile-kicker">Child profile</small><h2>
                  {child.firstName} {child.lastName}
                </h2>
                <p>{child.age == null ? "Age not recorded" : `${child.age} ${child.age === 1 ? "year" : "years"} old`}</p>
                <div className="profile-identity-badges"><ClassBadge name={child.className} /><GenderBadge gender={child.gender} /></div>
              </div>
            </header>
            <nav>
              {(
                [
                  ["overview", "Overview"],
                  ["guardians", "Guardians"],
                  ["care", "Care"],
                  ["attendance", "Attendance"],
                  ["followup", "Follow-Up"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  className={tab === value ? "selected" : ""}
                  onClick={() => setTab(value)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {detailLoading&&<p className="detail-state" role="status">Loading details…</p>}
            {detailError&&!detailLoading&&<div className="detail-state" role="alert">{detailError}<br/><button type="button" onClick={retryDetails}>Try again</button></div>}
            {tab === "overview" && (
              <section>
                <h3>Personal Information</h3>
                <div className="profile-facts">
                <Info
                  icon={<FiCalendar />}
                  label="Date of Birth"
                  value={child.dateOfBirth ? date(child.dateOfBirth) : "Not recorded"}
                />
                <Info
                  label="Age"
                  value={child.age == null ? "Not recorded" : `${child.age} ${child.age === 1 ? "year" : "years"}`}
                />
                <Info label="Gender" value={pretty(child.gender)} />
                <Info label="Class" value={safe(child.className)} />
                <Info label="School Grade" value={safe(child.schoolGrade)} />
                </div>
              </section>
            )}
            {tab === "guardians" && (
              <section>
                <h3>Guardians</h3>
                {child.guardians.map((g) => (
                  <Link
                    className="drawer-row"
                    href={`/account/guardians?guardianId=${g.id}`}
                    key={g.id}
                  >
                    <i>{initials(g.firstName, g.lastName)}</i>
                    <span>
                      <b>
                        {g.firstName} {g.lastName}
                      </b>
                      <small>
                        {g.relationship || "Guardian"} ·{" "}
                        {g.primary ? "Primary Guardian" : "Additional Guardian"}
                      </small>
                      <small>
                        {g.primaryPhone || "Phone unavailable"} ·{" "}
                        {g.authorisedPickup
                          ? "Authorised Pickup"
                          : "Pickup not authorised"}
                      </small>
                    </span>
                    <FiChevronRight />
                  </Link>
                ))}
                {!child.guardians.length && (
                  <p className="muted">
                    No guardian relationship has been recorded.
                  </p>
                )}
              </section>
            )}
            {tab === "care" && !detailLoading && !detailError && (
              <section>
                <h3>Care Information</h3>
                {hasCare ? (
                  <div className="care-list">
                    {Object.entries(care || {})
                      .filter(
                        ([key, value]) =>
                          !["child_id", "created_at", "updated_at"].includes(
                            key,
                          ) && Boolean(value),
                      )
                      .map(([key, value]) => (
                        <Info
                          key={key}
                          icon={<FiHeart />}
                          label={pretty(key)}
                          value={String(value)}
                        />
                      ))}
                  </div>
                ) : (
                  <p className="empty-state">No care information recorded.</p>
                )}
              </section>
            )}
            {tab === "attendance" && !detailLoading && !detailError && (
              <section>
                <div className="tab-heading">
                  <h3>Attendance</h3>
                  <input
                    aria-label="Attendance month"
                    type="month"
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  />
                </div>
                <div className="attendance-summary">
                  <b>
                    {attendance.sundaysPresent}
                    <small>Sundays Present</small>
                  </b>
                  <b>
                    {attendance.sundaysMissed}
                    <small>Sundays Absent</small>
                  </b>
                </div>
                {attendance.items.length ? (
                  <div className="attendance-list">
                    {attendance.items.map((item, index) => (
                      <p key={`${item.serviceDate}${index}`}>
                        <span>
                          <b>{date(item.serviceDate)}</b>
                          <small>
                            {item.serviceName || pretty(item.serviceType)}
                          </small>
                        </span>
                        <RecordBadge tone={item.status === "ABSENT" ? "amber" : "green"} dot>{pretty(item.status)}</RecordBadge>
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="empty-state">
                    No attendance records for this month.
                  </p>
                )}
              </section>
            )}
            {tab === "followup" && !detailLoading && !detailError && (
              <section>
                <h3>Follow-Up</h3>
                {followups.length ? (
                  followups.map((item) => (
                    <article className="followup" key={String(item.id)}>
                      <b>{pretty(String(item.taskType || "Follow-up"))}</b>
                      <div className="profile-followup-meta"><RecordBadge tone={["CLOSED", "COMPLETED", "RESOLVED"].includes(String(item.status)) ? "green" : "amber"} dot>{pretty(String(item.status || "OPEN"))}</RecordBadge><small>{String(item.assignedTeacher || "Unassigned")}</small></div>
                      {item.notes ? <p>{String(item.notes)}</p> : null}
                    </article>
                  ))
                ) : (
                  <p className="empty-state">
                    <b>No follow-up required</b>This child currently has no
                    outstanding attendance follow-ups.
                  </p>
                )}
              </section>
            )}
            <footer>
              {readTeacherSession()?.accessLevel === "TPK_SUPER_ADMIN" && <button onClick={() => setEditing(true)}>
                <FiEdit3 />
                Edit Child
              </button>}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}
function ChildEditForm({
  child,
  classes,
  cancel,
  saved,
}: {
  child: Detail;
  classes: ClassItem[];
  cancel: () => void;
  saved: () => Promise<void>;
}) {
  const session = useMemo(() => readTeacherSession(), []);
  const [firstName, setFirstName] = useState(child.firstName),
    [lastName, setLastName] = useState(child.lastName),
    [dateOfBirth, setDateOfBirth] = useState(
      child.dateOfBirth?.slice(0, 10) || "",
    ),
    [gender, setGender] = useState(child.gender || ""),
    [classId, setClassId] = useState(
      child.classId ? String(child.classId) : "",
    ),
    [schoolGrade, setSchoolGrade] = useState(child.schoolGrade || ""),
    [careInformation, setCareInformation] = useState(""),
    [careLoaded, setCareLoaded] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (!session) return;
    fetch(apiBase + "/api/v1/children/" + child.id + "/care-profile", {
      headers: authHeaders(session),
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error("Care information could not be loaded. Please close and reopen this record before editing.");
        setCareInformation(body.data?.other_relevant_care_information || "");
        setCareLoaded(true);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Care information could not be loaded."));
  }, [child.id, session]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !session ||
      !firstName.trim() ||
      !lastName.trim() ||
      !dateOfBirth ||
      !gender
      || !careLoaded
    ) {
      setError(
        "Add the child’s name, date of birth, and gender before saving.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const headers = {
        ...authHeaders(session),
        "Content-Type": "application/json",
      };
      const childResponse = await fetch(
        apiBase + "/api/v1/children/" + child.id,
        {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dateOfBirth,
            gender,
            classId: classId ? Number(classId) : null,
            schoolGrade: schoolGrade.trim() || null,
            classAssignmentRequired: !classId,
            careInformation: careInformation.trim() || null,
          }),
        },
      );
      const childBody = await childResponse.json();
      if (!childResponse.ok || !childBody.success)
        throw new Error(
          childBody.error?.message || "The child’s details could not be saved.",
        );
      await saved();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The child’s details could not be saved.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <form className="child-edit-form" onSubmit={submit}>
      <header>
        <p className="eyebrow">Edit Child</p>
        <h2>
          {child.firstName} {child.lastName}
        </h2>
        <span>
          Update the same child details collected during registration.
        </span>
      </header>
      <section>
        <label>
          Child’s First Name *
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
          />
        </label>
        <label>
          Child’s Last Name *
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
          />
        </label>
        <label>
          Date of Birth *
          <input
            type="date"
            value={dateOfBirth}
            onChange={(event) => setDateOfBirth(event.target.value)}
          />
        </label>
        <fieldset>
          <legend>Gender *</legend>
          <button
            className={gender === "MALE" ? "selected" : ""}
            onClick={() => setGender("MALE")}
            type="button"
          >
            Male
          </button>
          <button
            className={gender === "FEMALE" ? "selected" : ""}
            onClick={() => setGender("FEMALE")}
            type="button"
          >
            Female
          </button>
        </fieldset>
        <label>
          Class
          <AppSelect
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">Class assignment required</option>
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </AppSelect>
        </label>
        <label>
          School Grade
          <input
            value={schoolGrade}
            onChange={(event) => setSchoolGrade(event.target.value)}
            placeholder="e.g. Primary 1"
          />
        </label>
        <label className="full">
          Anything we should know?
          <textarea
            value={careInformation}
            onChange={(event) => setCareInformation(event.target.value)}
            placeholder="Important care information — allergies, medical needs or accessibility needs (optional)"
            rows={4}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
      </section>
      <footer>
        <button type="button" onClick={cancel}>
          Cancel
        </button>
        <button className="save" disabled={saving || !careLoaded} type="submit">
          {saving ? "Saving…" : !careLoaded ? "Loading care information…" : "Save Changes"}
        </button>
      </footer>
    </form>
  );
}
function Info({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="info profile-fact">
      <i aria-hidden="true">{icon || (label === "School Grade" ? <FiBookOpen /> : label === "Class" ? <FiUsers /> : <FiUser />)}</i>
      <div className="profile-fact-content"><small>{label}</small><b>{label === "Class" ? <ClassBadge name={value === "—" || value === "Not recorded" ? null : value} /> : value || "—"}</b></div>
    </div>
  );
}

const childEditStyles = `.absent{background:#fff0ed;color:#c7462b}.visit-first{background:#fff2dd;color:#ad6500}.visit-returning{background:#edf3ff;color:#2364ad}.visit-header{background:#edf3ff!important;color:#2364ad!important}.attendance-list em.absence{background:#fff0ed;color:#c7462b}.child-edit-form{min-height:100%;display:flex;flex-direction:column}.child-edit-form header{display:block;padding:38px 26px 18px}.child-edit-form header .eyebrow{margin:0 0 7px;color:#ff5735;font:800 10px var(--font-body);letter-spacing:.12em;text-transform:uppercase}.child-edit-form header h2{margin:0;font-size:27px}.child-edit-form header span{display:block;margin-top:6px;color:#687993;font-size:11px}.child-edit-form section{display:grid;grid-template-columns:1fr 1fr;gap:13px;padding:20px 26px}.child-edit-form label{display:grid;gap:6px;color:#31415b;font-size:11px;font-weight:800}.child-edit-form input,.child-edit-form select,.child-edit-form textarea{box-sizing:border-box;width:100%;min-height:40px;border:1px solid #dbe0e9;border-radius:8px;padding:9px 10px;background:#fff;color:#172b4a;font:12px var(--font-body)}.child-edit-form textarea{resize:vertical}.child-edit-form fieldset{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0;border:0;padding:0}.child-edit-form legend{grid-column:1/-1;margin-bottom:1px;color:#31415b;font-size:11px;font-weight:800}.child-edit-form fieldset button{height:40px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#263750;font:800 11px var(--font-body);cursor:pointer}.child-edit-form fieldset button.selected{border-color:#ff5a34;background:#fff0eb;color:#e24d2c}.child-edit-form .full,.child-edit-form .form-error{grid-column:1/-1}.child-edit-form .form-error{margin:0;padding:10px;border-radius:8px;background:#fff0ed;color:#b83f24;font-size:11px}.child-edit-form footer{margin-top:auto}.child-edit-form footer .save{flex:1;background:#ff5a34;border-color:#ff5a34;color:#fff}.child-edit-form footer button:first-child{flex:1}@media(max-width:650px){.child-edit-form section{grid-template-columns:1fr}.child-edit-form .full,.child-edit-form .form-error{grid-column:auto}}`;

const styles = `.children-directory{max-width:1540px}.children-directory h1,.children-directory h2,.children-directory h3{font-family:var(--font-display),Georgia,serif}.child-header{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;margin:4px 0 18px}.child-header h1{margin:7px 0 4px;font-size:40px;letter-spacing:-1.2px}.child-header p:last-child{margin:0;color:#647088;font-size:17px}.add-child{display:flex;align-items:center;gap:9px;height:44px;padding:0 15px;border-radius:8px;background:#ff5a34;color:white;text-decoration:none;font:800 12px var(--font-body)}.add-child b{font-size:20px}.child-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:22px}.child-card{min-height:120px;padding:16px 20px;border:1px solid #eee8e0;border-radius:10px;background:linear-gradient(135deg,#eff6ff,#fff)}.child-card button{all:unset;display:grid;gap:4px;cursor:pointer;width:100%}.child-card i{display:grid;place-items:center;width:37px;height:37px;border-radius:11px;background:#e0f0ff;color:#187ad0;font-size:20px;font-style:normal}.child-card strong{font:800 30px/1 var(--font-body)}.child-card b{font-size:13px}.child-card small{font-size:11px;color:#64718a}.child-card.green{background:linear-gradient(135deg,#effaf4,#fff)}.child-card.green i{background:#dff6e8;color:#148b54}.child-card.amber{background:linear-gradient(135deg,#fff7e6,#fff)}.child-card.amber i{background:#fff0cd;color:#d98108}.child-card.red{background:linear-gradient(135deg,#fff0ed,#fff)}.child-card.red i{background:#fee0d7;color:#e5502b}.child-tools{display:grid;grid-template-columns:minmax(260px,1.7fr) 130px 130px 130px auto auto;gap:11px;align-items:start}.child-search{height:44px;display:flex;align-items:center;gap:9px;padding:0 13px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#71809a}.child-search input{min-width:0;width:100%;border:0;outline:0;background:transparent;font:600 12px var(--font-body)}.child-tools :global(.app-dropdown-host){height:44px}.child-tools :global(select){height:100%;width:100%;padding:0 10px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#26354d;font:800 11px var(--font-body)}.child-more,.child-export{position:relative}.child-more>button,.child-export>button{height:44px;display:flex;align-items:center;gap:8px;padding:0 13px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#26354d;font:800 11px var(--font-body);white-space:nowrap;cursor:pointer}.child-more>div,.child-export>div{position:absolute;z-index:30;right:0;top:50px;width:225px;display:grid;gap:9px;padding:11px;border:1px solid #dbe0e9;border-radius:10px;background:#fffdfa;box-shadow:0 14px 28px #11213b18}.child-more>div label{display:grid;grid-template-columns:auto 1fr 1fr;gap:6px;align-items:center;color:#56647b;font:700 10px var(--font-body)}.child-more>div input{height:34px;width:100%;box-sizing:border-box;border:1px solid #dbe0e9;border-radius:6px;padding:0 7px;font:11px var(--font-body)}.child-export>div{width:105px;padding:5px}.child-export>div button{height:35px;border:0;background:transparent;text-align:left;font:700 11px var(--font-body)}.children-count{margin:19px 0 10px;color:#34435d;font-size:13px;font-weight:800}.child-error{padding:12px;border:1px solid #ffd6cb;border-radius:8px;color:#b33c22;background:#fff2ee}.children-table{overflow:auto;border:1px solid #ebe5de;border-radius:10px;background:#fff}.children-table table{width:100%;min-width:1000px;border-collapse:collapse}.children-table th{padding:12px;text-align:left;background:#faf9f6;color:#707b91;font-size:9px}.children-table td{padding:10px 12px;border-top:1px solid #eee8e1;color:#41506a;font-size:12px}.children-table tr{cursor:pointer}.children-table tbody tr:hover td{background:#fffaf7}.child-person{display:flex;align-items:center;gap:9px;color:#14223b;white-space:nowrap}.child-person i,.child-drawer header>i,.drawer-row i{display:grid;place-items:center;border-radius:50%;background:#e7efff;color:#225fa6;font-size:10px;font-style:normal;font-weight:900}.child-person i{width:33px;height:33px}.guardian-cell{display:grid;gap:3px;color:#243653;text-decoration:none}.guardian-cell b{font-size:11px}.guardian-cell small{font-size:10px;color:#71809a}.chip{display:inline-flex;align-items:center;gap:5px;border-radius:7px;padding:7px 9px;font-size:10px;font-weight:800;white-space:nowrap}.complete{background:#eaf8ef;color:#087a4b}.needs{background:#fff2dd;color:#b86a00}.neutral{background:#f0f2f5;color:#637089}.children-table td:last-child button{border:0;background:transparent;color:#526884;font-size:18px}.empty{text-align:center;padding:34px!important}.empty b,.empty small{display:block}.empty small{margin-top:5px;color:#71809a}.child-pagination{display:flex;align-items:center;justify-content:space-between;margin-top:14px;color:#64728b;font-size:11px}.child-pagination p{margin:0}.child-pagination div{display:flex;gap:5px}.child-pagination button{width:32px;height:32px;border:0;border-radius:7px;background:transparent;font-weight:800}.child-pagination .current{background:#fff0eb;color:#e54a2a}.child-drawer-backdrop{position:fixed;z-index:85;inset:0;background:#0717301c}.child-drawer{position:absolute;right:0;top:0;width:min(100%,440px);height:100%;overflow:auto;background:#fffdfa;box-shadow:-14px 0 35px #0717301c}.child-drawer .close{position:absolute;right:16px;top:17px;border:0;background:transparent;font-size:19px}.child-drawer header{display:flex;align-items:center;gap:12px;padding:36px 26px 20px;border-bottom:1px solid #ece7e0}.child-drawer header>i{width:58px;height:58px;font-size:18px}.child-drawer h2{margin:0;font-size:25px}.child-drawer header p{margin:4px 0;color:#61718b;font-size:12px}.child-drawer header>b{margin-left:auto;border-radius:99px;padding:6px 8px;font-size:9px}.child-drawer nav{display:flex;overflow:auto;border-bottom:1px solid #ece7e0;padding:0 12px}.child-drawer nav button{height:49px;flex:1;min-width:max-content;padding:0 9px;border:0;border-bottom:2px solid transparent;background:transparent;color:#61718b;font:700 10px var(--font-body)}.child-drawer nav .selected{border-color:#ff5634;color:#15243c}.child-drawer section{padding:22px 26px}.child-drawer h3{margin:0 0 14px;font-size:18px}.info{display:grid;grid-template-columns:18px 1fr;gap:10px;margin:13px 0;color:#25354f}.info>span{display:grid;gap:3px}.info small,.muted{color:#71809a;font-size:11px}.info b{font-size:12px}.child-drawer hr{border:0;border-top:1px solid #eee8e0;margin:20px 0}.drawer-note,.empty-state{display:grid;gap:4px;margin-top:12px;padding:12px;border-radius:8px;background:#fff6ec;color:#8a5a20;font-size:11px}.drawer-row{display:flex;align-items:center;gap:10px;margin:9px 0;padding:12px;border:1px solid #ebe5de;border-radius:9px;background:#fff;color:#20314d;text-decoration:none}.drawer-row i{width:36px;height:36px}.drawer-row span{display:grid;gap:3px;flex:1}.drawer-row b{font-size:12px}.drawer-row small{font-size:10px;color:#687993}.tab-heading{display:flex;align-items:center;justify-content:space-between}.tab-heading input{height:34px;border:1px solid #dbe0e9;border-radius:7px;padding:0 8px;font:10px var(--font-body)}.attendance-summary{display:grid;grid-template-columns:1fr 1fr;gap:9px}.attendance-summary b{display:grid;gap:3px;padding:10px;border-radius:8px;background:#f6f7f9;font-size:19px}.attendance-summary small{font-size:9px;color:#66748b}.attendance-list p{display:flex;justify-content:space-between;align-items:center;padding:11px 0;margin:0;border-bottom:1px solid #eee8e0}.attendance-list span{display:grid;gap:3px}.attendance-list b{font-size:11px}.attendance-list small{font-size:10px;color:#71809a}.attendance-list em{padding:6px 7px;border-radius:7px;background:#eaf8ef;color:#087a4b;font-size:9px;font-style:normal;font-weight:800}.followup{display:grid;gap:4px;margin:9px 0;padding:12px;border:1px solid #ebe5de;border-radius:8px}.followup b{font-size:12px}.followup small,.followup p{margin:0;font-size:10px;color:#687993}.child-drawer footer{display:flex;gap:10px;padding:18px 26px;border-top:1px solid #ece7e0}.child-drawer footer button{height:42px;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#20314d;font:800 11px var(--font-body)}.child-drawer footer button:first-child{flex:1}@media(max-width:1100px){.child-tools{grid-template-columns:1fr 1fr 1fr}.child-search{grid-column:1/-1}.child-summary{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.child-header{display:grid}.add-child{justify-content:center}.child-header h1{font-size:35px}.child-summary,.child-tools{grid-template-columns:1fr}.child-tools :global(.app-dropdown-host){width:100%}.child-more>button,.child-export>button{width:100%;justify-content:center}.child-more>div,.child-export>div{left:0;right:auto}.child-pagination{align-items:flex-start;gap:12px;flex-direction:column}.child-drawer{top:auto;bottom:0;width:100%;height:min(92vh,760px);border-radius:18px 18px 0 0}}`;

"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiDownload,
  FiFileText,
  FiFolder,
  FiInfo,
  FiSearch,
  FiUpload,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { printBrandedDocument } from "@/lib/branded-print";
import { MonthPicker } from "@/components/month-picker";

type Summary = {
  childrenAttended: number;
  firstTimeVisits: number;
  followUps: number;
  safePickupRate: number;
  firstServiceAttendance: number;
  secondServiceAttendance: number;
  averageSundayAttendance: number;
  sundays: number;
  newRegistrations: number;
  activeChildren: number;
  completeProfiles: number;
  familiesNeedFollowUp: number;
  familiesContacted: number;
  couldntReach: number;
  resolved: number;
  escalated: number;
  checkedIn: number;
  completedPickups: number;
};
type Report = {
  year: number;
  month: number;
  monthLabel: string;
  status: "IN_PROGRESS" | "COMPLETE";
  summary: Summary;
  attendanceBySunday: {
    serviceDate: string;
    firstService: number;
    secondService: number;
    total: number;
  }[];
  attendanceByClass: { className: string; attendance: number }[];
};
type Archive = {
  id: number;
  recordName: string;
  recordType: string;
  periodType: string;
  periodStart?: string;
  periodEnd?: string;
  description?: string;
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: string;
};

const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "—";
const fileSize = (value: number) =>
  value < 1024 * 1024
    ? `${Math.max(1, Math.round(value / 1024))} KB`
    : `${(value / 1024 / 1024).toFixed(1)} MB`;
const typeLabel = (value: string) =>
  ({
    ATTENDANCE: "Attendance",
    CHILDREN_RECORDS: "Children Records",
    REGISTRATION_RECORDS: "Registration Records",
    FOLLOW_UP_RECORDS: "Follow-Up Records",
    TEAM_ROSTER: "Team / Roster",
    OTHER: "Other",
  })[value] || value;

export function ReportsWorkspace() {
  const session = useMemo(() => readTeacherSession(), []);
  const now = useMemo(() => new Date(), []);
  const [tab, setTab] = useState<"reports" | "archive">("reports");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<Report | null>(null);
  const [archive, setArchive] = useState<Archive[]>([]);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveYear, setArchiveYear] = useState("");
  const [archiveType, setArchiveType] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [drawerTab, setDrawerTab] = useState<
    "overview" | "attendance" | "children" | "followup" | "pickup"
  >("overview");
  const [uploading, setUploading] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    if (!session) return;
    try {
      const response = await fetch(
        `${apiBase}/api/v1/reports/monthly?year=${year}&month=${month}`,
        { headers: authHeaders(session) },
      );
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(
          body.error?.message || "We could not load the monthly report.",
        );
      setReport(body.data.selected);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We could not load the monthly report.",
      );
    }
  }, [month, session, year]);
  const loadArchive = useCallback(async () => {
    if (!session) return;
    try {
      const params = new URLSearchParams({ limit: "25" });
      if (archiveSearch) params.set("search", archiveSearch);
      if (archiveYear) params.set("year", archiveYear);
      if (archiveType) params.set("type", archiveType);
      const response = await fetch(
        `${apiBase}/api/v1/archive-records?${params}`,
        { headers: authHeaders(session) },
      );
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(
          body.error?.message || "The archive is not available yet.",
        );
      setArchive(body.data || []);
      setArchiveTotal(body.meta?.total || 0);
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The archive is not available yet.",
      );
    }
  }, [archiveSearch, archiveType, archiveYear, session]);
  useEffect(() => {
    void loadReports();
  }, [loadReports]);
  useEffect(() => {
    if (tab === "archive") void loadArchive();
  }, [loadArchive, tab]);

  const setSelectedMonth = (next: Date) => {
    setYear(next.getUTCFullYear());
    setMonth(next.getUTCMonth() + 1);
  };
  const downloadCsv = () => {
    if (!report) return;
    const rows = [
      ["Month", report.monthLabel],
      ["Children attended", report.summary.childrenAttended],
      ["First-time visits", report.summary.firstTimeVisits],
      ["Families contacted", report.summary.followUps],
      ["Safe pickups", `${report.summary.safePickupRate}%`],
      ["First service attendance", report.summary.firstServiceAttendance],
      ["Second service attendance", report.summary.secondServiceAttendance],
      ["Average Sunday attendance", report.summary.averageSundayAttendance],
      ["New registrations", report.summary.newRegistrations],
      ["Active children", report.summary.activeChildren],
      ["Complete profiles", report.summary.completeProfiles],
      ["Families needing follow-up", report.summary.familiesNeedFollowUp],
      ["Could not reach", report.summary.couldntReach],
      ["Resolved follow-ups", report.summary.resolved],
      ["Escalated to leadership", report.summary.escalated],
      ["Completed pickups", report.summary.completedPickups],
      [],
      ["Sunday", "First Service", "Second Service", "Total"],
      ...report.attendanceBySunday.map((row) => [
        formatDate(row.serviceDate),
        row.firstService,
        row.secondService,
        row.total,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.map((row) => row.join(",")).join("\n")], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `tpk-${report.monthLabel.toLowerCase().replaceAll(" ", "-")}-report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const downloadPdf = () => {
    if (!report) return;
    const s = report.summary;
    printBrandedDocument({
      eyebrow: "Monthly ministry report",
      title: report.monthLabel,
      subtitle:
        "A detailed summary of attendance, families, follow-up and safe pickup records.",
      stats: [
        {
          label: "Children attended",
          value: s.childrenAttended,
          note: `${s.sundays} Sunday${s.sundays === 1 ? "" : "s"}`,
        },
        { label: "First-time visits", value: s.firstTimeVisits },
        { label: "Families contacted", value: s.familiesContacted },
        { label: "Safe pickups", value: `${s.safePickupRate}%` },
      ],
      columns: ["Sunday", "First Service", "Second Service", "Total"],
      rows: report.attendanceBySunday.map((row) => [
        formatDate(row.serviceDate),
        row.firstService,
        row.secondService,
        row.total,
      ]),
      sections: [
        {
          title: "Children and attendance",
          rows: [
            {
              label: "Average Sunday attendance",
              value: s.averageSundayAttendance,
            },
            { label: "New registrations", value: s.newRegistrations },
            { label: "Active children", value: s.activeChildren },
            { label: "Complete child profiles", value: s.completeProfiles },
          ],
        },
        {
          title: "Follow-up and pickups",
          rows: [
            {
              label: "Families needing follow-up",
              value: s.familiesNeedFollowUp,
            },
            { label: "Couldn't reach", value: s.couldntReach },
            { label: "Resolved", value: s.resolved },
            { label: "Completed pickups", value: s.completedPickups },
          ],
        },
        {
          title: "Attendance by class",
          rows: report.attendanceByClass.map((row) => ({
            label: row.className,
            value: row.attendance,
          })),
        },
      ],
    });
  };
  const downloadArchive = async (record: Archive) => {
    if (!session) return;
    try {
      const response = await fetch(
        `${apiBase}/api/v1/archive-records/${record.id}/download`,
        { headers: authHeaders(session) },
      );
      if (!response.ok) throw new Error("The original file is not available.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = record.originalFilename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The original file is not available.",
      );
    }
  };

  return (
    <section className="reports-workspace">
      <header>
        <p className="eyebrow">Petra Wuse</p>
        <h1>Reports</h1>
        <p>
          Review ministry records, download monthly reports and access
          historical files.
        </p>
      </header>
      <nav className="report-tabs">
        <button
          className={tab === "reports" ? "selected" : ""}
          onClick={() => setTab("reports")}
        >
          Reports
        </button>
        <button
          className={tab === "archive" ? "selected" : ""}
          onClick={() => setTab("archive")}
        >
          Archive
        </button>
      </nav>
      {tab === "reports" ? (
        <ReportsView
          report={report}
          year={year}
          month={month}
          setSelectedMonth={setSelectedMonth}
          openDrawer={() => {
            setDrawerTab("overview");
            setDrawer(true);
          }}
          downloadCsv={downloadCsv}
          downloadPdf={downloadPdf}
        />
      ) : (
        <ArchiveView
          records={archive}
          total={archiveTotal}
          search={archiveSearch}
          setSearch={setArchiveSearch}
          year={archiveYear}
          setYear={setArchiveYear}
          type={archiveType}
          setType={setArchiveType}
          upload={() => setUploadOpen(true)}
          download={downloadArchive}
        />
      )}{" "}
      {error && <p className="reports-error">{error}</p>}
      {drawer && report && (
        <ReportDrawer
          report={report}
          tab={drawerTab}
          setTab={setDrawerTab}
          close={() => setDrawer(false)}
          downloadCsv={downloadCsv}
          downloadPdf={downloadPdf}
        />
      )}{" "}
      {uploadOpen && (
        <ArchiveUpload
          close={() => setUploadOpen(false)}
          complete={() => {
            setUploadOpen(false);
            void loadArchive();
          }}
          setUploading={setUploading}
          uploading={uploading}
        />
      )}
      <style jsx>{styles}</style>
    </section>
  );
}

function ReportsView({
  report,
  year,
  month,
  setSelectedMonth,
  openDrawer,
  downloadCsv,
  downloadPdf,
}: {
  report: Report | null;
  year: number;
  month: number;
  setSelectedMonth: (value: Date) => void;
  openDrawer: () => void;
  downloadCsv: () => void;
  downloadPdf: () => void;
}) {
  const summary = report?.summary;
  return (
    <>
      <section className="report-controls">
        <MonthPicker
          value={new Date(Date.UTC(year, month - 1, 1))}
          onChange={setSelectedMonth}
          ariaLabel="Choose report month"
        />
        <span className="report-note">
          Reports use new-system records only.
        </span>
      </section>
      <section className="report-cards">
        <Metric
          icon={<FiUsers />}
          value={summary?.childrenAttended ?? 0}
          title="Children Attended"
          text={`Across ${summary?.sundays ?? 0} Sunday${summary?.sundays === 1 ? "" : "s"} this month`}
          tone="blue"
        />
        <Metric
          icon={<FiUsers />}
          value={summary?.firstTimeVisits ?? 0}
          title="First-Time Visits"
          text="New children"
          tone="green"
        />
        <Metric
          icon={<FiCheckCircle />}
          value={summary?.followUps ?? 0}
          title="Follow-Ups"
          text="Families contacted"
          tone="amber"
        />
        <Metric
          icon={<FiCheckCircle />}
          value={`${summary?.safePickupRate ?? 0}%`}
          title="Safe Pickups"
          text="Completed pickup records"
          tone="purple"
        />
      </section>
      <section className="monthly-section">
        <div className="section-heading">
          <div>
            <h2>Monthly Reports</h2>
            <p>
              Live reports are generated from services recorded in the new TPK
              system.
            </p>
          </div>
          <button
            className="primary"
            disabled={!report?.summary.childrenAttended}
            onClick={openDrawer}
          >
            <FiFileText />
            View {report?.monthLabel || "Monthly"} Report
          </button>
        </div>
        <div className="report-toolbar">
          <button onClick={downloadPdf} disabled={!report}>
            <FiFileText />
            Detailed PDF
          </button>
          <button onClick={downloadCsv}>
            <FiDownload />
            Export CSV / Excel
          </button>
        </div>
        <div className="report-table">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Sundays</th>
                <th>Attendance</th>
                <th>First Visits</th>
                <th>Follow-Ups</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {report ? (
                <tr>
                  <td>
                    <b>{report.monthLabel}</b>
                  </td>
                  <td>{report.summary.sundays}</td>
                  <td>{report.summary.childrenAttended}</td>
                  <td>{report.summary.firstTimeVisits}</td>
                  <td>{report.summary.followUps}</td>
                  <td>
                    <span
                      className={
                        report.status === "IN_PROGRESS"
                          ? "status in-progress"
                          : "status complete"
                      }
                    >
                      {report.status === "IN_PROGRESS"
                        ? "In Progress"
                        : "Complete"}
                    </span>
                  </td>
                  <td>
                    <button className="row-action" onClick={openDrawer}>
                      <FiChevronRight />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr>
                  <td colSpan={7}>Loading selected month…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function Metric({
  icon,
  value,
  title,
  text,
  tone,
}: {
  icon: React.ReactNode;
  value: number | string;
  title: string;
  text: string;
  tone: string;
}) {
  return (
    <article className={`report-card ${tone}`}>
      <i>{icon}</i>
      <strong>{value}</strong>
      <b>{title}</b>
      <small>{text}</small>
    </article>
  );
}
function ReportDrawer({
  report,
  tab,
  setTab,
  close,
  downloadCsv,
  downloadPdf,
}: {
  report: Report;
  tab: "overview" | "attendance" | "children" | "followup" | "pickup";
  setTab: (
    tab: "overview" | "attendance" | "children" | "followup" | "pickup",
  ) => void;
  close: () => void;
  downloadCsv: () => void;
  downloadPdf: () => void;
}) {
  const s = report.summary;
  return (
    <div className="drawer-backdrop" onMouseDown={close}>
      <aside
        className="report-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close" onClick={close}>
          <FiX />
        </button>
        <header>
          <div>
            <h2>{report.monthLabel}</h2>
            <p>Monthly Ministry Report</p>
            <small>
              {report.status === "IN_PROGRESS"
                ? "Data updates as new services are recorded."
                : "This reporting period is complete."}
            </small>
          </div>
          <span
            className={
              report.status === "IN_PROGRESS"
                ? "status in-progress"
                : "status complete"
            }
          >
            {report.status === "IN_PROGRESS" ? "In Progress" : "Complete"}
          </span>
        </header>
        <nav>
          {(
            [
              "overview",
              "attendance",
              "children",
              "followup",
              "pickup",
            ] as const
          ).map((item) => (
            <button
              className={tab === item ? "selected" : ""}
              key={item}
              onClick={() => setTab(item)}
            >
              {item === "followup"
                ? "Follow-Up"
                : item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
        {tab === "overview" && (
          <section className="drawer-summary">
            <Mini value={s.childrenAttended} label="Children Attended" />
            <Mini value={s.firstTimeVisits} label="First-Time Visits" />
            <Mini value={s.followUps} label="Families Contacted" />
            <Mini value={`${s.safePickupRate}%`} label="Safe Pickups" />
          </section>
        )}
        {tab === "attendance" && (
          <section>
            <h3>Attendance by Sunday</h3>
            <table className="drawer-table">
              <thead>
                <tr>
                  <th>Sunday</th>
                  <th>First Service</th>
                  <th>Second Service</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {report.attendanceBySunday.map((row) => (
                  <tr key={row.serviceDate}>
                    <td>{formatDate(row.serviceDate)}</td>
                    <td>{row.firstService}</td>
                    <td>{row.secondService}</td>
                    <td>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3>Attendance by Class</h3>
            {report.attendanceByClass.map((row) => (
              <p className="breakdown" key={row.className}>
                <span>{row.className}</span>
                <b>{row.attendance}</b>
              </p>
            ))}
          </section>
        )}
        {tab === "children" && (
          <section className="data-list">
            <Mini value={s.newRegistrations} label="New registrations" />
            <Mini value={s.activeChildren} label="Active children" />
            <Mini value={s.completeProfiles} label="Complete profiles" />
          </section>
        )}
        {tab === "followup" && (
          <section className="data-list">
            <Mini
              value={s.familiesNeedFollowUp}
              label="Families needing follow-up"
            />
            <Mini value={s.familiesContacted} label="Families contacted" />
            <Mini value={s.couldntReach} label="Couldn't reach" />
            <Mini value={s.resolved} label="Resolved" />
            <Mini value={s.escalated} label="Reports sent to leadership" />
          </section>
        )}
        {tab === "pickup" && (
          <section className="data-list">
            <Mini value={s.checkedIn} label="Children checked in" />
            <Mini value={s.completedPickups} label="Completed pickups" />
            <Mini value={`${s.safePickupRate}%`} label="Safe pickup rate" />
          </section>
        )}
        <footer>
          <button onClick={downloadPdf}>Download detailed PDF</button>
          <button className="export" onClick={downloadCsv}>
            Download as CSV / Excel <FiChevronDown />
          </button>
        </footer>
      </aside>
    </div>
  );
}
function Mini({ value, label }: { value: number | string; label: string }) {
  return (
    <article>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
function ArchiveView({
  records,
  total,
  search,
  setSearch,
  year,
  setYear,
  type,
  setType,
  upload,
  download,
}: {
  records: Archive[];
  total: number;
  search: string;
  setSearch: (value: string) => void;
  year: string;
  setYear: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  upload: () => void;
  download: (record: Archive) => void;
}) {
  return (
    <>
      <section className="archive-heading">
        <div>
          <h2>Historical Archive</h2>
          <p>View and preserve TPK records from before the new system.</p>
        </div>
        <button className="primary" onClick={upload}>
          <FiUpload />
          Upload Archive
        </button>
      </section>
      <div className="archive-notice">
        <FiInfo />
        <span>
          <b>Historical records</b>Files stored here are for reference only.
          They are not included in current attendance, follow-up, pickup, or
          reporting calculations.
        </span>
      </div>
      <section className="archive-tools">
        <label>
          <FiSearch />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search archive…"
          />
        </label>
        <span className="app-dropdown-host">
          <select
            value={year}
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">All Years</option>
            {[2026, 2025, 2024].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </span>
        <span className="app-dropdown-host">
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">All File Types</option>
            <option value="ATTENDANCE">Attendance</option>
            <option value="CHILDREN_RECORDS">Children Records</option>
            <option value="REGISTRATION_RECORDS">Registration Records</option>
            <option value="FOLLOW_UP_RECORDS">Follow-Up Records</option>
            <option value="TEAM_ROSTER">Team / Roster</option>
            <option value="OTHER">Other</option>
          </select>
        </span>
      </section>
      <p className="archive-count">
        {total} historical record{total === 1 ? "" : "s"}
      </p>
      <div className="archive-table">
        <table>
          <thead>
            <tr>
              <th>Record</th>
              <th>Period</th>
              <th>Type</th>
              <th>Uploaded By</th>
              <th>Uploaded</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>
                  <b>{record.recordName}</b>
                  <small>
                    {record.originalFilename} · {fileSize(record.fileSizeBytes)}
                  </small>
                </td>
                <td>
                  {record.periodStart
                    ? record.periodEnd &&
                      record.periodEnd !== record.periodStart
                      ? `${formatDate(record.periodStart)} – ${formatDate(record.periodEnd)}`
                      : formatDate(record.periodStart)
                    : "—"}
                </td>
                <td>{typeLabel(record.recordType)}</td>
                <td>{record.uploadedBy}</td>
                <td>{formatDate(record.uploadedAt)}</td>
                <td>
                  <button
                    className="row-action archive-download"
                    onClick={() => download(record)}
                    title={`Download ${record.originalFilename}`}
                    type="button"
                  >
                    <FiDownload />
                  </button>
                </td>
              </tr>
            ))}
            {!records.length && (
              <tr>
                <td colSpan={6} className="empty">
                  No historical records found.
                  <small>
                    Archive files will remain separate from current TPK
                    reporting.
                  </small>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
function ArchiveUpload({
  close,
  complete,
  uploading,
  setUploading,
}: {
  close: () => void;
  complete: () => void;
  uploading: boolean;
  setUploading: (value: boolean) => void;
}) {
  const session = useMemo(() => readTeacherSession(), []);
  const [file, setFile] = useState<File | null>(null);
  const [periodType, setPeriodType] = useState("SINGLE_MONTH");
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !session) {
      setError("Choose a file to archive.");
      return;
    }
    setUploading(true);
    const data = new FormData(event.currentTarget);
    data.set("file", file);
    const rawPeriod = String(data.get("periodStart") || "");
    if (periodType === "SINGLE_MONTH" && /^\d{4}-\d{2}$/.test(rawPeriod)) {
      data.set("periodStart", `${rawPeriod}-01`);
      data.set("periodEnd", `${rawPeriod}-01`);
    }
    if (periodType === "FULL_YEAR" && /^\d{4}$/.test(rawPeriod)) {
      data.set("periodStart", `${rawPeriod}-01-01`);
      data.set("periodEnd", `${rawPeriod}-12-31`);
    }
    try {
      const response = await fetch(`${apiBase}/api/v1/archive-records`, {
        method: "POST",
        headers: authHeaders(session),
        body: data,
      });
      const body = await response.json();
      if (!response.ok || !body.success)
        throw new Error(
          body.error?.message || "The archive file could not be saved.",
        );
      complete();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The archive file could not be saved.",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <form
        className="archive-upload"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <button className="close" onClick={close} type="button">
          <FiX />
        </button>
        <p className="eyebrow">Add Historical Record</p>
        <h2>Store a previous TPK file for future reference.</h2>
        <label>
          Record Name *
          <input
            name="recordName"
            placeholder="August 2026 Attendance"
            required
          />
        </label>
        <label>
          Record Type *
          <select name="recordType" defaultValue="ATTENDANCE">
            <option value="ATTENDANCE">Attendance</option>
            <option value="CHILDREN_RECORDS">Children Records</option>
            <option value="REGISTRATION_RECORDS">Registration Records</option>
            <option value="FOLLOW_UP_RECORDS">Follow-Up Records</option>
            <option value="TEAM_ROSTER">Team / Roster</option>
            <option value="OTHER">Other</option>
          </select>
        </label>
        <label>
          Period Covered *
          <select
            name="periodType"
            value={periodType}
            onChange={(event) => setPeriodType(event.target.value)}
          >
            <option value="SINGLE_MONTH">Single Month</option>
            <option value="DATE_RANGE">Date Range</option>
            <option value="FULL_YEAR">Full Year</option>
          </select>
        </label>
        <div className="period-fields">
          {periodType === "DATE_RANGE" ? (
            <>
              <label>
                From
                <input name="periodStart" type="date" required />
              </label>
              <label>
                To
                <input name="periodEnd" type="date" required />
              </label>
            </>
          ) : (
            <label>
              {periodType === "FULL_YEAR" ? "Year" : "Month"}
              <input
                name="periodStart"
                type={periodType === "FULL_YEAR" ? "number" : "month"}
                required
              />
            </label>
          )}
        </div>
        <label>
          Description
          <textarea
            name="description"
            placeholder="Add a short note about what’s contained in this file…"
          />
        </label>
        <label className="upload-zone">
          <input
            accept=".xls,.xlsx,.csv,.pdf,.doc,.docx"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setFile(event.target.files?.[0] || null)
            }
            type="file"
          />
          <FiUpload />
          <b>{file ? file.name : "Drag and drop your historical file here"}</b>
          <small>
            {file
              ? fileSize(file.size)
              : "or Browse Files · XLS, XLSX, CSV, PDF, DOC, DOCX"}
          </small>
        </label>
        <p className="archive-only">
          <FiInfo />
          <span>
            <b>Archive only</b>This file will be stored for reference and will
            not change current TPK records.
          </span>
        </p>
        {error && <p className="form-error">{error}</p>}
        <footer>
          <button onClick={close} type="button">
            Cancel
          </button>
          <button className="primary" disabled={uploading}>
            {uploading ? "Saving…" : "Save to Archive"}
          </button>
        </footer>
      </form>
    </div>
  );
}

const styles = `.reports-workspace{max-width:1540px}.reports-workspace h1,.reports-workspace h2,.reports-workspace h3{font-family:var(--font-display),Georgia,serif}.reports-workspace>header{margin:4px 0 18px}.reports-workspace h1{margin:7px 0 4px;font-size:40px;letter-spacing:-1.3px}.reports-workspace>header p:last-child,.archive-heading p,.section-heading p{margin:0;color:#647088;font-size:17px}.report-tabs{display:flex;gap:22px;border-bottom:1px solid #e7e1d9}.report-tabs button{height:40px;border:0;border-bottom:2px solid transparent;background:transparent;color:#61708a;font:800 12px var(--font-body);cursor:pointer}.report-tabs .selected{border-color:#ff5634;color:#172641}.report-controls{display:flex;justify-content:space-between;align-items:center;margin:16px 0 20px}.report-controls>div{display:flex;align-items:center;gap:9px}.report-controls button,.report-controls span{height:38px;border:1px solid #dbe0e9;border-radius:7px;background:#fff;color:#253750;display:flex;align-items:center;gap:8px;padding:0 12px;font:800 11px var(--font-body)}.report-controls button{width:38px;padding:0;justify-content:center;cursor:pointer}.report-note{font-size:10px!important;color:#687993!important;background:#f7f3eb!important;border:0!important}.report-cards{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.report-card{min-height:112px;border:1px solid #eee8e0;border-radius:10px;padding:16px 20px;background:linear-gradient(135deg,#eef6ff,#fff);display:grid;gap:4px;align-content:center}.report-card i{display:grid;place-items:center;width:37px;height:37px;border-radius:11px;background:#e1f0ff;color:#1978cf;font-style:normal;font-size:20px}.report-card strong{font:800 30px/1 var(--font-body);letter-spacing:-1.5px}.report-card b{font-size:13px}.report-card small{color:#62718a;font-size:11px}.report-card.green{background:linear-gradient(135deg,#effaf4,#fff)}.report-card.green i{background:#dff6e8;color:#138754}.report-card.amber{background:linear-gradient(135deg,#fff6e6,#fff)}.report-card.amber i{background:#fff0ce;color:#d68108}.report-card.purple{background:linear-gradient(135deg,#f3efff,#fff)}.report-card.purple i{background:#e9deff;color:#6f3cd4}.monthly-section{margin-top:24px}.section-heading,.archive-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:15px;margin-bottom:14px}.section-heading h2,.archive-heading h2{margin:0;font-size:25px}.section-heading p,.archive-heading p{margin-top:4px;font-size:13px}.primary{height:42px;border:0;border-radius:8px;background:#ff5a34;color:#fff;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:800 11px var(--font-body);cursor:pointer;text-decoration:none}.primary:disabled{opacity:.5;cursor:not-allowed}.report-toolbar,.archive-tools{display:flex;gap:10px;margin-bottom:12px}.report-toolbar :global(.app-dropdown-host),.archive-tools :global(.app-dropdown-host){width:145px;height:42px}.report-toolbar select,.archive-tools select{width:100%;height:100%;border:1px solid #dbe0e9;border-radius:8px;padding:0 10px;background:#fff;color:#26354d;font:800 11px var(--font-body)}.report-toolbar>button{height:42px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#26354d;padding:0 13px;display:flex;align-items:center;gap:8px;font:800 11px var(--font-body);cursor:pointer}.report-table,.archive-table{overflow:auto;border:1px solid #ebe5de;border-radius:10px;background:#fff}.report-table table,.archive-table table{width:100%;min-width:760px;border-collapse:collapse}.report-table th,.archive-table th{padding:12px;text-align:left;background:#faf9f6;color:#707b91;font-size:9px;letter-spacing:.05em;text-transform:uppercase}.report-table td,.archive-table td{padding:11px 12px;border-top:1px solid #eee8e1;color:#41506a;font-size:12px}.report-table td b,.archive-table td b{color:#14223b}.archive-table td small{display:block;margin-top:4px;color:#71809a;font-size:10px}.status{display:inline-flex;align-items:center;border-radius:7px;padding:6px 8px;font-size:9px;font-weight:800}.status.in-progress{background:#fff2dd;color:#b86a00}.status.complete{background:#eaf8ef;color:#087a4b}.status.empty{background:#f3f1ed;color:#7c7b79}.row-action{border:0;background:transparent;color:#526884;font-size:18px;cursor:pointer}.archive-heading{margin-top:20px}.archive-notice,.archive-only{display:flex;gap:10px;align-items:flex-start;border:1px solid #d7eee1;border-radius:9px;padding:12px 14px;background:#f0faf4;color:#466174;font-size:11px;line-height:1.45}.archive-notice svg,.archive-only svg{flex:none;color:#078c55;font-size:18px}.archive-notice b,.archive-only b{display:block;color:#173653;margin-bottom:2px}.archive-tools{margin-top:16px}.archive-tools label{height:42px;min-width:260px;flex:1;max-width:480px;display:flex;align-items:center;gap:8px;border:1px solid #dbe0e9;border-radius:8px;padding:0 12px;background:#fff;color:#71809a}.archive-tools input{width:100%;border:0;outline:0;background:transparent;font:600 12px var(--font-body)}.archive-count{margin:18px 0 10px;color:#34435d;font-size:13px;font-weight:800}.empty{text-align:center;padding:34px!important;color:#65738b!important}.empty small{display:block;margin-top:4px;font-size:11px}.reports-error,.form-error{padding:12px;border:1px solid #ffd6cb;border-radius:8px;color:#b33c22;background:#fff2ee;font-size:12px}.drawer-backdrop,.modal-backdrop{position:fixed;z-index:90;inset:0;background:#0717301c}.report-drawer{position:absolute;right:0;top:0;width:min(100%,470px);height:100%;overflow:auto;background:#fffdfa;box-shadow:-14px 0 35px #0717301c}.close{position:absolute;right:16px;top:16px;border:0;background:transparent;color:#62718a;font-size:19px;cursor:pointer}.report-drawer header{display:flex;justify-content:space-between;gap:12px;padding:38px 26px 18px;border-bottom:1px solid #ece7e0}.report-drawer h2{margin:0;font-size:25px}.report-drawer header p{margin:4px 0;color:#61718b;font-size:12px}.report-drawer header small{color:#71809a;font-size:10px}.report-drawer nav{display:flex;overflow:auto;border-bottom:1px solid #ece7e0;padding:0 12px}.report-drawer nav button{height:48px;min-width:80px;flex:1;border:0;border-bottom:2px solid transparent;background:transparent;color:#61718b;font:700 10px var(--font-body);cursor:pointer}.report-drawer nav .selected{border-color:#ff5634;color:#15243c}.report-drawer section{padding:22px 26px}.drawer-summary,.data-list{display:grid;grid-template-columns:1fr 1fr;gap:10px}.drawer-summary article,.data-list article{border:1px solid #e7e3dd;border-radius:9px;padding:13px;background:#fff}.drawer-summary strong,.data-list strong{display:block;font:800 23px/1 var(--font-body)}.drawer-summary span,.data-list span{display:block;margin-top:4px;color:#687993;font-size:10px}.report-drawer h3{margin:0 0 12px;font-size:18px}.report-drawer h3:not(:first-child){margin-top:24px}.drawer-table{width:100%;border-collapse:collapse;font-size:11px}.drawer-table th,.drawer-table td{padding:9px 6px;border-bottom:1px solid #eee8e1;text-align:left}.drawer-table th{font-size:9px;color:#71809a;text-transform:uppercase}.breakdown{display:flex;justify-content:space-between;padding:10px 0;margin:0;border-bottom:1px solid #eee8e1;font-size:12px}.report-drawer footer,.archive-upload footer{display:flex;gap:10px;padding:18px 26px;border-top:1px solid #ece7e0}.report-drawer footer button,.archive-upload footer button{height:42px;flex:1;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#20314d;font:800 11px var(--font-body);cursor:pointer}.report-drawer footer .export{background:#ff5a34;border-color:#ff5a34;color:#fff}.modal-backdrop{display:grid;place-items:center;padding:18px}.archive-upload{position:relative;width:min(580px,100%);max-height:94vh;overflow:auto;border-radius:12px;padding:27px;background:#fffdfa;box-shadow:0 20px 60px #0004}.archive-upload h2{margin:0 0 20px;font-size:27px}.archive-upload>label,.archive-upload .period-fields label{display:grid;gap:6px;margin:12px 0;color:#36455d;font-size:11px;font-weight:800}.archive-upload input,.archive-upload select,.archive-upload textarea{width:100%;height:42px;border:1px solid #dbe0e9;border-radius:8px;padding:0 11px;background:#fff;color:#172b4a;font:12px var(--font-body)}.archive-upload textarea{height:74px;padding-top:10px;resize:vertical}.period-fields{display:grid;grid-template-columns:1fr 1fr;gap:10px}.period-fields label{margin:0!important}.upload-zone{min-height:138px;display:grid!important;place-items:center;align-content:center;text-align:center;border:1px dashed #d3c6b5;border-radius:10px;padding:16px!important;background:#fffaf5;color:#58708e!important;cursor:pointer}.upload-zone input{position:absolute;inline-size:1px;block-size:1px;opacity:0}.upload-zone svg{font-size:25px;color:#e95431}.upload-zone b{color:#263750;font-size:12px}.upload-zone small{font-size:10px}.archive-only{margin:14px 0}.archive-upload footer{margin:20px -27px -27px}.archive-upload footer .primary{flex:1}@media(max-width:1050px){.report-cards{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.reports-workspace h1{font-size:35px}.reports-workspace>header p:last-child{font-size:14px}.report-controls,.section-heading,.archive-heading{align-items:flex-start;flex-direction:column}.report-note{display:none!important}.report-cards{gap:10px}.report-card{min-height:100px;padding:13px}.report-card strong{font-size:26px}.report-toolbar,.archive-tools{display:grid;grid-template-columns:1fr}.report-toolbar :global(.app-dropdown-host),.archive-tools :global(.app-dropdown-host),.archive-tools label{width:100%;max-width:none}.report-drawer{width:100%;top:auto;bottom:0;height:min(92vh,760px);border-radius:18px 18px 0 0}.archive-upload{padding:22px}.period-fields{grid-template-columns:1fr}.archive-upload footer{margin:18px -22px -22px}}`;

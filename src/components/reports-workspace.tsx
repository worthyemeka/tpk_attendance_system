"use client";

import { AppSelect } from "@/components/app-dropdown";
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
import { StatCard, type StatCardTone } from "./stat-card";
import { useProfileDialog } from "./use-profile-dialog";
import "./service-workspaces.css";

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
          <button onClick={downloadCsv} disabled={!report}>
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
                  <td data-label="Month">
                    <b>{report.monthLabel}</b>
                  </td>
                  <td data-label="Sundays">{report.summary.sundays}</td>
                  <td data-label="Attendance">{report.summary.childrenAttended}</td>
                  <td data-label="First visits">{report.summary.firstTimeVisits}</td>
                  <td data-label="Follow-ups">{report.summary.followUps}</td>
                  <td data-label="Status">
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
                  <td data-label="Report">
                    <button className="row-action" onClick={openDrawer} aria-label={`View ${report.monthLabel} report`}>
                      View report <FiChevronRight />
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
  tone: StatCardTone | "amber";
}) {
  return (
    <StatCard icon={icon} value={value} title={title} description={text} tone={tone === "amber" ? "yellow" : tone} />
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
  useProfileDialog(close, ".report-drawer");
  return (
    <div className="drawer-backdrop" onMouseDown={close}>
      <aside
        className="report-drawer"
        role="dialog" aria-modal="true" aria-label={`${report.monthLabel} ministry report`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="close" onClick={close} aria-label="Close monthly report">
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
            aria-label="Search historical records"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search archive…"
          />
        </label>
        <span className="app-dropdown-host">
          <AppSelect
            value={year}
            aria-label="Filter archive by year"
            onChange={(event) => setYear(event.target.value)}
          >
            <option value="">All Years</option>
            {[2026, 2025, 2024].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </AppSelect>
        </span>
        <span className="app-dropdown-host">
          <AppSelect
            value={type}
            aria-label="Filter archive by record type"
            onChange={(event) => setType(event.target.value)}
          >
            <option value="">All File Types</option>
            <option value="ATTENDANCE">Attendance</option>
            <option value="CHILDREN_RECORDS">Children Records</option>
            <option value="REGISTRATION_RECORDS">Registration Records</option>
            <option value="FOLLOW_UP_RECORDS">Follow-Up Records</option>
            <option value="TEAM_ROSTER">Team / Roster</option>
            <option value="OTHER">Other</option>
          </AppSelect>
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
  useProfileDialog(close, ".archive-upload");
  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <form
        className="archive-upload"
        role="dialog" aria-modal="true" aria-label="Upload historical record"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <button className="close" onClick={close} type="button" aria-label="Close archive upload">
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
          <AppSelect name="recordType" defaultValue="ATTENDANCE">
            <option value="ATTENDANCE">Attendance</option>
            <option value="CHILDREN_RECORDS">Children Records</option>
            <option value="REGISTRATION_RECORDS">Registration Records</option>
            <option value="FOLLOW_UP_RECORDS">Follow-Up Records</option>
            <option value="TEAM_ROSTER">Team / Roster</option>
            <option value="OTHER">Other</option>
          </AppSelect>
        </label>
        <label>
          Period Covered *
          <AppSelect
            name="periodType"
            value={periodType}
            onChange={(event) => setPeriodType(event.target.value)}
          >
            <option value="SINGLE_MONTH">Single Month</option>
            <option value="DATE_RANGE">Date Range</option>
            <option value="FULL_YEAR">Full Year</option>
          </AppSelect>
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

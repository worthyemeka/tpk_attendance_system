"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FiAlertCircle,
  FiBookOpen,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiDownload,
  FiMail,
  FiMessageCircle,
  FiMoreVertical,
  FiPhone,
  FiPlus,
  FiSearch,
  FiSend,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { printBrandedDocument } from "@/lib/branded-print";
import { MonthPicker } from "@/components/month-picker";
import { DataViewToggle, type DataView } from "@/components/data-view-toggle";
import "./roster-popup.css";

type Teacher = {
  id: number;
  name: string;
  accessLevel: string;
  teamStatus: string;
  onboardingStatus: "PROBATION" | "ONBOARDED";
  probationWeek?: number | null;
  probationTargetWeeks?: number;
  profileImageUrl?: string | null;
  whatsappNumber?: string | null;
  mobileNumber?: string | null;
};
type Duty = {
  id: number;
  name: string;
  code: string;
  category: "FIRST_SERVICE" | "SECOND_SERVICE" | "NON_TEACHING";
  requiresClass: boolean;
};
type ClassRoom = { id: number; name: string };
type Assignment = {
  id: number;
  userId: number;
  assignmentDate: string;
  serviceSessionId?: number | null;
  classId?: number | null;
  status: string;
  dutyName: string;
  dutyCode: string;
  dutyCategory: Duty["category"];
  className?: string | null;
  teacherName: string;
  accessLevel: string;
  teamStatus: string;
  onboardingStatus: "PROBATION" | "ONBOARDED";
  probationWeek?: number | null;
  probationTargetWeeks?: number;
  profileImageUrl?: string | null;
  whatsappNumber?: string | null;
  mobileNumber?: string | null;
  serviceName?: string | null;
  serviceType?: string | null;
};
type Management = {
  month: string;
  sundays: string[];
  state: { status: "DRAFT" | "PUBLISHED"; publishedAt?: string | null };
  permissions?: { isSuperAdmin: boolean; locked: boolean };
  teachers: Teacher[];
  duties: Duty[];
  classes: ClassRoom[];
  assignments: Assignment[];
  summary: {
    sundays: number;
    teamMembers: number;
    assignments: number;
    unfilled: number;
  };
};
type ModalState = {
  type: "SUNDAY" | "NON_TEACHING";
  date: string;
  serviceType: "FIRST_SERVICE" | "SECOND_SERVICE";
  dutyId: string;
  classId: string;
  teacherIds: number[];
  replaceAssignmentId?: number;
};

const sundayColumns = [
  { label: "First Service", sub: "Team", code: "FIRST_SERVICE_TEAM" },
  {
    label: "Tribe A",
    sub: "9–12",
    code: "CLASS_TEACHER",
    className: "Tribe A",
  },
  { label: "Tribe B", sub: "5–8", code: "CLASS_TEACHER", className: "Tribe B" },
  { label: "Tribe C", sub: "3–4", code: "CLASS_TEACHER", className: "Tribe C" },
  { label: "Teacher at Door", code: "TEACHER_AT_DOOR" },
  { label: "Assembly", code: "ASSEMBLY" },
  { label: "Attendance", code: "ATTENDANCE" },
  { label: "Head of Service", code: "HEAD_OF_SERVICE" },
  {
    label: "Assistant Head 1",
    sub: "Service leadership",
    code: "ASSISTANT_HEAD_OF_SERVICE_1",
  },
  {
    label: "Assistant Head 2",
    sub: "Service leadership",
    code: "ASSISTANT_HEAD_OF_SERVICE_2",
  },
] as const;
const formatMonth = (date: Date) =>
  new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(-2)
    .join("")
    .toUpperCase() || "TP";
const stateFor = (date: Date): ModalState => ({
  type: "SUNDAY",
  date: date.toISOString().slice(0, 10),
  serviceType: "SECOND_SERVICE",
  dutyId: "",
  classId: "",
  teacherIds: [],
});
const popupStyles = `.cell-unfilled{display:inline-block;color:#8b95a6;font-size:10px;font-weight:800}.locked-row td{background:#f2f3f5!important;color:#8a93a1!important}.locked-row .teachers button{color:#707987!important;cursor:default}.locked-row .teachers button:hover span{text-decoration:none;color:#707987}.teacher-profile-modal{position:relative;width:min(100%,460px);border-radius:13px;background:#fffdfa;box-shadow:0 24px 80px #07162a55;overflow:hidden}.teacher-profile-modal header{display:flex;align-items:center;gap:12px;padding:22px 24px 17px}.teacher-profile-modal header img,.teacher-profile-modal header i{width:46px;height:46px;flex:none;border-radius:50%;object-fit:cover}.teacher-profile-modal header i{display:grid;place-items:center;background:#e8effb;color:#2c66a7;font-size:13px;font-style:normal;font-weight:900}.teacher-profile-modal h2{margin:0;font-size:23px}.teacher-profile-modal header p{margin:3px 0 0;color:#69768e;font-size:11px}.teacher-profile-modal header p span{margin-left:6px;padding:3px 7px;border-radius:99px;background:#fff1dc;color:#a96800;font-weight:800}.teacher-profile-modal nav{display:flex;border-top:1px solid #eee9e2;border-bottom:1px solid #eee9e2}.teacher-profile-modal nav button{flex:1;padding:12px 8px;border:0;border-bottom:2px solid transparent;background:#fffdfa;color:#69768e;font:800 11px var(--font-body);cursor:pointer}.teacher-profile-modal nav button.active{color:#ec5231;border-bottom-color:#ff5734}.teacher-profile-content,.teacher-roster-list{padding:18px 24px;min-height:150px}.teacher-duty{display:flex;align-items:center;gap:8px;margin:0 0 16px;color:#2a3d5b;font-size:12px;font-weight:800}.contact-actions{display:flex;gap:9px}.contact-actions a,.team-profile-link{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid #dce1e8;border-radius:7px;padding:9px 12px;color:#263b5b;font-size:11px;font-weight:800;text-decoration:none}.contact-actions a:hover,.team-profile-link:hover{border-color:#ff6a48;color:#e74c2f}.team-profile-link{margin-top:13px}.no-contact{margin:0;color:#78849a;font-size:11px}.teacher-roster-list{display:grid;gap:8px;max-height:270px;overflow:auto}.teacher-roster-list>div{display:grid;grid-template-columns:58px 1fr;gap:2px 10px;padding:9px;border-radius:7px;background:#faf8f4;color:#32435f;font-size:11px}.teacher-roster-list b{grid-row:span 2;font-size:11px}.teacher-roster-list small{color:#758198;font-size:10px}.teacher-roster-list>p{color:#758198;font-size:11px}.teacher-profile-modal footer{display:flex;justify-content:flex-end;gap:9px;padding:14px 20px;border-top:1px solid #eee9e2}.teacher-profile-modal footer button{height:38px}.danger-button{border:0;border-radius:7px;padding:0 12px;background:#fff0eb;color:#d8442c;font:800 11px var(--font-body);cursor:pointer}`;

export default function RosterPage() {
  const session = useMemo(() => readTeacherSession(), []);
  const superAdmin = session?.accessLevel === "TPK_SUPER_ADMIN";
  const [monthDate, setMonthDate] = useState(
    () =>
      new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1)),
  );
  const [data, setData] = useState<Management | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"SUNDAY" | "NON_TEACHING">("SUNDAY");
  const [query, setQuery] = useState("");
  const [sundayFilter, setSundayFilter] = useState("");
  const [dutyFilter, setDutyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [display, setDisplay] = useState<DataView>("GRID");
  const [exportOpen, setExportOpen] = useState(false);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [teacherMenu, setTeacherMenu] = useState<Assignment | null>(null);
  const monthKey = monthDate.toISOString().slice(0, 7);
  const locked = Boolean(data?.permissions?.locked);
  const readOnly = !superAdmin || locked;
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${apiBase}/api/v1/roster/management?month=${monthDate.getUTCMonth() + 1}&year=${monthDate.getUTCFullYear()}`,
        { headers: authHeaders(session) },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not load this monthly roster.",
        );
      setData(result.data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not load this monthly roster.",
      );
    } finally {
      setLoading(false);
    }
  }, [monthDate, session]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const saved = window.localStorage.getItem("tpk:roster-display");
    if (saved === "GRID" || saved === "LIST" || saved === "CALENDAR") {
      setDisplay(saved);
    } else if (window.matchMedia("(max-width: 1024px)").matches) {
      setDisplay("LIST");
    }
  }, []);
  const setRosterDisplay = (value: DataView) => {
    setDisplay(value);
    window.localStorage.setItem("tpk:roster-display", value);
  };
  const visibleAssignments = useMemo(() => {
    if (!data) return [];
    return data.assignments.filter((item) => {
      const text = `${item.teacherName} ${item.dutyName}`.toLowerCase();
      return (
        (!query || text.includes(query.toLowerCase())) &&
        (!dutyFilter || item.dutyCode === dutyFilter) &&
        (!statusFilter || item.status === statusFilter)
      );
    });
  }, [data, dutyFilter, query, statusFilter]);
  const datesForNonTeaching = useMemo(() => {
    const defaultDates: Array<string> = [];
    const cursor = new Date(monthDate);
    while (cursor.getUTCMonth() === monthDate.getUTCMonth()) {
      if ([4, 6].includes(cursor.getUTCDay()))
        defaultDates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return defaultDates;
  }, [monthDate]);
  const openAssign = (preset?: Partial<ModalState>) => {
    if (readOnly) return;
    const fresh = stateFor(monthDate);
    setModal({ ...fresh, ...preset, teacherIds: preset?.teacherIds || [] });
    setTeacherSearch("");
    setTeacherMenu(null);
  };
  const dutyByCode = (code: string) =>
    data?.duties.find((item) => item.code === code);
  const cellAssignments = (
    date: string,
    column: (typeof sundayColumns)[number],
  ) =>
    visibleAssignments.filter(
      (item) =>
        item.assignmentDate === date &&
        item.dutyCode === column.code &&
        (!("className" in column) || item.className === column.className),
    );
  const nonTeachingAssignments = (date: string, code: string) =>
    visibleAssignments.filter(
      (item) => item.assignmentDate === date && item.dutyCode === code,
    );
  const selectedDuty = data?.duties.find(
    (item) => item.id === Number(modal?.dutyId),
  );
  const selectedTeachers =
    data?.teachers.filter((item) => modal?.teacherIds.includes(item.id)) || [];
  const replacingAssignment = modal?.replaceAssignmentId
    ? data?.assignments.find((item) => item.id === modal.replaceAssignmentId)
    : undefined;
  const conflicts = (teacherId: number) =>
    data?.assignments.filter(
      (item) =>
        item.userId === teacherId &&
        item.assignmentDate === modal?.date &&
        item.status !== "CANCELLED" &&
        item.status !== "REPLACED",
    ) || [];
  async function saveAssignment(event: FormEvent) {
    event.preventDefault();
    if (!session || !modal || !modal.dutyId || !modal.teacherIds.length) return;
    if (
      modal.type === "NON_TEACHING" &&
      ![4, 6].includes(new Date(`${modal.date}T12:00:00Z`).getUTCDay())
    ) {
      setError(
        "Non-teaching duties can only be scheduled on Thursdays or Saturdays.",
      );
      return;
    }
    if (
      replacingAssignment &&
      modal.teacherIds.includes(replacingAssignment.userId)
    ) {
      setError("Choose a different teacher to reassign this duty.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/roster/assignments`, {
        method: "POST",
        headers: {
          ...authHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userIds: modal.teacherIds,
          dutyTypeId: Number(modal.dutyId),
          assignmentDate: modal.date,
          serviceType: modal.type === "SUNDAY" ? modal.serviceType : undefined,
          classId: modal.classId ? Number(modal.classId) : null,
          replaceAssignmentId: modal.replaceAssignmentId,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not assign this duty.",
        );
      setNotice(
        modal.replaceAssignmentId
          ? `Assignment reassigned for ${formatDate(modal.date)}.`
          : `${result.data.created} assignment${result.data.created === 1 ? "" : "s"} saved for ${formatDate(modal.date)}.`,
      );
      setModal(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not assign this duty.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function removeAssignment(item: Assignment) {
    if (!session) return;
    setSaving(true);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/roster/assignments/${item.id}`,
        { method: "DELETE", headers: authHeaders(session) },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not remove this assignment.",
        );
      setNotice(`${item.teacherName} was unassigned from ${item.dutyName}.`);
      setTeacherMenu(null);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not remove this assignment.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function saveState(status: "DRAFT" | "PUBLISHED") {
    if (!session) return;
    setSaving(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/roster/month-state`, {
        method: "PATCH",
        headers: {
          ...authHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month: monthKey, status }),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not update roster state.",
        );
      const sent = Number(result.data.notificationsSent || 0);
      const failed = Number(result.data.notificationsFailed || 0);
      const inApp = Number(result.data.inAppNotifications || 0);
      setNotice(
        status === "PUBLISHED"
          ? result.data.notificationsSkipped
            ? "This roster is already published, so no duplicate team notifications were created."
            : `Roster published. ${inApp} assigned teacher${inApp === 1 ? "" : "s"} now have an in-app roster notification.${sent ? ` ${sent} WhatsApp message${sent === 1 ? " was" : "s were"} also sent.` : ""}${failed ? ` ${failed} WhatsApp message${failed === 1 ? " could" : "s could"} not be sent.` : ""}`
          : `${formatMonth(monthDate)} saved as a draft.`,
      );
      setPublishOpen(false);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not update roster state.",
      );
    } finally {
      setSaving(false);
    }
  }
  function exportRoster(kind: "CSV" | "PDF") {
    if (!data) return;
    setExportOpen(false);
    const rows = (
      tab === "SUNDAY" ? data.sundays : datesForNonTeaching
    ).flatMap((date) => {
      const columns =
        tab === "SUNDAY"
          ? sundayColumns.map((item) => ({
              label: item.label,
              items: cellAssignments(date, item),
            }))
          : [
              {
                label: "Prayers",
                items: nonTeachingAssignments(date, "PRAYERS"),
              },
              {
                label: "Lesson Plan Review",
                items: nonTeachingAssignments(date, "LESSON_PLAN_REVIEW"),
              },
            ];
      return columns.map((column) => ({
        Date: formatDate(date),
        Duty: column.label,
        Teachers:
          column.items.map((item) => item.teacherName).join("; ") || "Unfilled",
        Status:
          column.items.map((item) => item.status).join("; ") || "UNFILLED",
      }));
    });
    if (kind === "CSV") {
      const csv = [
        Object.keys(
          rows[0] || { Date: "", Duty: "", Teachers: "", Status: "" },
        ).join(","),
        ...rows.map((row) =>
          Object.values(row)
            .map((value) => `"${String(value).replaceAll('"', '""')}"`)
            .join(","),
        ),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `TPK-${monthKey}-${tab.toLowerCase()}-roster.csv`;
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    printBrandedDocument({
      eyebrow: tab === "SUNDAY" ? "Sunday duties" : "Non-teaching duties",
      title: `${formatMonth(monthDate)} Roster`,
      subtitle: "TPK teaching and ministry assignments for Petra Wuse.",
      stats: [
        {
          label: "Scheduled days",
          value:
            tab === "SUNDAY" ? data.sundays.length : datesForNonTeaching.length,
        },
        {
          label: "Assignments",
          value: rows.filter((row) => row.Status !== "UNFILLED").length,
        },
        {
          label: "Unfilled roles",
          value: rows.filter((row) => row.Status === "UNFILLED").length,
        },
      ],
      columns: ["Date", "Duty", "Teacher(s)", "Status"],
      rows: rows.map((row) => [row.Date, row.Duty, row.Teachers, row.Status]),
    });
  }
  function exportTeacherRoster(item: Assignment, kind: "CSV" | "PDF") {
    const rows = (data?.assignments || [])
      .filter((assignment) => assignment.userId === item.userId)
      .sort((left, right) => left.assignmentDate.localeCompare(right.assignmentDate))
      .map((assignment) => ({
        Date: formatDate(assignment.assignmentDate),
        Service: assignment.serviceName || "Non-teaching duty",
        Responsibility:
          assignment.dutyName +
          (assignment.className ? " · " + assignment.className : ""),
        Status: assignment.status,
      }));
    if (kind === "CSV") {
      const csv = [
        "Date,Service,Responsibility,Status",
        ...rows.map((row) =>
          Object.values(row)
            .map((value) => '"' + String(value).replaceAll('"', '""') + '"')
            .join(","),
        ),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download =
        "TPK-" +
        item.teacherName.replaceAll(/\s+/g, "-").toLowerCase() +
        "-" +
        monthKey +
        "-roles.csv";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    printBrandedDocument({
      eyebrow: "Teaching roster",
      title: item.teacherName + "’s " + formatMonth(monthDate) + " Roles",
      subtitle: "TribePetra Kids · Petra Wuse Campus",
      stats: [
        { label: "Responsibilities", value: rows.length },
        {
          label: "Sunday roles",
          value: rows.filter((row) => row.Service !== "Non-teaching duty").length,
        },
      ],
      columns: ["Date", "Service", "Responsibility", "Status"],
      rows: rows.map((row) => [
        row.Date,
        row.Service,
        row.Responsibility,
        row.Status,
      ]),
    });
  }
  async function sendTeacherReminder(
    teacherId: number,
    channel: "IN_APP" | "WHATSAPP" | "EMAIL",
  ) {
    if (!session) throw new Error("Please sign in again.");
    const response = await fetch(
      apiBase + "/api/v1/roster/teacher-reminders",
      {
        method: "POST",
        headers: { ...authHeaders(session), "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, month: monthKey, channel }),
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success)
      throw new Error(
        result.error?.message || "We could not send that roster reminder.",
      );
    const description =
      channel === "IN_APP"
        ? "An in-app reminder is ready on your board."
        : "An in-app reminder was created and the " +
          (channel === "EMAIL" ? "email" : "WhatsApp") +
          " reminder was sent.";
    setNotice(description);
    return description;
  }
  return (
    <section className="roster-page">
      <header className="roster-heading">
        <div>
          <p className="eyebrow">Ministry management</p>
          <h1>Team &amp; Roster</h1>
          <p className="intro">
            Plan and manage TPK teaching and ministry duties month by month.
          </p>
        </div>
      </header>
      <section className="month-bar">
        <MonthPicker
          value={monthDate}
          onChange={setMonthDate}
          ariaLabel="Choose roster month"
        />
        <span
          className={`roster-state ${(data?.state.status || "DRAFT").toLowerCase()}`}
        >
          <i />
          {locked
            ? "Completed · read only"
            : data?.state.status === "PUBLISHED"
              ? "Published"
              : "Draft"}
        </span>
        <div className="month-stats">
          <Stat value={data?.summary.sundays || 0} label="Sundays" />
          <Stat value={data?.summary.teamMembers || 0} label="Team Members" />
          <Stat value={data?.summary.assignments || 0} label="Assignments" />
          <Stat value={data?.summary.unfilled || 0} label="Unfilled" warn />
        </div>
        {superAdmin && !locked && (
          <button
            className="solid-button assign-main"
            onClick={() => openAssign()}
          >
            <FiPlus />
            Assign Duty
          </button>
        )}
      </section>
      <div className="roster-tabs">
        <button
          className={tab === "SUNDAY" ? "active" : ""}
          onClick={() => setTab("SUNDAY")}
        >
          <FiUsers />
          <span>
            <b>Sunday Duties</b>
            <small>Teaching and service roles (Sundays)</small>
          </span>
        </button>
        <button
          className={tab === "NON_TEACHING" ? "active" : ""}
          onClick={() => setTab("NON_TEACHING")}
        >
          <FiBookOpen />
          <span>
            <b>Non-Teaching Duties</b>
            <small>Prayers, lesson plan review and other activities</small>
          </span>
        </button>
      </div>
      <section className="roster-panel">
        <div className="roster-tools">
          <label className="search">
            <FiSearch />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teacher by name…"
            />
          </label>
          <select
            value={sundayFilter}
            onChange={(event) => setSundayFilter(event.target.value)}
          >
            <option value="">All Sundays</option>
            {data?.sundays.map((date) => (
              <option key={date} value={date}>
                {formatDate(date)}
              </option>
            ))}
          </select>
          <select
            value={dutyFilter}
            onChange={(event) => setDutyFilter(event.target.value)}
          >
            <option value="">All Duties</option>
            {data?.duties
              .filter((item) =>
                tab === "SUNDAY"
                  ? item.category !== "NON_TEACHING"
                  : item.category === "NON_TEACHING",
              )
              .map((item) => (
                <option key={item.id} value={item.code}>
                  {item.name}
                </option>
              ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="PRESENT">Present</option>
            <option value="ABSENT">Absent</option>
          </select>
          <div className="export-wrap">
            <button
              className="export-button"
              onClick={() => setExportOpen((value) => !value)}
            >
              <FiDownload />
              Export <FiChevronDown />
            </button>
            {exportOpen && (
              <div className="export-menu">
                <button onClick={() => exportRoster("PDF")}>
                  PDF · Print / save
                </button>
                <button onClick={() => exportRoster("CSV")}>
                  CSV · Spreadsheet
                </button>
              </div>
            )}
          </div>
          <DataViewToggle
            value={display}
            onChange={setRosterDisplay}
            gridLabel="Roster card grid"
            listLabel="Roster list"
            calendarLabel="Monthly calendar"
            showCalendar
          />
        </div>
        {error && (
          <p className="roster-error">
            <FiAlertCircle />
            {error}
          </p>
        )}
        {notice && (
          <p className="roster-notice">
            <FiCheck />
            {notice}
          </p>
        )}
        {tab === "SUNDAY" && display === "GRID" ? (
          <SundayGrid
            dates={(data?.sundays || []).filter(
              (date) => !sundayFilter || date === sundayFilter,
            )}
            assignments={cellAssignments}
            onAssign={(date, column) => {
              const duty = dutyByCode(column.code);
              const classroom =
                "className" in column
                  ? data?.classes.find((item) => item.name === column.className)
                  : undefined;
              openAssign({
                type: "SUNDAY",
                date,
                serviceType:
                  column.code === "FIRST_SERVICE_TEAM"
                    ? "FIRST_SERVICE"
                    : "SECOND_SERVICE",
                dutyId: duty ? String(duty.id) : "",
                classId: classroom ? String(classroom.id) : "",
              });
            }}
            onTeacher={setTeacherMenu}
            loading={loading}
            readOnly={readOnly}
          />
        ) : tab === "SUNDAY" && display === "LIST" ? (
          <SundayList
            dates={(data?.sundays || []).filter(
              (date) => !sundayFilter || date === sundayFilter,
            )}
            assignments={cellAssignments}
            onAssign={(date, column) => {
              const duty = dutyByCode(column.code);
              const classroom = "className" in column
                ? data?.classes.find((item) => item.name === column.className)
                : undefined;
              openAssign({ type: "SUNDAY", date, serviceType: column.code === "FIRST_SERVICE_TEAM" ? "FIRST_SERVICE" : "SECOND_SERVICE", dutyId: duty ? String(duty.id) : "", classId: classroom ? String(classroom.id) : "" });
            }}
            onTeacher={setTeacherMenu}
            loading={loading}
            readOnly={readOnly}
          />
        ) : tab === "SUNDAY" ? (
          <SundayCalendar
            dates={(data?.sundays || []).filter(
              (date) => !sundayFilter || date === sundayFilter,
            )}
            assignments={cellAssignments}
            onAssign={(date, column) => {
              const duty = dutyByCode(column.code);
              const classroom = "className" in column
                ? data?.classes.find((item) => item.name === column.className)
                : undefined;
              openAssign({ type: "SUNDAY", date, serviceType: column.code === "FIRST_SERVICE_TEAM" ? "FIRST_SERVICE" : "SECOND_SERVICE", dutyId: duty ? String(duty.id) : "", classId: classroom ? String(classroom.id) : "" });
            }}
            onTeacher={setTeacherMenu}
            loading={loading}
            readOnly={readOnly}
            locked={locked}
          />
        ) : display === "GRID" ? (
          <NonTeachingGrid
            dates={datesForNonTeaching}
            assignments={nonTeachingAssignments}
            onAssign={(date, code) => {
              const duty = dutyByCode(code);
              openAssign({
                type: "NON_TEACHING",
                date,
                dutyId: duty ? String(duty.id) : "",
              });
            }}
            onTeacher={setTeacherMenu}
            loading={loading}
            readOnly={readOnly}
            locked={locked}
          />
        ) : display === "LIST" ? (
          <NonTeachingList
            dates={datesForNonTeaching}
            assignments={nonTeachingAssignments}
            onAssign={(date, code) => {
              const duty = dutyByCode(code);
              openAssign({ type: "NON_TEACHING", date, dutyId: duty ? String(duty.id) : "" });
            }}
            onTeacher={setTeacherMenu}
            loading={loading}
            readOnly={readOnly}
          />
        ) : (
          <NonTeachingCalendar
            dates={datesForNonTeaching}
            assignments={nonTeachingAssignments}
            onAssign={(date, code) => {
              const duty = dutyByCode(code);
              openAssign({ type: "NON_TEACHING", date, dutyId: duty ? String(duty.id) : "" });
            }}
            onTeacher={setTeacherMenu}
            loading={loading}
            readOnly={readOnly}
            locked={locked}
          />
        )}
        <footer className="roster-footer">
          <span>
            <FiAlertCircle />
            {locked
              ? "This completed month is read-only."
              : superAdmin
                ? "Click a teacher’s name to view their profile or manage that assignment."
                : "Click a teacher’s name to view their profile, contact them, or view this month’s roster."}
          </span>
          {superAdmin && !locked && (
            <div>
              <button
                className="outline-button"
                disabled={saving}
                onClick={() => void saveState("DRAFT")}
              >
                Save Draft
              </button>
              <button
                className="solid-button"
                disabled={saving}
                onClick={() => setPublishOpen(true)}
              >
                <FiSend />
                Publish Roster &amp; Notify Team
              </button>
            </div>
          )}
        </footer>
      </section>
      {modal && (
        <AssignModal
          modal={modal}
          setModal={setModal}
          duties={data?.duties || []}
          classes={data?.classes || []}
          teachers={data?.teachers || []}
          selectedDuty={selectedDuty}
          selectedTeachers={selectedTeachers}
          teacherSearch={teacherSearch}
          setTeacherSearch={setTeacherSearch}
          conflicts={conflicts}
          saving={saving}
          onClose={() => setModal(null)}
          onSave={saveAssignment}
        />
      )}{" "}
      {teacherMenu && (
        <TeacherProfileModal
          item={teacherMenu}
          assignments={data?.assignments || []}
          isSuperAdmin={superAdmin}
          isSelf={teacherMenu.userId === session?.staffUserId}
          locked={locked}
          onExport={(kind) => exportTeacherRoster(teacherMenu, kind)}
          onNotify={(channel) => sendTeacherReminder(teacherMenu.userId, channel)}
          onClose={() => setTeacherMenu(null)}
          onChange={() => {
            const duty = data?.duties.find(
              (item) => item.code === teacherMenu.dutyCode,
            );
            openAssign({
              type:
                teacherMenu.dutyCategory === "NON_TEACHING"
                  ? "NON_TEACHING"
                  : "SUNDAY",
              date: teacherMenu.assignmentDate,
              serviceType:
                teacherMenu.serviceType === "FIRST_SERVICE"
                  ? "FIRST_SERVICE"
                  : "SECOND_SERVICE",
              dutyId: duty ? String(duty.id) : "",
              classId: teacherMenu.classId ? String(teacherMenu.classId) : "",
              teacherIds: [],
              replaceAssignmentId: teacherMenu.id,
            });
          }}
          onRemove={() => void removeAssignment(teacherMenu)}
        />
      )}{" "}
      {publishOpen && (
        <PublishDialog
          summary={data?.summary}
          teachers={new Set(data?.assignments.map((item) => item.userId)).size}
          saving={saving}
          onClose={() => setPublishOpen(false)}
          onConfirm={() => void saveState("PUBLISHED")}
        />
      )}
      <style jsx>{styles}</style>
      <style jsx global>{`
        .roster-page .roster-card-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:14px}.roster-page .roster-grid-card{overflow:hidden;border:1px solid #e2e7ee;border-radius:11px;background:#fff;box-shadow:0 6px 18px #17284708}.roster-page .roster-grid-card>header{display:flex;align-items:center;justify-content:space-between;padding:15px 16px;border-bottom:1px solid #edf0f4;background:linear-gradient(135deg,#fffaf6,#fff)}.roster-page .roster-grid-card>header span{display:block;color:#7a8799;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.roster-page .roster-grid-card>header h2{margin:4px 0 0;color:#172945;font-size:20px}.roster-page .roster-grid-card>header>i{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#fff0e9;color:#ed5938;font-style:normal}.roster-page .roster-grid-roles{display:grid}.roster-page .roster-grid-roles>section{display:grid;grid-template-columns:minmax(110px,.78fr) minmax(0,1.22fr);align-items:center;gap:11px;min-height:59px;padding:10px 14px;border-top:1px solid #eef1f4}.roster-page .roster-grid-roles>section>div{display:grid;gap:3px}.roster-page .roster-grid-roles b{color:#2a3b57;font-size:11px}.roster-page .roster-grid-roles small{color:#7d889a;font-size:9px}.roster-page .roster-grid-roles em{color:#8b96a6;font-size:10px;font-style:normal;font-weight:800}.roster-page .roster-grid-roles .teachers{gap:3px}.roster-page .roster-grid-roles .teachers button{font-size:10px}.roster-page .roster-grid-roles .teachers img,.roster-page .roster-grid-roles .teachers i{width:23px;height:23px}.roster-page .roster-duty-list{grid-template-columns:1fr}.roster-page .roster-duty-list .roster-day-card{display:grid;grid-template-columns:190px minmax(0,1fr)}.roster-page .roster-duty-list .roster-day-card>header{border-right:1px solid #edf0f3;border-bottom:0}.roster-page .roster-duty-list .roster-duty-items{grid-template-columns:repeat(2,minmax(0,1fr))}.roster-page .roster-duty-list .roster-duty-items>section{grid-template-columns:1fr;gap:6px;padding:11px 13px;border-top:0;border-left:1px solid #eef0f2}.roster-page .roster-duty-list .roster-duty-items>section:nth-child(odd){border-left:0}.roster-page .roster-duty-list .roster-duty-items>section:nth-child(n+3){border-top:1px solid #eef0f2}@media(max-width:900px){.roster-page .roster-card-grid{grid-template-columns:1fr}.roster-page .roster-duty-list .roster-day-card{grid-template-columns:1fr}.roster-page .roster-duty-list .roster-day-card>header{border-right:0;border-bottom:1px solid #edf0f3}}@media(max-width:620px){.roster-page .roster-duty-list .roster-duty-items{grid-template-columns:1fr}.roster-page .roster-duty-list .roster-duty-items>section{border-left:0;border-top:1px solid #eef0f2}.roster-page .roster-grid-roles>section{grid-template-columns:minmax(96px,.75fr) minmax(0,1.25fr)}}
        .teacher-roster-actions{display:grid;gap:9px;padding:0 24px 18px}.roster-share-card,.roster-export-card{width:100%;border:1px solid #dfe6ee;border-radius:9px;background:#fff;display:flex;align-items:center;gap:10px;padding:11px;text-align:left}.roster-share-card{cursor:pointer}.roster-share-card:hover{border-color:#ff6846;background:#fff9f6}.roster-share-card:disabled{cursor:wait;opacity:.7}.roster-share-card>svg{width:31px;height:31px;flex:none;padding:7px;border-radius:8px;background:#e6f8ed;color:#07844f}.roster-share-card.email>svg{background:#edf4ff;color:#2667bf}.roster-share-card.self>svg{background:#fff2dd;color:#ba7500}.roster-share-card span{display:grid;gap:3px}.roster-share-card b,.roster-export-card b{color:#20314d;font-size:11px}.roster-share-card small{color:#718098;font-size:9px}.roster-export-card{justify-content:space-between;background:#fafcff}.roster-export-card>span{display:flex;align-items:center;gap:8px}.roster-export-card>span>svg{color:#536c91}.roster-export-card>div{display:flex;gap:6px}.roster-export-card button{height:30px;border:1px solid #d9e1ec;border-radius:6px;background:#fff;color:#275baf;padding:0 9px;font:800 10px var(--font-body);cursor:pointer}.roster-export-card button:hover{border-color:#ff6846;color:#e54c2a}.roster-delivery-note{margin:0;padding:9px 10px;border-radius:7px;background:#eaf8ef;color:#087753;font-size:10px;line-height:1.4}
        .roster-duty-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px;margin-top:14px}.roster-day-card{border:1px solid #e4e6ea;border-radius:10px;background:#fff;overflow:hidden}.roster-day-card>header{display:flex;align-items:center;justify-content:space-between;padding:14px 15px;border-bottom:1px solid #edf0f3;background:#fffcf8}.roster-day-card>header span{display:block;color:#7a8597;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.roster-day-card>header h2{margin:3px 0 0;color:#152848;font-size:20px}.roster-day-card>header>svg{color:#f15b39;font-size:18px}.roster-duty-items{display:grid}.roster-duty-items>section{display:grid;grid-template-columns:minmax(120px,.85fr) minmax(0,1.25fr);align-items:center;gap:12px;min-height:57px;padding:10px 14px;border-top:1px solid #eef0f2}.roster-duty-items>section:first-child{border-top:0}.roster-duty-items>section>div{display:grid;gap:3px}.roster-duty-items>section b{font-size:11px;color:#293b59}.roster-duty-items>section small{color:#7a879a;font-size:9px}.roster-duty-items em{color:#8a95a6;font-size:10px;font-style:normal;font-weight:800}.roster-duty-items :global(.teachers){gap:3px}.roster-duty-items :global(.teachers button){font-size:10px}.roster-duty-items :global(.teachers img),.roster-duty-items :global(.teachers i){width:23px;height:23px}.list-empty{margin:14px 0 0;padding:32px;border:1px dashed #dce2ea;border-radius:9px;text-align:center;color:#77849a;font-size:12px}.roster-day-card.compact{grid-column:span 1}
        @media(max-width:1024px){.roster-duty-list{grid-template-columns:1fr 1fr}}@media(max-width:680px){.roster-duty-list{grid-template-columns:1fr}.roster-duty-items>section{grid-template-columns:minmax(105px,.75fr) minmax(0,1.25fr);padding:10px 12px}.roster-day-card>header{padding:13px}.roster-day-card>header h2{font-size:18px}}
      `}</style>
    </section>
  );
}

function Stat({
  value,
  label,
  warn,
}: {
  value: number;
  label: string;
  warn?: boolean;
}) {
  return (
    <span className={warn ? "warn" : ""}>
      <b>{value}</b>
      <small>{label}</small>
    </span>
  );
}
function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src ? (
    <img src={`${apiBase}${src}`} alt="" />
  ) : (
    <i>{initials(name)}</i>
  );
}
function Teachers({
  items,
  onTeacher,
}: {
  items: Assignment[];
  onTeacher: (item: Assignment) => void;
}) {
  return (
    <div className="teachers">
      {items.map((item) => (
        <button key={item.id} onClick={() => onTeacher(item)}>
          <Avatar name={item.teacherName} src={item.profileImageUrl} />
          <span>
            {item.teacherName.replace(/^(Uncle|Auntie)\s+/i, "")}
            {item.onboardingStatus === "PROBATION" && (
              <small
                style={{
                  display: "block",
                  width: "max-content",
                  marginTop: 2,
                  padding: "2px 5px",
                  borderRadius: 99,
                  background: "#fff1db",
                  color: "#a96600",
                  fontSize: 8,
                  fontWeight: 900,
                }}
              >
                Probation
              </small>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
function SundayGrid({
  dates,
  assignments,
  onAssign,
  onTeacher,
  loading,
  readOnly,
}: {
  dates: string[];
  assignments: (date: string, column: (typeof sundayColumns)[number]) => Assignment[];
  onAssign: (date: string, column: (typeof sundayColumns)[number]) => void;
  onTeacher: (item: Assignment) => void;
  loading: boolean;
  readOnly: boolean;
}) {
  return (
    <section className="roster-card-grid" aria-label="Sunday duties in card grid view">
      {dates.map((date) => (
        <article key={date} className="roster-grid-card">
          <header>
            <div><span>Sunday duties</span><h2>{formatDate(date)}</h2></div>
            <i><FiCalendar /></i>
          </header>
          <div className="roster-grid-roles">
            {sundayColumns.map((column) => {
              const items = assignments(date, column);
              return <section key={column.label}>
                <div><b>{column.label}</b>{"sub" in column && <small>{column.sub}</small>}</div>
                {items.length ? <Teachers items={items} onTeacher={onTeacher} /> : readOnly ? <em>Unfilled</em> : <button className="cell-assign" onClick={() => onAssign(date, column)}><FiPlus /> Assign</button>}
              </section>;
            })}
          </div>
        </article>
      ))}
      {!dates.length && <p className="list-empty">{loading ? "Loading monthly duties…" : "No Sunday duties match these filters."}</p>}
    </section>
  );
}

function SundayCalendar({
  dates,
  assignments,
  onAssign,
  onTeacher,
  loading,
  readOnly,
  locked,
}: {
  dates: string[];
  assignments: (
    date: string,
    column: (typeof sundayColumns)[number],
  ) => Assignment[];
  onAssign: (date: string, column: (typeof sundayColumns)[number]) => void;
  onTeacher: (item: Assignment) => void;
  loading: boolean;
  readOnly: boolean;
  locked: boolean;
}) {
  return (
    <div className="grid-wrap">
      <div className="grid-title">
        <h2>
          Sunday Duties ·{" "}
          {dates.length
            ? formatDate(`${dates[0].slice(0, 7)}-01`).replace(/^1\s/, "")
            : ""}
        </h2>
        <p>{dates.length} Sundays · 8 roles per Sunday</p>
      </div>
      <table className="monthly-grid">
        <thead>
          <tr>
            <th>Date</th>
            {sundayColumns.map((column) => (
              <th key={column.label}>
                {column.label}
                {"sub" in column && <small>{column.sub}</small>}
              </th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => (
            <tr key={date} className={locked ? "locked-row" : ""}>
              <td>
                <b>{formatDate(date).replace(" ", "\n")}</b>
              </td>
              {sundayColumns.map((column) => {
                const items = assignments(date, column);
                return (
                  <td key={column.label}>
                    {items.length ? (
                      <Teachers items={items} onTeacher={onTeacher} />
                    ) : readOnly ? (
                      <span className="cell-unfilled">Unfilled</span>
                    ) : (
                      <button
                        className="cell-assign"
                        onClick={() => onAssign(date, column)}
                      >
                        <FiPlus />
                        Assign
                      </button>
                    )}
                  </td>
                );
              })}
              <td>
                {!locked && (
                  <button
                    className="row-more"
                    aria-label={`Manage ${formatDate(date)} duties`}
                  >
                    <FiMoreVertical />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!dates.length && (
            <tr>
              <td colSpan={sundayColumns.length + 2} className="empty">
                {loading
                  ? "Loading monthly duties…"
                  : "No Sunday duties match these filters."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function SundayList({
  dates,
  assignments,
  onAssign,
  onTeacher,
  loading,
  readOnly,
}: {
  dates: string[];
  assignments: (date: string, column: (typeof sundayColumns)[number]) => Assignment[];
  onAssign: (date: string, column: (typeof sundayColumns)[number]) => void;
  onTeacher: (item: Assignment) => void;
  loading: boolean;
  readOnly: boolean;
}) {
  return (
    <div className="roster-duty-list" aria-label="Sunday duties in list view">
      {dates.map((date) => (
        <article key={date} className="roster-day-card">
          <header><div><span>Sunday</span><h2>{formatDate(date)}</h2></div><FiCalendar /></header>
          <div className="roster-duty-items">
            {sundayColumns.map((column) => {
              const items = assignments(date, column);
              return <section key={column.label}>
                <div><b>{column.label}</b>{"sub" in column && <small>{column.sub}</small>}</div>
                {items.length ? <Teachers items={items} onTeacher={onTeacher} /> : readOnly ? <em>Unfilled</em> : <button className="cell-assign" onClick={() => onAssign(date, column)}><FiPlus />Assign</button>}
              </section>;
            })}
          </div>
        </article>
      ))}
      {!dates.length && <p className="list-empty">{loading ? "Loading monthly duties…" : "No Sunday duties match these filters."}</p>}
    </div>
  );
}
function NonTeachingGrid({
  dates,
  assignments,
  onAssign,
  onTeacher,
  loading,
  readOnly,
}: {
  dates: string[];
  assignments: (date: string, code: string) => Assignment[];
  onAssign: (date: string, code: string) => void;
  onTeacher: (item: Assignment) => void;
  loading: boolean;
  readOnly: boolean;
  locked: boolean;
}) {
  const duties = [
    { label: "Prayers", code: "PRAYERS" },
    { label: "Lesson Plan Review", code: "LESSON_PLAN_REVIEW" },
  ];
  return (
    <section className="roster-card-grid non-teaching-cards" aria-label="Non-teaching duties in card grid view">
      {dates.map((date) => <article key={date} className="roster-grid-card">
        <header><div><span>Weekday duty</span><h2>{formatDate(date)}</h2></div><i><FiBookOpen /></i></header>
        <div className="roster-grid-roles">{duties.map((duty) => {
          const items = assignments(date, duty.code);
          return <section key={duty.code}><div><b>{duty.label}</b></div>{items.length ? <Teachers items={items} onTeacher={onTeacher} /> : readOnly ? <em>Unfilled</em> : <button className="cell-assign" onClick={() => onAssign(date, duty.code)}><FiPlus /> Assign</button>}</section>;
        })}</div>
      </article>)}
      {!dates.length && <p className="list-empty">{loading ? "Loading duties…" : "No non-teaching duties are scheduled yet."}</p>}
    </section>
  );
}

function NonTeachingCalendar({
  dates,
  assignments,
  onAssign,
  onTeacher,
  loading,
  readOnly,
  locked,
}: {
  dates: string[];
  assignments: (date: string, code: string) => Assignment[];
  onAssign: (date: string, code: string) => void;
  onTeacher: (item: Assignment) => void;
  loading: boolean;
  readOnly: boolean;
  locked: boolean;
}) {
  return (
    <div className="grid-wrap">
      <div className="grid-title">
        <h2>Non-Teaching Duties</h2>
        <p>Prayers and lesson plan review every Thursday and Saturday</p>
      </div>
      <table className="monthly-grid non-teaching">
        <thead>
          <tr>
            <th>Date</th>
            <th>Prayers</th>
            <th>Lesson Plan Review</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => (
            <tr key={date} className={locked ? "locked-row" : ""}>
              <td>
                <b>{formatDate(date)}</b>
              </td>
              {["PRAYERS", "LESSON_PLAN_REVIEW"].map((code) => {
                const items = assignments(date, code);
                return (
                  <td key={code}>
                    {items.length ? (
                      <Teachers items={items} onTeacher={onTeacher} />
                    ) : readOnly ? (
                      <span className="cell-unfilled">Unfilled</span>
                    ) : (
                      <button
                        className="cell-assign"
                        onClick={() => onAssign(date, code)}
                      >
                        <FiPlus />
                        Assign
                      </button>
                    )}
                  </td>
                );
              })}
              <td>
                {!locked && (
                  <button className="row-more">
                    <FiMoreVertical />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!dates.length && (
            <tr>
              <td colSpan={4} className="empty">
                {loading
                  ? "Loading duties…"
                  : "No non-teaching duties are scheduled yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function NonTeachingList({
  dates,
  assignments,
  onAssign,
  onTeacher,
  loading,
  readOnly,
}: {
  dates: string[];
  assignments: (date: string, code: string) => Assignment[];
  onAssign: (date: string, code: string) => void;
  onTeacher: (item: Assignment) => void;
  loading: boolean;
  readOnly: boolean;
}) {
  const duties = [
    { label: "Prayers", code: "PRAYERS" },
    { label: "Lesson Plan Review", code: "LESSON_PLAN_REVIEW" },
  ];
  return (
    <div className="roster-duty-list" aria-label="Non-teaching duties in list view">
      {dates.map((date) => <article key={date} className="roster-day-card compact">
        <header><div><span>Weekday duty</span><h2>{formatDate(date)}</h2></div><FiBookOpen /></header>
        <div className="roster-duty-items">{duties.map((duty) => {
          const items = assignments(date, duty.code);
          return <section key={duty.code}><div><b>{duty.label}</b></div>{items.length ? <Teachers items={items} onTeacher={onTeacher} /> : readOnly ? <em>Unfilled</em> : <button className="cell-assign" onClick={() => onAssign(date, duty.code)}><FiPlus />Assign</button>}</section>;
        })}</div>
      </article>)}
      {!dates.length && <p className="list-empty">{loading ? "Loading duties…" : "No non-teaching duties are scheduled yet."}</p>}
    </div>
  );
}
function AssignModal({
  modal,
  setModal,
  duties,
  classes,
  teachers,
  selectedDuty,
  selectedTeachers,
  teacherSearch,
  setTeacherSearch,
  conflicts,
  saving,
  onClose,
  onSave,
}: {
  modal: ModalState;
  setModal: (value: ModalState) => void;
  duties: Duty[];
  classes: ClassRoom[];
  teachers: Teacher[];
  selectedDuty?: Duty;
  selectedTeachers: Teacher[];
  teacherSearch: string;
  setTeacherSearch: (value: string) => void;
  conflicts: (id: number) => Assignment[];
  saving: boolean;
  onClose: () => void;
  onSave: (event: FormEvent) => void;
}) {
  const availableDuties = duties.filter((item) =>
    modal.type === "SUNDAY"
      ? item.category !== "NON_TEACHING"
      : item.category === "NON_TEACHING",
  );
  const found = teachers.filter((item) =>
    item.name.toLowerCase().includes(teacherSearch.toLowerCase()),
  );
  const toggle = (id: number) =>
    setModal({
      ...modal,
      teacherIds: modal.teacherIds.includes(id)
        ? modal.teacherIds.filter((item) => item !== id)
        : [...modal.teacherIds, id],
    });
  return (
    <div className="modal-backdrop">
      <form className="assign-modal" onSubmit={onSave}>
        <button type="button" className="modal-close" onClick={onClose}>
          <FiX />
        </button>
        <header>
          <FiUsers />
          <div>
            <h2>Assign Duty</h2>
            <p>Assign a teacher to a Sunday duty or non-teaching activity.</p>
          </div>
        </header>
        <div className="assign-body">
          <div className="assign-fields">
            <label>Assignment Type</label>
            <div className="type-switch">
              <button
                type="button"
                className={modal.type === "SUNDAY" ? "selected" : ""}
                onClick={() =>
                  setModal({
                    ...modal,
                    type: "SUNDAY",
                    dutyId: "",
                    classId: "",
                  })
                }
              >
                <FiCalendar />
                Sunday Duty
              </button>
              <button
                type="button"
                className={modal.type === "NON_TEACHING" ? "selected" : ""}
                onClick={() =>
                  setModal({
                    ...modal,
                    type: "NON_TEACHING",
                    dutyId: "",
                    classId: "",
                  })
                }
              >
                <FiBookOpen />
                Non-Teaching Duty
              </button>
            </div>
            <label>
              {modal.type === "SUNDAY" ? "Sunday Date" : "Thursday or Saturday"}
              <input
                required
                type="date"
                value={modal.date}
                onChange={(event) =>
                  setModal({ ...modal, date: event.target.value })
                }
              />
              {modal.type === "NON_TEACHING" && (
                <small>
                  Non-teaching duties can only be scheduled on Thursdays and
                  Saturdays.
                </small>
              )}
            </label>
            {modal.type === "SUNDAY" && (
              <div className="pair">
                <label>
                  Service
                  <select
                    value={modal.serviceType}
                    onChange={(event) =>
                      setModal({
                        ...modal,
                        serviceType: event.target
                          .value as ModalState["serviceType"],
                      })
                    }
                  >
                    <option value="FIRST_SERVICE">First Service</option>
                    <option value="SECOND_SERVICE">Second Service</option>
                  </select>
                </label>
                <label>
                  Duty
                  <select
                    required
                    value={modal.dutyId}
                    onChange={(event) =>
                      setModal({
                        ...modal,
                        dutyId: event.target.value,
                        classId: "",
                      })
                    }
                  >
                    <option value="">Choose duty</option>
                    {availableDuties.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {modal.type === "NON_TEACHING" && (
              <label>
                Duty
                <select
                  required
                  value={modal.dutyId}
                  onChange={(event) =>
                    setModal({ ...modal, dutyId: event.target.value })
                  }
                >
                  <option value="">Choose duty</option>
                  {availableDuties.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selectedDuty?.requiresClass && (
              <label>
                Class
                <select
                  required
                  value={modal.classId}
                  onChange={(event) =>
                    setModal({ ...modal, classId: event.target.value })
                  }
                >
                  <option value="">Choose class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>Assign Teacher(s)</label>
            <label className="teacher-search">
              <FiSearch />
              <input
                value={teacherSearch}
                onChange={(event) => setTeacherSearch(event.target.value)}
                placeholder="Search teacher by name…"
              />
            </label>
            <div className="teacher-picker">
              {found.map((teacher) => {
                const issue = conflicts(teacher.id)[0];
                const selected = modal.teacherIds.includes(teacher.id);
                return (
                  <button
                    type="button"
                    key={teacher.id}
                    className={selected ? "checked" : ""}
                    onClick={() => toggle(teacher.id)}
                  >
                    <i>{selected ? <FiCheck /> : null}</i>
                    <Avatar name={teacher.name} src={teacher.profileImageUrl} />
                    <span>
                      <b>{teacher.name}</b>
                      <small>
                        {teacher.accessLevel === "TPK_SUPER_ADMIN"
                          ? "TPK Super Admin"
                          : "TPK Admin"}{" "}
                        ·{" "}
                        {teacher.teamStatus[0] +
                          teacher.teamStatus.slice(1).toLowerCase()}
                      </small>
                    </span>
                    <em
                      className={
                        issue
                          ? "conflict"
                          : teacher.teamStatus === "PROBATION"
                            ? "probation"
                            : "available"
                      }
                    >
                      {issue
                        ? `Already assigned · ${issue.dutyName} · ${formatDate(issue.assignmentDate)}`
                        : teacher.teamStatus === "PROBATION"
                          ? "Probation"
                          : "Available"}
                    </em>
                  </button>
                );
              })}
            </div>
            <small className="selection-count">
              {modal.teacherIds.length} teacher
              {modal.teacherIds.length === 1 ? "" : "s"} selected. Conflicts are
              shown for review; permitted overlaps can still be assigned.
            </small>
          </div>
          <aside className="assignment-preview">
            <h3>Assignment Preview</h3>
            <p>
              <FiCalendar />
              {modal.date
                ? new Intl.DateTimeFormat("en-NG", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(`${modal.date}T00:00:00Z`))
                : "Choose a date"}
            </p>
            {modal.type === "SUNDAY" && (
              <p>
                <FiUsers />
                {modal.serviceType === "FIRST_SERVICE"
                  ? "First Service"
                  : "Second Service"}
              </p>
            )}
            <p>
              <FiBookOpen />
              {selectedDuty?.name || "Choose a duty"}
              {selectedDuty?.requiresClass && modal.classId
                ? ` · ${classes.find((item) => item.id === Number(modal.classId))?.name || ""}`
                : ""}
            </p>
            <div>
              {selectedTeachers.length ? (
                selectedTeachers.map((teacher) => (
                  <span key={teacher.id}>
                    <Avatar name={teacher.name} src={teacher.profileImageUrl} />
                    <b>{teacher.name}</b>
                    <button type="button" onClick={() => toggle(teacher.id)}>
                      <FiX />
                    </button>
                  </span>
                ))
              ) : (
                <small>No teachers selected yet.</small>
              )}
            </div>
          </aside>
        </div>
        <footer>
          <button className="outline-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="solid-button"
            disabled={
              saving ||
              !modal.dutyId ||
              !modal.teacherIds.length ||
              !modal.date ||
              Boolean(selectedDuty?.requiresClass && !modal.classId)
            }
          >
            {saving ? "Assigning…" : "Assign Duty"}
          </button>
        </footer>
      </form>
    </div>
  );
}
function TeacherProfileModal({
  item,
  assignments,
  isSuperAdmin,
  isSelf,
  locked,
  onExport,
  onNotify,
  onClose,
  onChange,
  onRemove,
}: {
  item: Assignment;
  assignments: Assignment[];
  isSuperAdmin: boolean;
  isSelf: boolean;
  locked: boolean;
  onExport: (kind: "CSV" | "PDF") => void;
  onNotify: (channel: "IN_APP" | "WHATSAPP" | "EMAIL") => Promise<string>;
  onClose: () => void;
  onChange: () => void;
  onRemove: () => void;
}) {
  const [tab, setTab] = useState<"PROFILE" | "ROSTER">("PROFILE");
  const [deliveryBusy, setDeliveryBusy] = useState<"" | "IN_APP" | "WHATSAPP" | "EMAIL">("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const phone = item.whatsappNumber || item.mobileNumber || "";
  const phoneDigits = phone.replace(/\D/g, "");
  const teacherAssignments = assignments
    .filter((assignment) => assignment.userId === item.userId)
    .sort((a, b) => a.assignmentDate.localeCompare(b.assignmentDate));
  const sendReminder = async (channel: "IN_APP" | "WHATSAPP" | "EMAIL") => {
    setDeliveryBusy(channel);
    setDeliveryNote("");
    try {
      setDeliveryNote(await onNotify(channel));
    } catch (reason) {
      setDeliveryNote(
        reason instanceof Error ? reason.message : "We could not send that reminder.",
      );
    } finally {
      setDeliveryBusy("");
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        className="teacher-profile-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose}>
          <FiX />
        </button>
        <header>
          <Avatar name={item.teacherName} src={item.profileImageUrl} />
          <div>
            <h2>{item.teacherName}</h2>
            <p>
              TPK Teacher{" "}
              {item.onboardingStatus === "PROBATION" && <span>Probation</span>}
            </p>
          </div>
        </header>
        <nav>
          <button
            className={tab === "PROFILE" ? "active" : ""}
            onClick={() => setTab("PROFILE")}
          >
            Profile
          </button>
          <button
            className={tab === "ROSTER" ? "active" : ""}
            onClick={() => setTab("ROSTER")}
          >
            This month&apos;s roster ({teacherAssignments.length})
          </button>
        </nav>
        {tab === "PROFILE" ? (
          <div className="teacher-profile-content">
            <p className="teacher-duty">
              <FiCalendar />
              {item.dutyName} · {formatDate(item.assignmentDate)}
            </p>
            {phone ? (
              <div className="contact-actions">
                <a href={`tel:${phoneDigits}`}>
                  <FiPhone />
                  Call
                </a>
                <a
                  href={`https://wa.me/${phoneDigits}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </div>
            ) : (
              <p className="no-contact">
                No phone number has been recorded yet.
              </p>
            )}
            <a
              className="team-profile-link"
              href={`/account/team?member=${item.userId}`}
            >
              Open full team profile
            </a>
          </div>
        ) : (
          <>
            <div className="teacher-roster-list">
              {teacherAssignments.length ? (
                teacherAssignments.map((assignment) => (
                  <div key={assignment.id}>
                    <b>{formatDate(assignment.assignmentDate)}</b>
                    <span>
                      {assignment.dutyName}
                      {assignment.className ? ` · ${assignment.className}` : ""}
                    </span>
                    <small>{assignment.serviceName || "Non-teaching duty"}</small>
                  </div>
                ))
              ) : (
                <p>No assignments for this month.</p>
              )}
            </div>
            {(isSuperAdmin || isSelf) && teacherAssignments.length > 0 && (
              <section className="teacher-roster-actions" aria-label="Roster sharing actions">
                {isSuperAdmin ? (
                  <>
                    <button
                      className="roster-share-card whatsapp"
                      disabled={Boolean(deliveryBusy)}
                      onClick={() => void sendReminder("WHATSAPP")}
                    >
                      <FiMessageCircle />
                      <span><b>{deliveryBusy === "WHATSAPP" ? "Sending WhatsApp…" : "Send to teacher on WhatsApp"}</b><small>They will also receive an in-app reminder.</small></span>
                    </button>
                    <button
                      className="roster-share-card email"
                      disabled={Boolean(deliveryBusy)}
                      onClick={() => void sendReminder("EMAIL")}
                    >
                      <FiMail />
                      <span><b>{deliveryBusy === "EMAIL" ? "Sending email…" : "Send to teacher’s email"}</b><small>Shares their monthly roles and board link.</small></span>
                    </button>
                  </>
                ) : (
                  <button
                    className="roster-share-card self"
                    disabled={Boolean(deliveryBusy)}
                    onClick={() => void sendReminder("IN_APP")}
                  >
                    <FiCheck />
                    <span><b>{deliveryBusy === "IN_APP" ? "Sending reminder…" : "Remind me in TPK"}</b><small>Adds this month’s roles to your notifications.</small></span>
                  </button>
                )}
                <div className="roster-export-card">
                  <span><FiDownload /><b>Export this teacher’s roles</b></span>
                  <div><button onClick={() => onExport("PDF")}>PDF</button><button onClick={() => onExport("CSV")}>CSV</button></div>
                </div>
                {deliveryNote && <p className="roster-delivery-note">{deliveryNote}</p>}
              </section>
            )}
          </>
        )}
        {isSuperAdmin && !locked && (
          <footer>
            <button className="outline-button" onClick={onChange}>
              Change assignment
            </button>
            <button className="danger-button" onClick={onRemove}>
              Unassign from duty
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
function PublishDialog({
  summary,
  teachers,
  saving,
  onClose,
  onConfirm,
}: {
  summary?: Management["summary"];
  teachers: number;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section className="publish-dialog">
        <FiSend />
        <h2>Publish this roster?</h2>
        <p>
          {summary?.assignments || 0} assignments for {teachers} teacher
          {teachers === 1 ? "" : "s"} will be published and sent by WhatsApp.
          Each teacher receives their roles and a link to view their monthly
          roster and team.
        </p>
        {Boolean(summary?.unfilled) && (
          <p className="unfilled-note">
            <FiAlertCircle />
            {summary?.unfilled} duty{" "}
            {summary?.unfilled === 1 ? "remains" : "duties remain"} unfilled.
            You can still publish, but the gaps will stay visible.
          </p>
        )}
        <div>
          <button className="outline-button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="solid-button"
            disabled={saving}
            onClick={onConfirm}
          >
            {saving ? "Publishing…" : "Publish & Notify Team"}
          </button>
        </div>
      </section>
    </div>
  );
}
const styles = `.roster-page{max-width:1540px}.roster-page h1,.roster-page h2,.roster-page h3{font-family:var(--font-display),Georgia,serif}.roster-heading{margin:4px 0 20px}.roster-heading h1{margin:7px 0 5px;font-size:40px;letter-spacing:-1.35px}.roster-heading .intro{margin:0;color:#647088;font-size:17px}.month-bar{display:flex;align-items:center;gap:18px;margin-bottom:22px}.month-nav{height:45px;display:flex;border:1px solid #dfe2e8;border-radius:8px;overflow:hidden;background:#fff}.month-nav button{width:43px;border:0;background:#fff;color:#263650;display:grid;place-items:center;cursor:pointer}.month-nav button+span{border-left:1px solid #e4e5e8;border-right:1px solid #e4e5e8}.month-nav span{min-width:210px;display:flex;align-items:center;justify-content:center;gap:15px;font:700 18px var(--font-display),Georgia,serif}.roster-state{display:inline-flex;align-items:center;gap:8px;border-radius:8px;padding:10px 15px;background:#fff5df;color:#765119;font-size:12px;font-weight:900}.roster-state i{width:10px;height:10px;border-radius:50%;background:#e99a08;box-shadow:0 0 0 3px #fff0c9}.roster-state.published{background:#e8f7ed;color:#0b7950}.roster-state.published i{background:#159664;box-shadow:0 0 0 3px #d7f0e1}.month-stats{margin-left:auto;display:flex}.month-stats span{min-width:88px;padding:0 15px;border-right:1px solid #e2e2e2;display:grid;justify-items:center;gap:4px}.month-stats b{font-size:20px;line-height:1}.month-stats small{font-size:10px;color:#65718a}.month-stats .warn b,.month-stats .warn small{color:#ef4f2e}.assign-main{height:45px;padding:0 19px;display:flex;align-items:center;gap:9px}.roster-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:0}.roster-tabs button{min-height:67px;border:1px solid #e2e0db;border-bottom:0;border-radius:9px 9px 0 0;background:#fffdfa;color:#1d2e4b;display:flex;align-items:center;gap:15px;padding:13px 24px;text-align:left;cursor:pointer}.roster-tabs button.active{border-color:#ff5c34;border-top:3px solid #ff5c34;background:#fffdf9}.roster-tabs>button>svg{font-size:25px;color:#ff5734}.roster-tabs span{display:grid;gap:4px}.roster-tabs b{font:700 17px var(--font-display),Georgia,serif}.roster-tabs small{font-size:11px;color:#67738b}.roster-panel{border:1px solid #e6e2dc;border-radius:0 0 10px 10px;background:#fffdfa;padding:14px 15px 15px}.roster-tools{display:grid;grid-template-columns:minmax(250px,1.6fr) repeat(3,minmax(130px,.58fr)) auto;gap:11px}.search,.teacher-search{height:44px;display:flex;align-items:center;gap:10px;padding:0 13px;border:1px solid #d9dfe8;border-radius:8px;background:#fff;color:#6b7890}.search input,.teacher-search input{width:100%;border:0;outline:0;background:transparent;font:600 12px var(--font-body)}.roster-tools select{height:44px;border:1px solid #d9dfe8;border-radius:8px;background:#fff;padding:0 10px;color:#263550;font:700 11px var(--font-body)}.export-wrap{position:relative}.export-button{height:44px;border:1px solid #d9dfe8;border-radius:8px;background:#fff;padding:0 15px;color:#263550;font:800 11px var(--font-body);display:flex;align-items:center;gap:9px;cursor:pointer}.export-menu{position:absolute;z-index:20;right:0;top:50px;min-width:170px;padding:5px;background:#fff;border:1px solid #d9dfe8;border-radius:8px;box-shadow:0 12px 25px #18223d19}.export-menu button{display:block;width:100%;padding:10px;border:0;background:transparent;text-align:left;font:700 11px var(--font-body);cursor:pointer}.export-menu button:hover{background:#fff2eb;color:#de4d2e}.roster-error,.roster-notice{display:flex;align-items:center;gap:7px;margin:12px 0 0;padding:10px 12px;border-radius:7px;font-size:11px}.roster-error{background:#fff0eb;color:#c6442d}.roster-notice{background:#eaf8ef;color:#087753}.grid-wrap{margin-top:14px;border:1px solid #e7e4df;border-radius:9px;overflow:auto}.grid-title{padding:15px 17px;border-bottom:1px solid #e7e4df}.grid-title h2{margin:0;font-size:20px}.grid-title p{margin:4px 0 0;color:#748098;font-size:11px}.monthly-grid{width:100%;min-width:1120px;border-collapse:collapse}.monthly-grid th{padding:11px 12px;background:#f8f7f4;color:#53617d;text-align:left;font-size:10px;font-weight:900;border-right:1px solid #e4e5e6;white-space:nowrap}.monthly-grid th small{display:block;margin-top:3px;color:#7a869b;font-size:10px;font-weight:700}.monthly-grid td{height:88px;min-width:122px;padding:9px 10px;vertical-align:top;border-right:1px solid #e7e6e2;border-top:1px solid #e7e6e2;color:#233451;font-size:11px}.monthly-grid td:first-child{min-width:65px;background:#fcfaf6}.monthly-grid td:first-child b{white-space:pre-line;line-height:1.4}.monthly-grid th:last-child,.monthly-grid td:last-child{min-width:60px;width:60px;border-right:0;text-align:center}.monthly-grid.non-teaching{min-width:680px}.teachers{display:grid;gap:5px}.teachers button{border:0;background:transparent;padding:0;display:flex;align-items:center;gap:6px;text-align:left;color:#1f3151;font:700 11px var(--font-body);cursor:pointer}.teachers button:hover span{text-decoration:underline;color:#df4a2d}.teachers img,.teachers i{width:26px;height:26px;flex:none;border-radius:50%;object-fit:cover;display:grid;place-items:center;background:#e8effb;color:#2c66a7;font-size:9px;font-style:normal;font-weight:900}.cell-assign{display:inline-flex;align-items:center;gap:5px;border:0;border-radius:6px;padding:7px 8px;background:#fff1ea;color:#e94f2e;font:800 10px var(--font-body);cursor:pointer}.cell-assign:hover{background:#ffe4d9}.row-more{width:35px;height:35px;border:1px solid #dfe2e7;border-radius:7px;background:#fff;color:#42516b;cursor:pointer}.empty{text-align:center!important;color:#748098!important;padding:28px!important}.roster-footer{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-top:15px}.roster-footer>span{display:flex;align-items:center;gap:8px;color:#6f7c94;font-size:11px}.roster-footer>div{display:flex;gap:10px}.roster-footer button{height:42px}.roster-footer .solid-button{display:flex;align-items:center;gap:8px}.modal-backdrop{position:fixed;z-index:100;inset:0;display:grid;place-items:center;padding:20px;background:#08172f88}.assign-modal{position:relative;width:min(100%,930px);max-height:92vh;overflow:auto;border-radius:12px;background:#fffdfa;box-shadow:0 24px 80px #07162a55}.assign-modal>header{display:flex;align-items:center;gap:14px;padding:21px 25px 15px;border-bottom:1px solid #ebe6de}.assign-modal>header>svg{font-size:29px;color:#ff5634}.assign-modal h2{margin:0;font-size:23px}.assign-modal header p{margin:4px 0 0;color:#68758d;font-size:11px}.modal-close{position:absolute;right:16px;top:15px;border:0;background:transparent;color:#36445e;font-size:20px;cursor:pointer}.assign-body{display:grid;grid-template-columns:1.45fr .8fr;gap:18px;padding:18px 20px}.assign-fields{display:grid;gap:9px}.assign-fields>label:not(.teacher-search){display:grid;gap:6px;color:#39475f;font-size:11px;font-weight:800}.assign-fields input,.assign-fields select{height:40px;border:1px solid #d9dfe8;border-radius:7px;background:#fff;padding:0 10px;font:12px var(--font-body)}.type-switch{display:grid;grid-template-columns:1fr 1fr}.type-switch button{height:38px;border:1px solid #d9dfe8;background:#fff;color:#3e4b62;font:800 11px var(--font-body);display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}.type-switch button:first-child{border-radius:7px 0 0 7px}.type-switch button:last-child{border-radius:0 7px 7px 0}.type-switch button.selected{border-color:#ff5634;background:#fff7f3;color:#f14d2d}.pair{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pair label{display:grid;gap:6px;color:#39475f;font-size:11px;font-weight:800}.teacher-picker{max-height:280px;overflow:auto;border:1px solid #e1e3e8;border-radius:8px;background:#fff}.teacher-picker>button{width:100%;min-height:51px;padding:6px 9px;border:0;border-bottom:1px solid #edf0f2;background:#fff;display:flex;align-items:center;gap:8px;text-align:left;cursor:pointer}.teacher-picker>button.checked{background:#fff9f5}.teacher-picker>button>i{width:16px;height:16px;border:1px solid #cbd3df;border-radius:4px;display:grid;place-items:center;flex:none;color:#fff;font-size:12px;font-style:normal}.teacher-picker>button.checked>i{border-color:#ff5634;background:#ff5634}.teacher-picker img,.teacher-picker>button>i+img,.teacher-picker>button>i+ i{width:30px;height:30px;border-radius:50%;object-fit:cover}.teacher-picker>button>i+ i{display:grid;place-items:center;background:#e9effa;color:#2c66a7;font-size:9px;font-style:normal;font-weight:900}.teacher-picker span{display:grid;gap:3px;min-width:0;flex:1}.teacher-picker b{font-size:11px}.teacher-picker small{color:#69758c;font-size:10px}.teacher-picker em{max-width:125px;padding:5px 7px;border-radius:99px;text-align:center;font-size:9px;font-style:normal;font-weight:800}.teacher-picker em.available{background:#e8f8ed;color:#11804e}.teacher-picker em.probation{background:#fff1dc;color:#a96800}.teacher-picker em.conflict{background:#f1f2f6;color:#516078}.selection-count{color:#63718a;font-size:10px}.assignment-preview{align-self:stretch;padding:16px;border-radius:8px;background:#fbf8f2}.assignment-preview h3{margin:0 0 15px;font-size:17px}.assignment-preview>p{display:flex;align-items:center;gap:9px;margin:11px 0;color:#52617b;font-size:11px}.assignment-preview>p svg{color:#667794}.assignment-preview>div{display:grid;gap:7px;margin-top:22px}.assignment-preview>div>span{display:flex;align-items:center;gap:7px;padding:7px;border-radius:7px;background:#fff}.assignment-preview img,.assignment-preview>div>span>i,.teacher-menu>i{width:28px;height:28px;border-radius:50%;object-fit:cover}.assignment-preview>div>span>i,.teacher-menu>i{display:grid;place-items:center;background:#e9effa;color:#2c66a7;font-size:9px;font-style:normal;font-weight:900}.assignment-preview b{font-size:10px;flex:1}.assignment-preview span button{border:0;background:transparent;color:#68758b;cursor:pointer}.assignment-preview>div>small{color:#758198;font-size:11px}.assign-modal>footer{display:flex;justify-content:flex-end;gap:10px;padding:15px 20px;border-top:1px solid #ebe6de}.assign-modal>footer button{min-width:108px;height:40px}.teacher-menu-backdrop{align-items:end;justify-items:start;padding:0 0 28px 300px;background:transparent}.teacher-menu{position:relative;width:260px;padding:18px;border:1px solid #e2e4e9;border-radius:10px;background:#fff;box-shadow:0 18px 45px #10213d30;display:grid;gap:7px}.teacher-menu>img{width:38px;height:38px;border-radius:50%;object-fit:cover}.teacher-menu>b{font-size:14px}.teacher-menu small{color:#6d7a90;font-size:10px}.teacher-menu a,.teacher-menu>button:not(.modal-close){padding:8px 0;border:0;background:transparent;color:#263550;text-align:left;font:700 11px var(--font-body);text-decoration:none;cursor:pointer}.teacher-menu a:hover,.teacher-menu>button:not(.modal-close):hover{color:#e24c2d}.teacher-menu .remove{color:#ce452d!important}.publish-dialog{width:min(100%,430px);padding:28px;border-radius:12px;background:#fffdfa;box-shadow:0 20px 60px #07162a55}.publish-dialog>svg{font-size:34px;color:#ff5634}.publish-dialog h2{margin:12px 0 6px;font-size:27px}.publish-dialog p{color:#61708a;font-size:12px;line-height:1.55}.unfilled-note{display:flex;gap:8px;padding:10px;border-radius:7px;background:#fff3de;color:#9b6300}.publish-dialog>div{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.publish-dialog button{height:40px}@media(max-width:1160px){.month-bar{flex-wrap:wrap}.month-stats{margin-left:0}.roster-tools{grid-template-columns:1fr 1fr 1fr}.search{grid-column:span 2}.export-wrap{justify-self:end}}@media(max-width:850px){.month-stats{width:100%;justify-content:space-between}.month-stats span{flex:1}.assign-body{grid-template-columns:1fr}.assignment-preview{order:-1}.teacher-menu-backdrop{padding-left:20px}.roster-tabs{grid-template-columns:1fr}.roster-tabs button{border-bottom:1px solid #e2e0db;border-radius:9px}.roster-panel{border-radius:10px;margin-top:10px}}@media(max-width:560px){.roster-heading h1{font-size:34px}.month-nav{width:100%}.month-nav span{flex:1;min-width:0;font-size:16px}.month-stats span{min-width:0;padding:0 5px}.month-stats b{font-size:17px}.month-stats small{font-size:8px}.assign-main{width:100%;justify-content:center}.roster-tools{grid-template-columns:1fr}.search{grid-column:auto}.export-wrap{justify-self:stretch}.export-button{width:100%;justify-content:center}.roster-footer{display:grid}.roster-footer>div{display:grid}.roster-footer button{width:100%}.pair{grid-template-columns:1fr}.assign-body{padding:16px}.type-switch{grid-template-columns:1fr}.type-switch button{border-radius:7px!important}.teacher-picker em{display:none}}`;

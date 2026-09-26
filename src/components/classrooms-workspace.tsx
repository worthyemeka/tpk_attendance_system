"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClipboard,
  FiFileText,
  FiFilter,
  FiMessageCircle,
  FiSearch,
  FiUsers,
} from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { StatCard, type StatCardTone } from "@/components/stat-card";
import "./classroom-refinements.css";
import {
  readActiveService,
  subscribeToActiveService,
  type ActiveService,
} from "@/lib/active-service";

type Teacher = {
  userId: number;
  name: string;
  dutyName?: string;
  status: string;
  profileImageUrl?: string;
  whatsappNumber?: string;
  mobileNumber?: string;
};
type Classroom = {
  id: number;
  name: string;
  ageLabel?: string;
  minAge?: number;
  maxAge?: number;
  registered: number;
  present: number;
  absent: number;
  attendancePercentage: number;
  teachers: Teacher[];
  teacherCount: number;
  status: string;
};
type Overview = {
  serviceSession?: { id: number; name: string; serviceDate: string } | null;
  summary: {
    activeClasses: number;
    checkedIn: number;
    teachersAssigned: number;
  };
  items: Classroom[];
};
type ServiceWeek = { id: number; name: string; serviceType: string; serviceDate: string };
type Child = {
  id: number;
  firstName: string;
  lastName: string;
  age?: number;
  guardianId?: number;
  guardianName?: string;
  guardianPhone?: string;
  todayStatus: string;
  assignmentStatus: string;
  joinedAt?: string;
};
type Detail = {
  class: { id: number; name: string; ageLabel?: string; active: boolean };
  serviceSession?: {
    id: number;
    name: string;
    serviceDate: string;
    serviceType: string;
  } | null;
  canManage: boolean;
  isSuperAdmin: boolean;
  teachers: Teacher[];
  children: Child[];
  summary: { present: number; absent: number; registered: number };
  assignment?: {
    id: number;
    title: string;
    instructions?: string;
    dateGiven: string;
    dueDate?: string;
    createdBy: string;
    submittedCount: number;
    pendingCount: number;
  } | null;
  monthly: {
    month: string;
    sessions: { id: number; serviceDate: string; name?: string }[];
    presentByDate: Record<string, number[]>;
  };
  notes: { id: number; note: string; author: string; createdAt: string }[];
  weeklyReviews: {
    id: number;
    serviceSessionId: number;
    serviceDate: string;
    serviceName?: string;
    workedWell?: string;
    needsImprovement?: string;
    author: string;
    createdAt: string;
  }[];
};
const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
const label = (value?: string) =>
  value
    ?.replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase()) || "—";
const formatDate = (value?: string) =>
  value
    ? new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(`${value.slice(0, 10)}T12:00:00`))
    : "—";
function useService() {
  const [service, setService] = useState<ActiveService | null>(null);
  useEffect(() => subscribeToActiveService(setService), []);
  return service;
}
function Avatar({ teacher }: { teacher: Teacher }) {
  const [imageFailed, setImageFailed] = useState(false);
  return teacher.profileImageUrl && !imageFailed ? (
    <img
      className="teacher-photo"
      src={teacher.profileImageUrl}
      alt=""
      onError={() => setImageFailed(true)}
    />
  ) : (
    <i className="teacher-photo">{initials(teacher.name)}</i>
  );
}
function Status({ value }: { value: string }) {
  const tone =
    value === "ASSIGNED" ||
    value === "RUNNING_SMOOTHLY" ||
    value === "PRESENT" ||
    value === "SUBMITTED" ||
    value === "COMPLETE"
      ? "good"
      : value === "ABSENT" ||
          value === "NOT_SUBMITTED"
        ? "warn"
        : "quiet";
  return (
    <span className={`cw-status ${tone}`}>
      {value === "ASSIGNED" ||
      value === "RUNNING_SMOOTHLY" ||
      value === "PRESENT" ||
      value === "SUBMITTED" ||
      value === "COMPLETE" ? (
        <FiCheckCircle />
      ) : value === "ABSENT" ||
        value === "NOT_SUBMITTED" ? (
        <FiAlertTriangle />
      ) : null}
      {label(value)}
    </span>
  );
}

export function ClassroomsOverview() {
  const session = useMemo(() => readTeacherSession(), []);
  const service = useService();
  const [data, setData] = useState<Overview>({
    summary: {
      activeClasses: 0,
      checkedIn: 0,
      teachersAssigned: 0,
    },
    items: [],
  });
  const [weeks, setWeeks] = useState<ServiceWeek[]>([]);
  const [weekServiceSessionId, setWeekServiceSessionId] = useState("");
  const [weekScope, setWeekScope] = useState("");
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [moreFilters, setMoreFilters] = useState(false);
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const requestVersion = useRef(0);
  const serviceScope =
    service?.serviceDate && service?.serviceType
      ? `${service.serviceType}:${service.serviceDate.slice(0, 7)}`
      : "";
  const selectedServiceSessionId =
    weekScope === serviceScope && weekServiceSessionId
      ? Number(weekServiceSessionId)
      : Number(service?.id || 0);
  useEffect(() => {
    if (!session || !service?.serviceDate || !service.serviceType) {
      setWeeks([]);
      setWeekServiceSessionId("");
      setWeekScope("");
      return;
    }
    let cancelled = false;
    const scope = `${service.serviceType}:${service.serviceDate.slice(0, 7)}`;
    setWeeks([]);
    setWeekServiceSessionId(String(service.id));
    setWeekScope("");
    void fetch(`${apiBase}/api/v1/service-sessions`, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((result) => {
        if (cancelled || !result.success) return;
        const month = service.serviceDate!.slice(0, 7);
        const bySunday = new Map<string, ServiceWeek>();
        (result.data as ServiceWeek[])
          .filter((item) => item.serviceType === service.serviceType && item.serviceDate?.startsWith(month))
          .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate))
          .forEach((item) => { if (!bySunday.has(item.serviceDate)) bySunday.set(item.serviceDate, item); });
        const choices = [...bySunday.values()];
        setWeeks(choices);
        setWeekServiceSessionId(String(choices.find((item) => item.id === service.id)?.id || choices.at(-1)?.id || service.id));
        setWeekScope(scope);
      })
      .catch(() => { if (!cancelled) setWeeks([]); });
    return () => { cancelled = true; };
  }, [service?.id, service?.serviceDate, service?.serviceType, session]);
  const load = useCallback(async () => {
    if (!session) return;
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const p = new URLSearchParams();
      if (selectedServiceSessionId) p.set("serviceSessionId", String(selectedServiceSessionId));
      if (query) p.set("search", query);
      if (classId) p.set("classId", classId);
      if (status) p.set("status", status);
      const r = await fetch(`${apiBase}/api/v1/classrooms?${p}`, {
        headers: authHeaders(session),
      });
      const b = await r.json();
      if (!r.ok || !b.success)
        throw new Error(b.error?.message || "We could not load classrooms.");
      if (version === requestVersion.current) setData(b.data);
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [classId, query, selectedServiceSessionId, session, status]);
  useEffect(() => {
    const id = window.setTimeout(() => void load(), query ? 180 : 0);
    return () => window.clearTimeout(id);
  }, [load, query]);
  const classes = useMemo(
    () =>
      [...data.items].sort((left, right) =>
        sort === "attendance"
          ? right.attendancePercentage - left.attendancePercentage
          : left.name.localeCompare(right.name),
      ),
    [data.items, sort],
  );
  return (
    <section className="cw-page">
      <style>{`
        .cw-page .cw-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .cw-page .cw-tools { grid-template-columns: minmax(250px, 1.7fr) 180px 180px 180px auto; }
        @media (max-width: 1100px) {
          .cw-page .cw-tools { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 650px) {
          .cw-page .cw-metrics, .cw-page .cw-tools { grid-template-columns: 1fr; }
        }
      `}</style>
      <header className="cw-heading">
        <div>
          <p className="eyebrow">Petra Wuse</p>
          <h1>Classrooms</h1>
          <p>See attendance, children and teachers across TPK classrooms.</p>
        </div>
      </header>
      <section className="cw-metrics">
        <Metric
          icon={<FiUsers />}
          value={data.summary.activeClasses}
          title="Active Classes"
          text="Classrooms in this service"
        />
        <Metric
          icon={<FiCheckCircle />}
          value={data.summary.checkedIn}
          title="Children Checked In"
          text="Selected service"
          tone="green"
        />
        <Metric
          icon={<FiUsers />}
          value={data.summary.teachersAssigned}
          title="Teachers Assigned"
          text="Across all classes"
          tone="purple"
        />
      </section>
      <section className="cw-tools">
        <label>
          <FiSearch />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search classroom, child or teacher..."
          />
        </label>
        <select
          aria-label="Sunday in selected month"
          value={weekServiceSessionId}
          onChange={(event) => setWeekServiceSessionId(event.target.value)}
          disabled={!weeks.length}
        >
          {weeks.map((item, index) => (
            <option key={item.id} value={item.id}>
              Week {index + 1} · {formatDate(item.serviceDate)}
            </option>
          ))}
          {!weeks.length && <option value="">Selected Sunday</option>}
        </select>
        <select
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          <option value="">All Classes</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="ASSIGNED">Teacher Assigned</option>
          <option value="NO_TEACHER_ASSIGNED">No Teacher Assigned</option>
        </select>
        <button
          onClick={() => setMoreFilters((value) => !value)}
          aria-expanded={moreFilters}
        >
          <FiFilter />
          More Filters
        </button>
      </section>
      {moreFilters && (
        <section
          className="cw-more-filters"
          style={{ display: "flex", alignItems: "end", gap: 10, marginTop: -8 }}
        >
          <label
            style={{
              display: "grid",
              gap: 6,
              color: "#53647d",
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            Sort classrooms
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="name">Class name A–Z</option>
              <option value="attendance">Highest attendance</option>
            </select>
          </label>
          <button
            onClick={() => {
              setQuery("");
              setClassId("");
              setStatus("");
              setSort("name");
            }}
          >
            Clear Filters
          </button>
        </section>
      )}
      <div className="cw-list-heading">
        <h2>Classrooms ({classes.length})</h2>
        <span>{data.serviceSession ? `${data.serviceSession.name} · ${formatDate(data.serviceSession.serviceDate)}` : "Choose a service"}</span>
      </div>
      {loading ? (
        <p className="cw-empty">Loading classrooms…</p>
      ) : (
        <section className="class-grid">
          {classes.map((item) => (
            <article className="class-card" key={item.id}>
              <header>
                <div>
                  <i className="class-symbol">
                    <FiUsers />
                  </i>
                  <h3>{item.name}</h3>
                  <p>{item.ageLabel || "Age range not set"}</p>
                </div>
                <Status value={item.status} />
              </header>
              <p className="teacher-heading">
                Teachers on duty this Sunday
              </p>
              <div className="teacher-strip">
                {item.teachers.length ? (
                  item.teachers.map((teacher) => (
                    <span key={teacher.userId}>
                      <Avatar teacher={teacher} />
                      <b>{teacher.name}</b>
                      <small>
                        {teacher.status === "PRESENT"
                          ? "Confirmed present"
                          : "Not confirmed"}
                      </small>
                    </span>
                  ))
                ) : (
                  <Link href="/account/roster" className="no-teacher">
                    No teacher assigned <FiChevronRight />
                  </Link>
                )}
              </div>
              <div className="class-numbers">
                <b>
                  {item.present}
                  <small>Present</small>
                </b>
                <b>
                  {item.absent}
                  <small>Absent</small>
                </b>
                <b>
                  {item.registered}
                  <small>Registered</small>
                </b>
              </div>
              <div className="attendance-progress">
                <i style={{ width: `${item.attendancePercentage}%` }} />
                <span>{item.attendancePercentage}% present</span>
              </div>
              <footer>
                <small>
                  <FiCalendar />
                  {data.serviceSession?.serviceDate
                    ? `Service: ${formatDate(data.serviceSession.serviceDate)}`
                    : "No selected service"}
                </small>
                <Link
                  href={`/account/classrooms/${item.id}${data.serviceSession?.id ? `?serviceSessionId=${data.serviceSession.id}` : ""}`}
                >
                  Open Class <FiChevronRight />
                </Link>
              </footer>
            </article>
          ))}
          {!classes.length && (
            <p className="cw-empty">No classrooms match these filters.</p>
          )}
        </section>
      )}
      <style jsx>{styles}</style>
      <style jsx>{mobileDetailStyles}</style>
    </section>
  );
}

function Metric({
  icon,
  value,
  title,
  text,
  tone = "orange",
}: {
  icon: React.ReactNode;
  value: number;
  title: string;
  text: string;
  tone?: StatCardTone | "red";
}) {
  return <StatCard icon={icon} value={value} title={title} description={text} tone={tone === "red" ? "orange" : tone} />;
}

export function ClassroomDetail({ classId }: { classId: number }) {
  const session = useMemo(() => readTeacherSession(), []);
  const active = useService();
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState("children");
  const [query, setQuery] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [assignmentFilter, setAssignmentFilter] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState("");
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [reviewSessionId, setReviewSessionId] = useState("");
  const [workedWell, setWorkedWell] = useState("");
  const [needsImprovement, setNeedsImprovement] = useState("");
  const detailRequestVersion = useRef(0);
  const load = useCallback(async () => {
    if (!session) return;
    const requestVersion = ++detailRequestVersion.current;
    setData(null);
    try {
      const p = new URLSearchParams({ month });
      if (active?.id) p.set("serviceSessionId", String(active.id));
      const r = await fetch(`${apiBase}/api/v1/classrooms/${classId}?${p}`, {
        headers: authHeaders(session),
      });
      const b = await r.json();
      if (!r.ok || !b.success)
        throw new Error(
          b.error?.message || "We could not load this classroom.",
        );
      if (requestVersion !== detailRequestVersion.current) return;
      setData(b.data);
      setReviewSessionId(
        (value) =>
          value || String(active?.id || b.data.serviceSession?.id || ""),
      );
      setError("");
    } catch (reason) {
      if (requestVersion !== detailRequestVersion.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not load this classroom.",
      );
    }
  }, [active?.id, classId, month, session]);
  useEffect(() => {
    void load();
  }, [load]);
  const updateSubmission = async (childId: number, status: string) => {
    if (!data?.assignment || !session) return;
    await fetch(
      `${apiBase}/api/v1/classroom-assignments/${data.assignment.id}/children/${childId}`,
      {
        method: "PATCH",
        headers: {
          ...authHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      },
    );
    void load();
  };
  const addWeeklyReview = async () => {
    if (
      !session ||
      !reviewSessionId ||
      (!workedWell.trim() && !needsImprovement.trim())
    )
      return;
    setDiscussionMessage("Saving discussion…");
    try {
      const r = await fetch(
        `${apiBase}/api/v1/classrooms/${classId}/weekly-reviews`,
        {
          method: "POST",
          headers: {
            ...authHeaders(session),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceSessionId: Number(reviewSessionId),
            workedWell: workedWell.trim(),
            needsImprovement: needsImprovement.trim(),
          }),
        },
      );
      const body = await r.json().catch(() => null);
      if (!r.ok || !body?.success) throw new Error(body?.error?.message || "We could not save this discussion.");
      setWorkedWell("");
      setNeedsImprovement("");
      setDiscussionMessage("Discussion saved.");
      void load();
    } catch (reason) {
      setDiscussionMessage(reason instanceof Error ? reason.message : "We could not save this discussion.");
    }
  };
  if (error)
    return (
      <section className="cw-page">
        <p className="cw-error">{error}</p>
      </section>
    );
  if (!data)
    return (
      <section className="cw-page">
        <p className="cw-empty">Loading classroom…</p>
      </section>
    );
  const visible = data.children.filter(
    (child) =>
      `${child.firstName} ${child.lastName}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (!attendanceFilter || child.todayStatus === attendanceFilter) &&
      (!assignmentFilter || child.assignmentStatus === assignmentFilter),
  );
  return (
    <section className="cw-page class-detail">
      <Link
        className="cw-back"
        href={`/account/classrooms${data.serviceSession?.id ? `?serviceSessionId=${data.serviceSession.id}` : ""}`}
      >
        <FiArrowLeft />
        Classrooms
      </Link>
      <header className="detail-header">
        <div>
          <p className="eyebrow">Classrooms · {data.class.name}</p>
          <h1>{data.class.name}</h1>
          <p>
            {data.class.ageLabel || "Configured age range"} ·{" "}
            {data.serviceSession?.name || "No service selected"}
          </p>
        </div>
      </header>
      <section className="cw-metrics detail-metrics">
        <Metric
          icon={<FiUsers />}
          value={data.summary.present}
          title="Present"
          text="Selected service"
          tone="green"
        />
        <Metric
          icon={<FiAlertTriangle />}
          value={data.summary.absent}
          title="Absent"
          text="Expected children"
          tone="red"
        />
        <Metric
          icon={<FiUsers />}
          value={data.summary.registered}
          title="Registered"
          text="Children in class"
          tone="blue"
        />
        {data.assignment && (
          <>
            <Metric
              icon={<FiCheckCircle />}
              value={data.assignment.submittedCount}
              title="Submitted Assignment"
              text="Present children"
              tone="purple"
            />
            <Metric
              icon={<FiClipboard />}
              value={data.assignment.pendingCount}
              title="Pending Assignment"
              text="Needs recording"
            />
          </>
        )}
      </section>
      <section className="assigned">
        <header>
          <h2>Assigned Teachers ({data.teachers.length})</h2>
          {data.isSuperAdmin && (
            <Link href="/account/roster">
              Manage in Team & Roster <FiChevronRight />
            </Link>
          )}
        </header>
        <div className="teacher-cards">
          {data.teachers.map((teacher) => (
            <article key={teacher.userId} className="teacher-card">
              <Link
                href={`/account/team?member=${teacher.userId}`}
                aria-label={`View ${teacher.name}'s profile`}
              >
                <Avatar teacher={teacher} />
              </Link>
              <div>
                <Link href={`/account/team?member=${teacher.userId}`}>
                  <b>{teacher.name}</b>
                </Link>
                <small>{teacher.dutyName || "Class teacher"}</small>
                <small>
                  Assigned {formatDate(data.serviceSession?.serviceDate)}
                </small>
                {teacher.whatsappNumber && (
                  <small>{teacher.whatsappNumber}</small>
                )}
              </div>
            </article>
          ))}
          {!data.teachers.length && (
            <p>
              No teacher has been assigned for this service.{" "}
              <Link href="/account/roster">Open Team & Roster</Link>
            </p>
          )}
        </div>
      </section>
      <nav className="class-tabs">
        {[
          ["children", `Children (${data.children.length})`],
          ["attendance", "Attendance"],
          ["assignments", "Assignments"],
          ["notes", "Weekly Discussion"],
          ["details", "Class Details"],
        ].map(([id, title]) => (
          <button
            key={id}
            className={tab === id ? "selected" : ""}
            onClick={() => setTab(id)}
          >
            {title}
          </button>
        ))}
      </nav>
      {tab === "children" && (
        <section>
          <div className="detail-tools">
            <label>
              <FiSearch />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search child by name..."
              />
            </label>
            <select
              value={attendanceFilter}
              onChange={(event) => setAttendanceFilter(event.target.value)}
            >
              <option value="">All Attendance</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
            </select>
            <select
              value={assignmentFilter}
              onChange={(event) => setAssignmentFilter(event.target.value)}
            >
              <option value="">All Assignment Status</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="NOT_SUBMITTED">Not Submitted</option>
              <option value="EXCUSED">Excused</option>
              <option value="NOT_IN_CLASS">Not in class</option>
            </select>
            {data.canManage && (
              <button
                className="primary"
                onClick={() => setAssignmentOpen(true)}
              >
                Add Assignment
              </button>
            )}
          </div>
          <ChildrenTable
            rows={visible}
            assignment={Boolean(data.assignment)}
            onSubmission={updateSubmission}
          />
        </section>
      )}
      {tab === "attendance" && (
        <Attendance data={data} month={month} setMonth={setMonth} />
      )}{" "}
      {tab === "assignments" && (
        <Assignments
          data={data}
          onNew={() => setAssignmentOpen(true)}
          onSubmission={updateSubmission}
        />
      )}{" "}
      {tab === "notes" && (
        <WeeklyReviews
          data={data}
          month={month}
          setMonth={setMonth}
          reviewSessionId={reviewSessionId}
          setReviewSessionId={setReviewSessionId}
          workedWell={workedWell}
          setWorkedWell={setWorkedWell}
          needsImprovement={needsImprovement}
          setNeedsImprovement={setNeedsImprovement}
          discussionMessage={discussionMessage}
          onSave={addWeeklyReview}
        />
      )}
      {tab === "details" && (
        <section className="class-info">
          <p>
            <b>Class</b>
            {data.class.name}
          </p>
          <p>
            <b>Age range</b>
            {data.class.ageLabel || "Not configured"}
          </p>
          <p>
            <b>Status</b>
            {data.class.active ? "Active" : "Inactive"}
          </p>
          <p>
            <b>Registered children</b>
            {data.summary.registered}
          </p>
          {data.isSuperAdmin && (
            <Link href="/account/classes">
              Manage Class Configuration <FiChevronRight />
            </Link>
          )}
        </section>
      )}
      {assignmentOpen && (
        <AssignmentForm
          classId={classId}
          serviceId={active?.id}
          close={() => setAssignmentOpen(false)}
          done={() => {
            setAssignmentOpen(false);
            void load();
          }}
        />
      )}
      <style jsx>{styles}</style>
    </section>
  );
}

function WeeklyReviews({
  data,
  month,
  setMonth,
  reviewSessionId,
  setReviewSessionId,
  workedWell,
  setWorkedWell,
  needsImprovement,
  setNeedsImprovement,
  discussionMessage,
  onSave,
}: {
  data: Detail;
  month: string;
  setMonth: (value: string) => void;
  reviewSessionId: string;
  setReviewSessionId: (value: string) => void;
  workedWell: string;
  setWorkedWell: (value: string) => void;
  needsImprovement: string;
  setNeedsImprovement: (value: string) => void;
  discussionMessage: string;
  onSave: () => void;
}) {
  const sessions = [
    ...(data.serviceSession ? [data.serviceSession] : []),
    ...data.monthly.sessions,
  ].filter(
    (item, index, list) =>
      list.findIndex((other) => other.id === item.id) === index,
  );
  return (
    <section className="weekly-reviews">
      <header className="discussion-header">
        <div className="discussion-title">
          <i className="discussion-title-icon"><FiMessageCircle /></i>
          <div>
          <p className="eyebrow">Class reflection</p>
          <h2>Weekly discussion</h2>
          <p>
            A quick space for the team to celebrate wins and prepare for the
            next Sunday.
          </p>
          </div>
        </div>
        <label className="discussion-month">
          <span>Review month</span>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </label>
      </header>
      {data.canManage && (
        <section className="review-form">
          <div className="review-form-heading">
            <div className="review-form-intro">
              <i><FiClipboard /></i>
              <div>
                <b>Add this Sunday’s review</b>
                <small>Keep it practical — a few helpful sentences is enough.</small>
              </div>
            </div>
            <label className="review-session">
              <span>Sunday service</span>
              <select
                value={reviewSessionId}
                onChange={(event) => setReviewSessionId(event.target.value)}
              >
                <option value="">Choose Sunday</option>
                {sessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatDate(item.serviceDate)} ·{" "}
                    {item.name || data.serviceSession?.name || "Service"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="review-fields">
            <label className="review-field worked">
              <span><FiCheckCircle /> What worked well?</span>
              <small>Celebrate what helped children engage, learn or settle in.</small>
              <textarea
                value={workedWell}
                onChange={(event) => setWorkedWell(event.target.value)}
                placeholder="What helped the children learn, participate or settle well?"
              />
            </label>
            <label className="review-field improve">
              <span><FiAlertTriangle /> What should we improve?</span>
              <small>Note one thing to prepare or handle differently next time.</small>
              <textarea
                value={needsImprovement}
                onChange={(event) => setNeedsImprovement(event.target.value)}
                placeholder="What needs attention before the next Sunday?"
              />
            </label>
          </div>
          <footer className="review-actions">
            <p>Visible to teachers assigned to this class.</p>
            {discussionMessage && <span className={`review-save-message${discussionMessage === "Discussion saved." ? " success" : ""}`}>{discussionMessage}</span>}
            <button
              className="primary"
              disabled={
                !reviewSessionId ||
                (!workedWell.trim() && !needsImprovement.trim())
              }
              onClick={onSave}
            >
              <FiCheckCircle /> Save discussion
            </button>
          </footer>
        </section>
      )}
      <div className="review-list">
        <header className="review-history-heading">
          <div>
            <p className="eyebrow">Discussion history</p>
            <h3>This month’s reflections</h3>
          </div>
          <span>{data.weeklyReviews.length} {data.weeklyReviews.length === 1 ? "review" : "reviews"}</span>
        </header>
        {data.weeklyReviews.map((review) => (
          <article key={review.id}>
            <header>
              <div>
                <b>{formatDate(review.serviceDate)}</b>
                <small>
                  {review.serviceName || "Sunday service"} · {review.author}
                </small>
              </div>
              <FiMessageCircle />
            </header>
            {review.workedWell && (
              <p>
                <strong>Worked well</strong>
                {review.workedWell}
              </p>
            )}
            {review.needsImprovement && (
              <p>
                <strong>Improve next time</strong>
                {review.needsImprovement}
              </p>
            )}
          </article>
        ))}
        {!data.weeklyReviews.length && (
          <div className="discussion-empty">
            <i><FiMessageCircle /></i>
            <div>
              <b>No discussion yet</b>
              <p>After this Sunday, add a short reflection to help the next team serve even better.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ChildrenTable({
  rows,
  assignment,
  onSubmission,
}: {
  rows: Child[];
  assignment: boolean;
  onSubmission: (id: number, status: string) => void;
}) {
  return (
    <div className="cw-table children-table">
      <table>
        <thead>
          <tr>
            <th>Child</th>
            <th>Age</th>
            <th>Guardian</th>
            <th>Today</th>
            <th>Assignment</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((child) => (
            <tr key={child.id}>
              <td data-label="Child">
                <Link href={`/account/children?childId=${child.id}`}>
                  <b>
                    {child.firstName} {child.lastName}
                  </b>
                </Link>
              </td>
              <td data-label="Age">{child.age ?? "—"}</td>
              <td data-label="Guardian">
                {child.guardianId ? (
                  <Link
                    href={`/account/guardians?guardianId=${child.guardianId}`}
                  >
                    {child.guardianName}
                    <small>{child.guardianPhone}</small>
                  </Link>
                ) : (
                  "—"
                )}
              </td>
              <td data-label="Today">
                <Status value={child.todayStatus} />
              </td>
              <td data-label="Assignment">
                {assignment ? <Status value={child.assignmentStatus} /> : "—"}
              </td>
              <td data-label="Actions">
                {assignment && child.todayStatus === "PRESENT" ? (
                  <select
                    value={child.assignmentStatus}
                    onChange={(event) =>
                      onSubmission(child.id, event.target.value)
                    }
                  >
                    <option value="NOT_SUBMITTED">Not Submitted</option>
                    <option value="SUBMITTED">Submitted</option>
                    <option value="EXCUSED">Excused</option>
                  </select>
                ) : (
                  <Link href={`/account/children?childId=${child.id}`}>
                    <FiChevronRight />
                  </Link>
                )}
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="cw-empty">
                No children match this filter.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function Attendance({
  data,
  month,
  setMonth,
}: {
  data: Detail;
  month: string;
  setMonth: (value: string) => void;
}) {
  return (
    <section className="attendance-view">
      <header>
        <div>
          <h2>Attendance</h2>
          <p>
            {data.summary.present} present · {data.summary.absent} absent for
            the selected service.
          </p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
      </header>
      <div className="cw-table matrix">
        <table>
          <thead>
            <tr>
              <th>Child</th>
              {data.monthly.sessions.map((item) => (
                <th key={item.id}>
                  Sun<small>{formatDate(item.serviceDate)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.children.map((child) => (
              <tr key={child.id}>
                <td>
                  {child.firstName} {child.lastName}
                </td>
                {data.monthly.sessions.map((week) => {
                  const notExpected = Boolean(
                    child.joinedAt && child.joinedAt > week.serviceDate,
                  );
                  return (
                    <td key={week.id}>
                      {notExpected ? (
                        <span>—</span>
                      ) : (
                        <Status
                          value={
                            data.monthly.presentByDate[
                              week.serviceDate
                            ]?.includes(child.id)
                              ? "PRESENT"
                              : "ABSENT"
                          }
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="attendance-cards">
        {data.children.map((child) => (
          <article key={child.id}>
            <b>
              {child.firstName} {child.lastName}
            </b>
            <div>
              {data.monthly.sessions.map((week) => {
                const notExpected = Boolean(
                  child.joinedAt && child.joinedAt > week.serviceDate,
                );
                return (
                  <span key={week.id}>
                    <small>{formatDate(week.serviceDate)}</small>
                    {notExpected ? (
                      "—"
                    ) : (
                      <Status
                        value={
                          data.monthly.presentByDate[
                            week.serviceDate
                          ]?.includes(child.id)
                            ? "PRESENT"
                            : "ABSENT"
                        }
                      />
                    )}
                  </span>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
function Assignments({
  data,
  onNew,
  onSubmission,
}: {
  data: Detail;
  onNew: () => void;
  onSubmission: (id: number, status: string) => void;
}) {
  return (
    <section className="assignment-panel">
      {data.assignment ? (
        <>
          <header>
            <div>
              <h2>{data.assignment.title}</h2>
              <p>
                Given {formatDate(data.assignment.dateGiven)} ·{" "}
                {data.assignment.createdBy}
              </p>
            </div>
            <Status value="SUBMITTED" />
          </header>
          <p>{data.assignment.instructions || "No additional instructions."}</p>
          <p>
            <b>{data.assignment.submittedCount} submitted</b> ·{" "}
            {data.assignment.pendingCount} pending
          </p>
          <ChildrenTable
            rows={data.children}
            assignment
            onSubmission={onSubmission}
          />
        </>
      ) : (
        <div className="cw-empty">
          <FiClipboard />
          <b>No assignment for this service</b>
          <span>
            Assignments only appear when a teacher records one for this
            classroom.
          </span>
          <button className="primary" onClick={onNew}>
            Add Assignment
          </button>
        </div>
      )}
    </section>
  );
}
function AssignmentForm({
  classId,
  serviceId,
  close,
  done,
}: {
  classId: number;
  serviceId?: number;
  close: () => void;
  done: () => void;
}) {
  const session = useMemo(() => readTeacherSession(), []);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const submit = async () => {
    if (!session) return;
    const r = await fetch(
      `${apiBase}/api/v1/classrooms/${classId}/assignments`,
      {
        method: "POST",
        headers: {
          ...authHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceSessionId: serviceId,
          title,
          instructions,
          dueDate,
        }),
      },
    );
    const b = await r.json();
    if (!r.ok || !b.success) {
      setError(b.error?.message || "We could not create this assignment.");
      return;
    }
    done();
  };
  return (
    <div className="cw-modal">
      <section>
        <button className="modal-close" onClick={close}>
          ×
        </button>
        <p className="eyebrow">Class Assignment</p>
        <h2>Add Assignment</h2>
        <label>
          Assignment Title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Memory Verse: Matthew 5:16"
          />
        </label>
        <label>
          Instructions
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="Short instructions for the class..."
          />
        </label>
        <label>
          Due Date <small>(optional)</small>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        {error && <p className="cw-error">{error}</p>}
        <footer>
          <button onClick={close}>Cancel</button>
          <button className="primary" onClick={submit}>
            Create Assignment
          </button>
        </footer>
      </section>
    </div>
  );
}

const styles = `.cw-page{max-width:1260px;padding-top:16px}.cw-heading{margin-bottom:17px}.eyebrow{color:#ff5938;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.cw-page h1,.cw-page h2,.cw-page h3{font-family:var(--font-display,Georgia,serif);color:#101d3b}.cw-page h1{margin:5px 0;font-size:37px;letter-spacing:-1.2px}.cw-heading>div>p:last-child,.detail-header p{margin:0;color:#617493;font-size:15px}.cw-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:19px 0}.cw-metric{min-height:104px;padding:17px;border:1px solid #f0e6df;border-radius:10px;background:#fff5f1;display:grid;grid-template-columns:51px 1fr;grid-template-rows:30px 20px 18px}.cw-metric>i{grid-row:1/4;width:43px;height:43px;border-radius:10px;background:#ffe2db;color:#ff5938;display:grid;place-items:center;font-size:22px}.cw-metric b{font:700 28px Georgia,serif}.cw-metric strong{font-size:12px}.cw-metric small{color:#70809a;font-size:10px}.cw-metric.green{background:#effbf4}.cw-metric.green>i{background:#d7f6e3;color:#009653}.cw-metric.purple{background:#f5f0ff}.cw-metric.purple>i{background:#e7dcff;color:#7440e8}.cw-metric.red{background:#fff1ee}.cw-metric.red>i{background:#ffdcd7;color:#f04d35}.cw-metric.blue{background:#edf6ff}.cw-metric.blue>i{background:#dceeff;color:#1576d2}.cw-tools,.detail-tools{display:grid;grid-template-columns:minmax(250px,1.7fr) 180px 180px auto;gap:10px;margin:18px 0}.cw-tools label,.detail-tools label{height:41px;border:1px solid #dbe1eb;border-radius:8px;background:#fff;display:flex;align-items:center;gap:9px;padding:0 12px;color:#6580a3}.cw-tools input,.detail-tools input{min-width:0;width:100%;border:0;outline:0;background:transparent;font:12px var(--font-body)}.cw-tools select,.detail-tools select,.cw-table select{height:41px;border:1px solid #dbe1eb;border-radius:8px;background:#fff;padding:0 10px;color:#1a2c4a;font:700 11px var(--font-body)}.cw-tools button,.detail-tools button{height:41px;border:1px solid #dbe1eb;border-radius:8px;background:#fff;padding:0 13px;font:800 11px var(--font-body);display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}.cw-list-heading{display:flex;align-items:center;justify-content:space-between;margin-top:24px}.cw-list-heading h2{font-size:22px;margin:0}.cw-list-heading span{color:#5d6e89;font-size:11px}.class-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:15px}.class-card{min-height:270px;border:1px solid #e1e4e9;border-radius:10px;background:#fff;padding:16px;display:flex;flex-direction:column}.class-card>header{display:flex;justify-content:space-between;gap:10px}.class-card>header>div{display:grid;grid-template-columns:47px 1fr;column-gap:10px}.class-symbol{grid-row:1/3;width:45px;height:45px;border-radius:11px;display:grid;place-items:center;background:#fbe5f6;color:#d336a7;font-size:21px}.class-card h3{margin:2px 0 3px;font-size:18px}.class-card header p{margin:0;color:#6d7e99;font-size:11px}.cw-status{width:max-content;max-width:100%;display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:5px 8px;font-size:10px;font-weight:900;white-space:nowrap}.cw-status.good{background:#e6f8ec;color:#07844f}.cw-status.warn{background:#fff0e8;color:#d85332}.cw-status.quiet{background:#eff2f7;color:#5e6d85}.teacher-heading{margin:17px 0 8px;color:#1b2b49;font-size:11px;font-weight:900}.teacher-strip{display:flex;gap:9px;min-height:46px;flex-wrap:wrap}.teacher-strip>span{display:grid;grid-template-columns:31px auto;column-gap:6px;min-width:105px}.teacher-strip b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.teacher-strip small{grid-column:2;color:#71809a;font-size:9px}.teacher-photo{width:31px;height:31px;border-radius:50%;object-fit:cover;background:#e9effa;color:#2d67a7;display:grid;place-items:center;font-size:9px;font-style:normal;font-weight:900}.no-teacher{font-size:10px;color:#d64e32;text-decoration:none;display:flex;gap:4px;align-items:center}.class-numbers{display:grid;grid-template-columns:repeat(3,1fr);margin:14px 0}.class-numbers b{font:700 21px Georgia,serif}.class-numbers small{display:block;color:#71809a;font:600 10px var(--font-body)}.attendance-progress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;font-size:10px;font-weight:800;color:#18345e}.attendance-progress:before{content:"";grid-area:1/1;height:9px;border-radius:99px;background:#e8edf3}.attendance-progress i{grid-area:1/1;height:9px;border-radius:99px;background:#00af65;z-index:1}.attendance-progress span{grid-area:1/2}.class-card footer{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:13px;border-top:1px solid #edf0f3}.class-card footer small{display:flex;align-items:center;gap:5px;color:#71809a;font-size:9px}.class-card footer a,.assigned header a,.class-info a{border:1px solid #dce2eb;border-radius:7px;padding:8px 10px;color:#075dd3;text-decoration:none;font-size:10px;font-weight:900;display:flex;align-items:center;gap:4px}.cw-empty{min-height:90px;display:grid;place-items:center;gap:6px;color:#74829a;font-size:12px;text-align:center}.cw-empty b{color:#1d2f4c}.cw-error{padding:13px;border-radius:8px;background:#fff0ed;color:#c6452d}.cw-back{display:inline-flex;align-items:center;gap:7px;color:#476187;text-decoration:none;font-size:11px;font-weight:800}.detail-header{display:flex;align-items:center;justify-content:space-between;margin:10px 0 14px}.detail-header h1{margin:4px 0}.detail-metrics{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.assigned{padding:15px;border:1px solid #e1e4e9;border-radius:10px;background:#fff}.assigned header{display:flex;align-items:center;justify-content:space-between;gap:10px}.assigned h2{margin:0;font-size:19px}.teacher-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.teacher-cards article{min-height:78px;padding:12px;border:1px solid #e1e5eb;border-radius:8px;display:flex;align-items:flex-start;gap:9px}.teacher-cards article>div{min-width:0;flex:1;display:grid;gap:4px}.teacher-cards b{font-size:11px}.teacher-cards small{overflow:hidden;color:#70809a;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.teacher-cards p{margin:0;color:#6f7f97;font-size:11px}.teacher-cards p a{color:#075dd3}.class-tabs{display:flex;gap:5px;margin-top:20px;border-bottom:1px solid #e2e6eb;overflow:auto}.class-tabs button{flex:none;border:0;border-bottom:2px solid transparent;background:transparent;padding:11px 14px;color:#64738c;font:800 11px var(--font-body);cursor:pointer}.class-tabs button.selected{border-color:#ff5938;color:#142543}.detail-tools{grid-template-columns:minmax(220px,1.5fr) repeat(3,170px) auto}.primary{border-color:#ff5938!important;background:#ff5938!important;color:#fff!important}.cw-table{overflow:auto;border:1px solid #e0e4ea;border-radius:9px;background:#fff}.cw-table table{width:100%;border-collapse:collapse;min-width:720px}.cw-table th{padding:11px;text-align:left;background:#fbfaf7;color:#73819a;font-size:9px;text-transform:uppercase;letter-spacing:.05em}.cw-table td{padding:11px;border-top:1px solid #ebedf0;color:#203451;font-size:11px}.cw-table td a{color:#153d86;text-decoration:none}.cw-table td small{display:block;color:#71809b;font-size:9px;margin-top:3px}.cw-table select{height:31px;font-size:10px}.attendance-view>header,.assignment-panel>header{display:flex;justify-content:space-between;align-items:center;padding:16px 0}.attendance-view h2,.assignment-panel h2{margin:0;font-size:21px}.attendance-view p,.assignment-panel p{color:#697a95;font-size:12px}.attendance-view input{height:38px;border:1px solid #dbe1eb;border-radius:7px;padding:0 9px;font:11px var(--font-body)}.matrix th small{display:block;margin-top:3px;font-size:8px}.notes-panel{display:grid;gap:10px;padding:16px 0}.notes-panel textarea{min-height:90px;border:1px solid #dce1e8;border-radius:8px;padding:11px;font:12px var(--font-body);resize:vertical}.notes-panel article{padding:13px;border:1px solid #e2e5ea;border-radius:8px;background:#fff}.notes-panel article small{margin-left:8px;color:#75829a;font-size:9px}.notes-panel article p{margin:7px 0 0;color:#586a85;font-size:12px;white-space:pre-wrap}.class-info{display:grid;gap:10px;padding:17px 0}.class-info p{display:grid;gap:3px;margin:0;color:#677995;font-size:12px}.class-info b{color:#182b48}.assignment-panel{padding:5px 0}.assignment-panel>header{padding-bottom:8px}.cw-modal{position:fixed;z-index:99;inset:0;background:#0a173a77;display:grid;place-items:center;padding:20px}.cw-modal>section{position:relative;width:min(100%,510px);padding:25px;border-radius:12px;background:#fffdfa;box-shadow:0 20px 60px #101c373d;display:grid;gap:12px}.cw-modal h2{margin:0;font:700 26px Georgia,serif}.cw-modal label{display:grid;gap:6px;color:#33445f;font-size:11px;font-weight:800}.cw-modal input,.cw-modal textarea{border:1px solid #dce2eb;border-radius:8px;padding:10px;font:12px var(--font-body)}.cw-modal textarea{min-height:90px;resize:vertical}.modal-close{position:absolute;top:12px;right:14px;border:0;background:none;font-size:23px;cursor:pointer}.cw-modal footer{display:flex;justify-content:flex-end;gap:9px}.cw-modal footer button{height:40px;border:1px solid #dce2eb;border-radius:8px;padding:0 14px;background:#fff;font:800 11px var(--font-body);cursor:pointer}@media(max-width:1100px){.cw-metrics{grid-template-columns:repeat(2,1fr)}.class-grid{grid-template-columns:1fr}.cw-tools,.detail-tools{grid-template-columns:1fr 1fr}.cw-tools label,.detail-tools label{grid-column:1/-1}.teacher-cards{grid-template-columns:1fr 1fr}}@media(max-width:650px){.cw-page{padding-top:0}.cw-page h1{font-size:31px}.cw-metrics,.cw-tools,.detail-tools,.teacher-cards{grid-template-columns:1fr}.cw-tools label,.detail-tools label{grid-column:auto}.cw-list-heading{align-items:flex-start;gap:7px;flex-direction:column}.class-card{min-height:285px}.detail-header{align-items:flex-start;gap:10px;flex-direction:column}.assigned header{align-items:flex-start;flex-direction:column}.class-tabs button{padding:11px 9px;font-size:10px}.cw-modal{align-items:end;padding:0}.cw-modal>section{width:100%;border-radius:14px 14px 0 0}.teacher-cards article{min-width:0}}`;

const mobileDetailStyles = `
  .attendance-cards{display:none}.weekly-reviews{padding:18px 0}.weekly-reviews>header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}.weekly-reviews h2{margin:4px 0;font-size:23px}.weekly-reviews p{margin:0;color:#697a95;font-size:12px}.weekly-reviews>header label{display:grid;gap:5px;color:#62718a;font-size:10px;font-weight:800}.weekly-reviews input,.review-form select,.review-form textarea{border:1px solid #dce2eb;border-radius:8px;background:#fff;padding:10px;color:#203451;font:12px var(--font-body)}.review-form{padding:15px;border:1px solid #e1e5eb;border-radius:10px;background:#fffdfa}.review-form-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:#243653;font-size:12px}.review-form-heading select{min-width:220px}.review-fields{display:grid;grid-template-columns:1fr 1fr;gap:11px}.review-fields label{display:grid;gap:6px;color:#40516d;font-size:11px;font-weight:800}.review-fields textarea{min-height:96px;resize:vertical}.review-form .primary{height:39px;margin-top:12px}.review-form .primary:disabled{cursor:not-allowed;opacity:.48}.review-list{display:grid;gap:10px;margin-top:14px}.review-list article{padding:14px;border:1px solid #e2e5ea;border-radius:9px;background:#fff}.review-list article header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.review-list article header div{display:grid;gap:4px}.review-list article header b{font-size:12px}.review-list article header small{color:#71809b;font-size:10px}.review-list article header svg{color:#ff5938}.review-list article p{display:grid;gap:4px;margin:12px 0 0;white-space:pre-wrap;color:#586a85;line-height:1.5}.review-list article strong{color:#203451;font-size:11px}.teacher-cards article>a{display:block;line-height:0}.teacher-cards article>div>a{color:#172a48;text-decoration:none}.teacher-cards article>div>a:hover{text-decoration:underline}
  @media(max-width:650px){.cw-page{width:100%;max-width:100%;overflow:hidden}.cw-table.children-table{overflow:visible;border:0;background:transparent}.children-table table,.children-table tbody,.children-table tr,.children-table td{display:block;width:100%;box-sizing:border-box;min-width:0}.children-table thead{display:none}.children-table tr{margin-bottom:10px;overflow:hidden;border:1px solid #e0e4ea;border-radius:10px;background:#fff}.children-table td{display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid #edf0f2;padding:10px 12px;text-align:right}.children-table td:first-child{border-top:0;background:#fbfaf7;text-align:left}.children-table td:before{content:attr(data-label);flex:none;color:#74819a;text-align:left;font-size:9px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.children-table td:first-child:before{display:none}.children-table td select{max-width:155px}.matrix{display:none}.attendance-cards{display:grid;gap:9px;margin-top:13px}.attendance-cards article{padding:12px;border:1px solid #e0e4ea;border-radius:9px;background:#fff}.attendance-cards article>b{display:block;margin-bottom:8px;font-size:12px;color:#203451}.attendance-cards article>div{display:grid;gap:7px}.attendance-cards article span{display:flex;align-items:center;justify-content:space-between;gap:9px}.attendance-cards article small{color:#70809a;font-size:10px}.weekly-reviews>header{align-items:flex-start;flex-direction:column}.weekly-reviews>header label,.weekly-reviews input{width:100%;box-sizing:border-box}.review-form-heading{align-items:stretch;flex-direction:column}.review-form-heading select{min-width:0;width:100%}.review-fields{grid-template-columns:1fr}.review-form .primary{width:100%}.teacher-cards article{min-width:0}.class-tabs{padding-bottom:1px}.class-tabs button{font-size:9px}.detail-metrics{grid-template-columns:1fr 1fr}.detail-metrics .cw-metric{min-height:92px;padding:12px;grid-template-columns:42px 1fr}.detail-metrics .cw-metric>i{width:35px;height:35px;font-size:18px}.detail-metrics .cw-metric b{font-size:23px}}
`;

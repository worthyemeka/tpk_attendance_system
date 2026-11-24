"use client";

import { AppSelect } from "@/components/app-dropdown";
import Link from "next/link";
import { TeacherQuickView, type TeacherQuickTarget } from "@/components/dashboard-quick-views";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiClipboard,
  FiFileText,
  FiMessageCircle,
  FiPlus,
  FiSearch,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { LuDoorOpen, LuPresentation, LuSchool, LuShieldCheck } from "react-icons/lu";
import { apiBase, authHeaders, mediaUrl, readTeacherSession } from "@/lib/session";
import { StatCard, type StatCardTone } from "@/components/stat-card";
import { MonthPicker } from "@/components/month-picker";
import { classroomAttendanceStatus } from "@/lib/classroom-attendance";
import { ChildProfileDialog } from "./child-directory";
import { downloadTablePdf } from "@/lib/table-pdf";
import { classroomChildrenReport } from "@/lib/classroom-children-report";
import "./classroom-children-table.css";
import "./classroom-attendance.css";
import "./classroom-refinements.css";
import "./classrooms-overview.css";
import { DiscussionThread, AssemblyAttachment, AssemblyNoteReactions, AssemblyActivityReactions, type AssemblyMedia } from "./classroom-discussion-thread";
import { TeacherAttribution } from "./teacher-attribution";
import { VideoTrimmer } from "./video-trimmer";
import { TOTAL_UPLOAD_BYTES, VIDEO_UPLOAD_BYTES } from "@/lib/video-trim";
import {
  useSundayContext,
  serviceDisplayLabel,
} from "@/lib/sunday-context";

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
  serviceSession?: { id: number; name: string; serviceDate: string; serviceType?: string } | null;
};
type Overview = {
  serviceSession?: { id: number; name: string; serviceDate: string } | null;
  serviceSessions?: { id: number; name: string; serviceDate: string; serviceType?: string }[];
  mode?: string;
  groups?: { serviceSession: { id: number; name: string; serviceDate: string; serviceType?: string } | null; summary: Overview["summary"]; items: Classroom[] }[];
  summary: {
    activeClasses: number;
    checkedIn: number;
    teachersAssigned: number;
    needAttention?: number;
  };
  items: Classroom[];
};
type AssemblyActivity = { id: number; activityName: string; ledByStaffUserId?: number | null; ledBy?: string | null; ledByProfileImageUrl?: string | null; notes?: string | null; media?: AssemblyMedia[]; createdAt?: string };
type AssemblyNote = { id: number; note: string; author: string; authorId?: number; authorProfileImageUrl?: string | null; createdAt: string };
const ministryTabs = [
  { id: "classrooms", label: "Classrooms", Icon: LuSchool },
  { id: "assembly", label: "Assembly", Icon: LuPresentation },
  { id: "HEAD_OF_SERVICE", label: "Head of Service", Icon: LuShieldCheck },
  { id: "ATTENDANCE", label: "Door & Attendance", Icon: LuDoorOpen },
] as const;
type MinistryTab = typeof ministryTabs[number]["id"];
type ServiceReviewRole = Extract<MinistryTab, "HEAD_OF_SERVICE" | "ATTENDANCE">;
type ServiceReview = {
  id: number;
  authorId: number;
  author: string;
  authorProfileImageUrl?: string | null;
  createdAt: string;
  workedWell: string;
  needsImprovement: string;
  media: AssemblyMedia[];
};
type ServiceReviewsData = { canReview: boolean; reviews: ServiceReview[] };
type AssemblyGroup = { serviceSession: { id: number; name: string; serviceDate: string; serviceType?: string } | null; childrenInService: number; team: Teacher[]; leaders?: Pick<Teacher, "userId" | "name">[]; activities: AssemblyActivity[]; notes: AssemblyNote[]; canManage: boolean; isSuperAdmin: boolean; needAttention: number };
type Child = {
  id: number;
  firstName: string;
  lastName: string;
  age?: number;
  guardianId?: number;
  guardianName?: string;
  guardianPhone?: string;
  todayStatus: string;
  joinedAt?: string;
};
type ReviewService = { id: number | string; serviceDate: string; name?: string };
type Detail = {
  class: { id: number; name: string; ageLabel?: string; active: boolean };
  serviceSession?: {
    id: number;
    name: string;
    serviceDate: string;
    serviceType: string;
  } | null;
  canManage: boolean;
  reviewableServiceSessionIds?: number[];
  reviewableServices?: ReviewService[];
  isSuperAdmin: boolean;
  teachers: Teacher[];
  children: Child[];
  summary: { present: number; absent: number; registered: number };
  monthly: {
    month: string;
    sessions: { id: number; serviceDate: string; name?: string }[];
    presentByDate: Record<string, number[]>;
    presentBySession?: Record<string, number[]>;
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
    authorId?: number;
    authorProfileImageUrl?: string | null;
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
const emptyOverview: Overview = { summary: { activeClasses: 0, checkedIn: 0, teachersAssigned: 0, needAttention: 0 }, items: [] };
function Avatar({ teacher }: { teacher: Teacher }) {
  const [imageFailed, setImageFailed] = useState(false);
  return teacher.profileImageUrl && !imageFailed ? (
    <img
      className="teacher-photo"
      src={mediaUrl(teacher.profileImageUrl)}
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

export function ClassroomsOverview({ view = "classrooms" }: { view?: MinistryTab }) {
  const session = useMemo(() => readTeacherSession(), []);
  const context = useSundayContext();
  const isSuperAdmin = session?.accessLevel === "TPK_SUPER_ADMIN";
  const [data, setData] = useState<Overview>(emptyOverview);
  const [classOptions, setClassOptions] = useState<{ id: number; name: string }[]>([]);
  const [assembly, setAssembly] = useState<{ groups: AssemblyGroup[] }>({ groups: [] });
  const activeTab = view;
  const viewTitle = view === "classrooms" ? "Classrooms" : view === "assembly" ? "Assembly discussions" : view === "HEAD_OF_SERVICE" ? "Head of Service discussions" : "Door & Attendance discussions";
  const [localScope, setLocalScope] = useState("THIS");
  const [query, setQuery] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("name");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const selectedService = context.selectedService;
  const serviceDate = context.selectedSundayDate || selectedService?.serviceDate || "";
  useEffect(() => { setLocalScope("THIS"); }, [context.selectedServiceSessionId, context.selectedSundayDate]);
  const serviceScopeParam = localScope === "THIS" ? "THIS" : localScope;
  const load = useCallback(async () => {
    if (!session || !context.selectedServiceSessionId) { setLoading(false); return; }
    const version = ++requestVersion.current;
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams();
      if (serviceScopeParam === "THIS") p.set("serviceSessionId", String(context.selectedServiceSessionId));
      else { p.set("serviceScope", serviceScopeParam); p.set("date", serviceDate); }
      if (query) p.set("search", query);
      if (classId) p.set("classId", classId);
      if (status) p.set("status", status);
      // Filter choices come from the full configured list, not the filtered
      // classroom cards. Searching or selecting a status must not hide Teens.
      const [r, classResponse] = await Promise.all([
        fetch(`${apiBase}/api/v1/classrooms?${p}`, { headers: authHeaders(session) }),
        fetch(`${apiBase}/api/v1/classes`, { headers: authHeaders(session) }),
      ]);
      const [b, classBody] = await Promise.all([r.json(), classResponse.json()]);
      if (!r.ok || !b.success)
        throw new Error(b.error?.message || "We could not load classrooms.");
      if (!classResponse.ok || !classBody.success)
        throw new Error(classBody.error?.message || "We could not load class choices.");
      if (version === requestVersion.current) {
        setData(b.data);
        setClassOptions(classBody.data);
      }
      const a = await fetch(`${apiBase}/api/v1/assembly?${p.toString()}`, { headers: authHeaders(session) });
      const assemblyBody = await a.json();
      if (!a.ok || !assemblyBody.success) throw new Error(assemblyBody.error?.message || "We could not load assembly. Please retry.");
      if (version === requestVersion.current) setAssembly({ groups: assemblyBody.data?.groups || [] });
    } catch (reason) {
      if (version === requestVersion.current) setError(reason instanceof Error ? reason.message : "We could not load this service.");
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [classId, context.selectedServiceSessionId, query, serviceDate, serviceScopeParam, session, status]);
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
  const classroomGroups = data.groups?.length ? data.groups : [{ serviceSession: data.serviceSession || selectedService, summary: data.summary, items: classes }];
  const serviceOptions = [
    ...(selectedService ? [{ value: "THIS", label: `This Service · ${serviceDisplayLabel(selectedService)}` }] : []),
    ...(context.services.some((item) => item.serviceType === "FIRST_SERVICE") ? [{ value: "FIRST_SERVICE", label: "First Service" }] : []),
    ...(context.services.some((item) => item.serviceType === "SECOND_SERVICE") ? [{ value: "SECOND_SERVICE", label: "Second Service" }] : []),
    ...(isSuperAdmin ? [{ value: "ALL", label: "All Services" }] : []),
  ];
  return (
    <section className="cw-page">
      <style>{`
        .cw-page .cw-metrics { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .cw-page .cw-tools { grid-template-columns: minmax(220px, 1.7fr) repeat(4, minmax(145px, 1fr)); }
        @media (max-width: 1100px) {
          .cw-page .cw-tools { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 650px) {
          .cw-page .cw-metrics, .cw-page .cw-tools { grid-template-columns: 1fr; }
        }
      `}</style>
      <header className="cw-heading">
        <div>
          <p className="eyebrow">Petra Mabushi (Regional)</p>
          <h1>{viewTitle}</h1>
          <p>{view === "classrooms" ? "See attendance, children and teachers across TPK classrooms." : "Share how service went, celebrate wins and help the team prepare for next Sunday."}</p>
          {serviceDate && selectedService && <small className="cw-context-line">Viewing Sunday, {formatDate(serviceDate)} · {selectedService.name}</small>}
        </div>
      </header>
      <div>
      {activeTab === "classrooms" ? <>
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
        <Metric icon={<FiAlertTriangle />} value={data.summary.needAttention || classes.filter((item) => item.status === "NEEDS_ATTENTION" || item.status === "NO_TEACHER_ASSIGNED").length} title="Need Attention" text="Selected service" tone="red" />
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
        <AppSelect aria-label="Classroom service filter" value={localScope} onChange={(event) => setLocalScope(event.target.value)} disabled={!serviceOptions.length}>
          {serviceOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </AppSelect>
        <AppSelect
          aria-label="Filter by classroom"
          value={classId}
          onChange={(event) => setClassId(event.target.value)}
        >
          <option value="">All Classes</option>
          {classOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </AppSelect>
        <AppSelect
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="RUNNING_SMOOTHLY">Running Smoothly</option>
          <option value="NEEDS_ATTENTION">Needs Attention</option>
          <option value="NO_TEACHER_ASSIGNED">No Teacher Assigned</option>
        </AppSelect>
        <AppSelect aria-label="Sort classrooms" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Class name A–Z</option><option value="attendance">Highest attendance</option></AppSelect>
      </section>
      {error && <p className="cw-error">{error}</p>}
      <div className="cw-list-heading"><h2>Classrooms ({classes.length})</h2><span>{selectedService ? `${selectedService.name} · ${formatDate(serviceDate)}` : "Choose a service"}</span></div>
      {loading ? (
        <p className="cw-empty">Loading classrooms…</p>
      ) : (
        <>{classroomGroups.map((group, groupIndex) => <section className="cw-service-group" key={group.serviceSession?.id || groupIndex}>
          {data.groups?.length ? <h3>{group.serviceSession?.name || "Service"} · {formatDate(group.serviceSession?.serviceDate)} <small>{group.items.length} classrooms</small></h3> : null}
          <div className="class-grid">{group.items.map((item) => (
            <article className="class-card" key={`${group.serviceSession?.id || "service"}-${item.id}`}>
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
              <p className="teacher-heading">Assigned teachers</p>
              <div className="teacher-strip">
                {item.teachers.length ? (
                  item.teachers.map((teacher) => (
                    <span key={teacher.userId}>
                      <Avatar teacher={teacher} />
                      <b>{teacher.name}</b>
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
                  {group.serviceSession?.serviceDate
                    ? `Service: ${formatDate(group.serviceSession.serviceDate)}`
                    : "No selected service"}
                </small>
                <Link
                  href={`/account/classrooms/${item.id}${group.serviceSession?.id ? `?serviceSessionId=${group.serviceSession.id}&date=${group.serviceSession.serviceDate}` : ""}`}
                >
                  Open Class <FiChevronRight />
                </Link>
              </footer>
            </article>
          ))}{!group.items.length && <p className="cw-empty">No classrooms match these filters.</p>}</div>
        </section>)}</>
      )}
      </> : activeTab === "assembly" ? (
        <AssemblyView groups={assembly.groups} loading={loading} isSuperAdmin={Boolean(isSuperAdmin)} onRefresh={load} />
      ) : selectedService ? (
        <ServiceReviews key={`${activeTab}:${selectedService.id}`} role={activeTab} service={selectedService} />
      ) : <p className="cw-empty">Choose a Sunday service to see its reviews.</p>}
      </div>
      <style jsx>{styles}</style>
      {/* Assembly is a child component, so its styles must not be parent-scoped. */}
      <style>{assemblyStyles}</style>
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

async function changeReview(path: string, method: "PATCH" | "DELETE", body?: { workedWell: string; needsImprovement: string }) {
  const response = await fetch(`${apiBase}/api/v1/${path}`, {
    method,
    headers: { ...authHeaders(), ...(body && { "Content-Type": "application/json" }) },
    ...(body && { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.error?.message || "We could not update this review. Please try again.");
}

function ReviewActions({ onEdit, onDelete, disabled }: { onEdit: () => void; onDelete: () => void; disabled: boolean }) {
  return <div className="review-card-actions">
    <button type="button" disabled={disabled} onClick={onEdit}>Edit review</button>
    <button type="button" disabled={disabled} onClick={onDelete}>Delete review</button>
  </div>;
}

function ServiceReviews({ role, service }: { role: ServiceReviewRole; service: NonNullable<Overview["serviceSession"]> }) {
  const session = useMemo(() => readTeacherSession(), []);
  const [data, setData] = useState<ServiceReviewsData | null>(null);
  const [workedWell, setWorkedWell] = useState("");
  const [needsImprovement, setNeedsImprovement] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const mediaInput = useRef<HTMLInputElement>(null);
  const firstField = useRef<HTMLTextAreaElement>(null);
  const endpoint = `${apiBase}/api/v1/service-reviews`;
  const title = role === "HEAD_OF_SERVICE" ? "Head of Service" : "Teacher at Door & Attendance";
  const myReview = data?.reviews.find((review) => Number(review.authorId) === Number(session?.staffUserId));
  const availableImages = 6 - (myReview?.media.length ?? 0);
  const showForm = myReview ? editing : data?.canReview;
  useEffect(() => {
    if (editing) firstField.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ serviceSessionId: String(service.id), role });
    fetch(`${endpoint}?${query}`, { headers: authHeaders(session), signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load service reviews.");
        const next: ServiceReviewsData = result.data;
        if (controller.signal.aborted) return;
        const own = next.reviews.find((review) => Number(review.authorId) === Number(session.staffUserId));
        setData(next);
        setWorkedWell(own?.workedWell ?? "");
        setNeedsImprovement(own?.needsImprovement ?? "");
      })
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "We could not load service reviews."); });
    return () => controller.abort();
  }, [endpoint, role, service.id, session]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session || !showForm || saving) return;
    setError("");
    setSaved(false);
    if (images.length > availableImages || images.some((image) => image.size > 5 * 1024 * 1024)
        || images.reduce((bytes, image) => bytes + image.size, 0) > TOTAL_UPLOAD_BYTES) {
      setError("Each review can have up to six pictures, 5 MB per picture and 25 MB per upload.");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.set("serviceSessionId", String(service.id));
      form.set("role", role);
      if (myReview) form.set("reviewId", String(myReview.id));
      form.set("workedWell", workedWell.trim());
      form.set("needsImprovement", needsImprovement.trim());
      for (const image of images) form.append("media[]", image);
      const response = await fetch(endpoint, { method: "POST", headers: authHeaders(session), body: form });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) throw new Error(result?.error?.message ||
        (response.status === 413 ? "These pictures are too large. Try smaller files." : "We could not save this review."));
      setData(result.data);
      setImages([]);
      setEditing(false);
      if (mediaInput.current) mediaInput.current.value = "";
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not save this review.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReview() {
    if (!myReview || saving || !window.confirm("Delete your review and its pictures?")) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await changeReview(`service-reviews/${myReview.id}`, "DELETE");
      setData((current) => current && { ...current, reviews: current.reviews.filter((review) => review.id !== myReview.id) });
      setWorkedWell("");
      setNeedsImprovement("");
      setImages([]);
      setEditing(false);
      if (mediaInput.current) mediaInput.current.value = "";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not delete this review.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="class-detail">
    <section className="weekly-reviews" aria-label={`${title} reviews`}>
      <header className="discussion-header">
        <div className="discussion-title">
          <i className="discussion-title-icon"><FiMessageCircle aria-hidden="true" /></i>
          <div>
            <p className="eyebrow">Service reflection</p>
            <h2>{title} reviews</h2>
            <p>{formatDate(service.serviceDate)} · {service.name}</p>
          </div>
        </div>
      </header>
      {error && <p className="review-save-message" role="alert">{error}</p>}
      {!data && !error && <p role="status">Loading service reviews…</p>}
      {saved && <p className="review-save-message success" role="status">Review saved.</p>}
      {showForm && <form className="review-form" onSubmit={save} aria-busy={saving}>
        <div className="review-form-heading"><b>{myReview ? "Update your review" : "Add your review"}</b></div>
        <div className="review-fields">
          <label className="review-field worked">
            <span><FiCheckCircle aria-hidden="true" /> What worked well?</span>
            <textarea ref={firstField} rows={5} maxLength={4000} disabled={saving} value={workedWell} onChange={(event) => { setWorkedWell(event.target.value); setSaved(false); }} />
          </label>
          <label className="review-field improve">
            <span><FiAlertTriangle aria-hidden="true" /> What should we improve?</span>
            <textarea rows={5} maxLength={4000} disabled={saving} value={needsImprovement} onChange={(event) => { setNeedsImprovement(event.target.value); setSaved(false); }} />
          </label>
        </div>
        {availableImages > 0 && <div className="media-picker">
          <label htmlFor="service-review-images">Attach pictures</label>
          <small>Optional · Up to {availableImages} JPEG, PNG or WebP pictures, 5 MB each and 25 MB per upload.</small>
          <input ref={mediaInput} id="service-review-images" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={saving}
            onChange={(event) => { setImages(Array.from(event.target.files ?? [])); setSaved(false); }} />
        </div>}
        <footer className="review-actions">
          <p><FiUsers aria-hidden="true" /> Shared with your campus team.</p>
          {myReview && <button type="button" disabled={saving} onClick={() => {
            setWorkedWell(myReview.workedWell);
            setNeedsImprovement(myReview.needsImprovement);
            setImages([]);
            setError("");
            setEditing(false);
          }}>Cancel</button>}
          <button className="primary" disabled={saving || (!workedWell.trim() && !needsImprovement.trim() && !images.length && !myReview?.media.length)}>
            {saving ? "Saving…" : myReview ? "Save changes" : "Save review"}
          </button>
        </footer>
      </form>}
      {data && <div className="review-list">
        <header className="review-history-heading"><h3>Reviews for this service</h3></header>
        {data.reviews.map((review) => <article key={review.id}>
          <header>
            <TeacherAttribution name={review.author} staffId={review.authorId} photo={review.authorProfileImageUrl} createdAt={review.createdAt} />
            {review.id === myReview?.id && <ReviewActions disabled={saving || editing} onEdit={() => { setSaved(false); setEditing(true); }} onDelete={() => void deleteReview()} />}
          </header>
          {review.workedWell && <p><strong>Worked well</strong>{review.workedWell}</p>}
          {review.needsImprovement && <p><strong>Improve next time</strong>{review.needsImprovement}</p>}
          {review.media.length > 0 && <div className="assembly-media-grid">{review.media.map((item) => <AssemblyAttachment key={item.id} item={item} />)}</div>}
        </article>)}
        {!data.reviews.length && <p>No reviews for this service yet.</p>}
      </div>}
    </section>
  </div>;
}

function AssemblyView({ groups, loading, isSuperAdmin, onRefresh }: { groups: AssemblyGroup[]; loading: boolean; isSuperAdmin: boolean; onRefresh: () => Promise<void> }) {
  const session = useMemo(() => readTeacherSession(), []);
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [showActivity, setShowActivity] = useState(false);
  const [activityName, setActivityName] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [trimming, setTrimming] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaderId, setLeaderId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const group = groups[selectedGroup] || groups[0];
  const sourceDate = group?.serviceSession?.serviceDate || "";
  const sourceId = group?.serviceSession?.id || 0;
  const [historyMonth, setHistoryMonth] = useState(sourceDate.slice(0, 7) || new Date().toISOString().slice(0, 7));
  const [historySunday, setHistorySunday] = useState(sourceDate);
  const [historyService, setHistoryService] = useState(String(sourceId || ""));
  const [history, setHistory] = useState<{ month: string; groups: AssemblyGroup[] } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [historyRetry, setHistoryRetry] = useState(0);
  useEffect(() => {
    if (!sourceDate) return;
    setHistoryMonth(sourceDate.slice(0, 7)); setHistorySunday(sourceDate); setHistoryService(String(sourceId));
    setNote(""); setMessage("");
  }, [sourceDate, sourceId]);
  useEffect(() => {
    const controller = new AbortController();
    setHistoryLoading(true); setHistoryError("");
    fetch(`${apiBase}/api/v1/assembly?month=${encodeURIComponent(historyMonth)}`, { headers: authHeaders(session), signal: controller.signal, cache: "no-store" })
      .then(async (r) => { const b = await r.json(); if (!r.ok || !b?.success) throw new Error(b?.error?.message || "We couldn't load assembly history."); return b.data.groups as AssemblyGroup[]; })
      .then((items) => { if (!controller.signal.aborted) setHistory({ month: historyMonth, groups: items }); })
      .catch((e) => { if (!controller.signal.aborted) setHistoryError(e instanceof Error ? e.message : "We couldn't load assembly history."); })
      .finally(() => { if (!controller.signal.aborted) setHistoryLoading(false); });
    return () => controller.abort();
  }, [historyMonth, historyRetry, session, sourceId]);
  const historyGroups = !historyLoading && !historyError && history?.month === historyMonth ? history.groups : [];
  const sundays = [...new Set(historyGroups.map((item) => item.serviceSession?.serviceDate).filter((date): date is string => Boolean(date)))].sort();
  const sundayGroups = historyGroups.filter((item) => !historySunday || item.serviceSession?.serviceDate === historySunday);
  const visibleGroups = sundayGroups.filter((item) => !historyService || String(item.serviceSession?.id) === historyService);
  const programmeGroup = visibleGroups.length === 1 ? visibleGroups[0] : group;
  // History browsing does not remove the selected-service composer. Permissions stay server-controlled.
  const activityCount = visibleGroups.reduce((sum, item) => sum + item.activities.length, 0);
  const noteCount = visibleGroups.reduce((sum, item) => sum + item.notes.length, 0);
  const refreshHistory = async () => {
    // Keep this view mounted: a parent reload unmounted the composer and reset
    // its month/service filters immediately after a successful save.
    const savedService = programmeGroup?.serviceSession;
    if (savedService) {
      setHistoryMonth(savedService.serviceDate.slice(0, 7));
      setHistorySunday(savedService.serviceDate);
      setHistoryService(String(savedService.id));
    }
    setHistoryRetry((v) => v + 1);
  };
  const changeMonth = (value: Date) => {
    const nextMonth = value.toISOString().slice(0, 7);
    if (nextMonth === historyMonth) return;
    setHistoryLoading(true); setHistoryError("");
    setHistoryMonth(nextMonth); setHistorySunday(""); setHistoryService(""); setNote(""); setMessage("");
  };
  useEffect(() => { if (selectedGroup >= groups.length) setSelectedGroup(0); }, [groups.length, selectedGroup]);
  const canManage = Boolean(programmeGroup?.canManage);
  const submitActivity = async () => {
    if (saving || trimming || !session || !programmeGroup?.serviceSession?.id || !activityName.trim()) return;
    if (attachments.length > 6 || attachments.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024 || attachments.some((f) => f.size > (f.type.startsWith("image/") ? 5 : 20) * 1024 * 1024)) {
      setMessage("Attach up to six files: pictures up to 5 MB, videos up to 20 MB, 25 MB total."); return;
    }
    setSaving(true); setMessage("");
    try {
      const form = new FormData();
      form.set("serviceSessionId", String(programmeGroup.serviceSession.id)); form.set("activityName", activityName.trim());
      form.set("ledByStaffUserId", leaderId); form.set("notes", activityNotes.trim());
      attachments.forEach((file) => form.append("media[]", file));
      const r = await fetch(`${apiBase}/api/v1/assembly/activities`, { method: "POST", headers: authHeaders(session), body: form });
      const b = await r.json().catch(() => null);
      if (!r.ok || !b?.success) throw new Error(b?.error?.message || (r.status === 413 ? "These attachments are too large. Please try smaller files." : "We could not save this activity."));
      setActivityName(""); setActivityNotes(""); setLeaderId(""); setAttachments([]); setShowActivity(false); setMessage("Activity added."); await refreshHistory();
    } catch (e) { setMessage(e instanceof Error ? e.message : "We could not save this activity."); }
    finally { setSaving(false); }
  };
  const addNote = async () => {
    if (saving || !session || !programmeGroup?.serviceSession?.id || !note.trim()) return;
    setSaving(true); setMessage("");
    try {
      const r = await fetch(`${apiBase}/api/v1/assembly/notes`, { method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify({ serviceSessionId: programmeGroup.serviceSession.id, note: note.trim() }) });
      const b = await r.json().catch(() => null);
      if (!r.ok || !b?.success) throw new Error(b?.error?.message || "We could not save this note.");
      setNote(""); setMessage("Note added."); await refreshHistory();
    } catch (e) { setMessage(e instanceof Error ? e.message : "We could not save this note."); }
    finally { setSaving(false); }
  };
  const children = groups.reduce((sum, item) => sum + item.childrenInService, 0);
  const team = groups.reduce((sum, item) => sum + item.team.length, 0);
  const activities = groups.reduce((sum, item) => sum + item.activities.length, 0);
  const attention = groups.reduce((sum, item) => sum + item.needAttention, 0);
  if (loading) return <p className="cw-empty">Loading Assembly…</p>;
  return <section className="assembly-view">
    <div className="assembly-intro"><div><p className="eyebrow">Service ministry</p><h2>Assembly</h2><p>View the team, activities and notes for assembly during the selected service.</p></div>{groups.length > 1 && <AppSelect value={selectedGroup} onChange={(e) => setSelectedGroup(Number(e.target.value))}>{groups.map((item, index) => <option key={item.serviceSession?.id || index} value={index}>{item.serviceSession?.name || "Service"} · {formatDate(item.serviceSession?.serviceDate)}</option>)}</AppSelect>}</div>
    <section className="assembly-metrics"><Metric icon={<FiUsers />} value={children} title="Children in Service" text="Existing service attendance" tone="green" /><Metric icon={<FiUsers />} value={team} title="Assembly Team" text="Assigned for this service" tone="purple" /><Metric icon={<FiClipboard />} value={activities} title="Activities" text="Programme records" /><Metric icon={<FiAlertTriangle />} value={attention} title="Need Attention" text="Items needing review" tone="red" /></section>
    {groups.length > 1 && <div className="assembly-groups">{groups.map((item, index) => <button key={item.serviceSession?.id || index} className={index === selectedGroup ? "selected" : ""} onClick={() => setSelectedGroup(index)}>{item.serviceSession?.name || "Service"}<small>{formatDate(item.serviceSession?.serviceDate)}</small></button>)}</div>}
    <section className="assembly-panel"><header><div><p className="eyebrow">Assigned teachers</p><h3>Assembly Team</h3></div>{isSuperAdmin && <Link href="/account/roster">Manage in Team &amp; Roster <FiChevronRight /></Link>}</header><div className="assembly-team">{group?.team.map((teacher) => <article key={teacher.userId}><Avatar teacher={teacher} /><div><b>{teacher.name}</b><small>{teacher.dutyName || "Assembly"}</small></div></article>)}{!group?.team.length && <p className="cw-empty">No Assembly team assigned.</p>}</div></section>
    <section className="assembly-history-controls" aria-label="Filter assembly activities and notes">
      <header><div><p className="eyebrow">Assembly history</p><h3>Activities &amp; notes</h3><p>Browse by Sunday. Posted and attached dates stay with each record.</p></div><span>{activityCount} {activityCount === 1 ? "activity" : "activities"} · {noteCount} {noteCount === 1 ? "note" : "notes"}</span></header>
      <fieldset className="assembly-history-filters" disabled={saving || showActivity}>
        <div><span>Review month</span><MonthPicker value={new Date(`${historyMonth}-01T00:00:00Z`)} onChange={changeMonth} ariaLabel="Choose assembly month" /></div>
        <label>Sunday<AppSelect value={historySunday} disabled={historyLoading || saving || showActivity} onChange={(e) => { setHistorySunday(e.target.value); setHistoryService(""); setNote(""); setMessage(""); }}><option value="">All Sundays</option>{sundays.map((date) => <option key={date} value={date}>Sun, {formatDate(date)}</option>)}</AppSelect></label>
        <label>Service<AppSelect value={historyService} disabled={historyLoading || saving || showActivity} onChange={(e) => { setHistoryService(e.target.value); setNote(""); setMessage(""); }}><option value="">All services</option>{sundayGroups.map((item) => <option key={item.serviceSession?.id} value={item.serviceSession?.id}>{item.serviceSession?.name || "Service"}{!historySunday ? ` · ${formatDate(item.serviceSession?.serviceDate)}` : ""}</option>)}</AppSelect></label>
      </fieldset>
      {!historyLoading && !historyError && !programmeGroup && <small>Choose a Sunday and service to view its records.</small>}
      {historyLoading && <p role="status">Loading assembly history…</p>}
      {historyError && <div className="interaction-error" role="alert">{historyError}<button type="button" onClick={() => setHistoryRetry((v) => v + 1)}>Retry</button></div>}
    </section>
    <section className="assembly-panel">
      <header><div><p className="eyebrow">Service programme</p><h3>Assembly Programme</h3></div>{canManage && <button className="primary" onClick={() => { setMessage(""); setShowActivity(true); }}><FiPlus /> Add Activity</button>}</header>
      <div className="assembly-activity-list">{visibleGroups.flatMap((item) => item.activities.map((activity) => <article key={activity.id}>
        <div className="assembly-record-service"><FiCalendar aria-hidden="true" /><b>{formatDate(item.serviceSession?.serviceDate)}</b><span>{item.serviceSession?.name || "Sunday service"}</span></div>
        <div className="assembly-activity-copy"><b>{activity.activityName}</b><TeacherAttribution name={activity.ledBy || "Leader not specified"} namePrefix={activity.ledBy ? "Led by" : undefined} staffId={activity.ledByStaffUserId} photo={activity.ledByProfileImageUrl} createdAt={activity.createdAt} label="Activity added" />{activity.notes && <p>{activity.notes}</p>}</div>
        {!!activity.media?.length && <div className="assembly-media-grid">{activity.media.map((item) => <AssemblyAttachment key={item.id} item={item} />)}</div>}<AssemblyActivityReactions activityId={activity.id} />
      </article>))}{!historyLoading && !historyError && !activityCount && <p className="cw-empty">No assembly activities for this selection. Try another Sunday or month.</p>}</div>
    </section>
    <section className="assembly-panel"><header><div><p className="eyebrow">Service reflections</p><h3>Assembly Notes</h3></div></header><div className="assembly-notes">{visibleGroups.flatMap((entry) => entry.notes.map((item) => <article key={item.id}><div className="assembly-record-service"><FiCalendar aria-hidden="true" /><b>{formatDate(entry.serviceSession?.serviceDate)}</b><span>{entry.serviceSession?.name || "Sunday service"}</span></div><TeacherAttribution name={item.author} staffId={item.authorId} photo={item.authorProfileImageUrl} createdAt={item.createdAt} /><p>{item.note}</p><AssemblyNoteReactions noteId={item.id} /></article>))}{!historyLoading && !historyError && !noteCount && <p className="cw-empty">No assembly notes for this selection. Try another Sunday or month.</p>}</div>{canManage && <div className="assembly-note-form"><label htmlFor="assembly-note">Add a note · {formatDate(programmeGroup?.serviceSession?.serviceDate)} · {programmeGroup?.serviceSession?.name}</label><textarea id="assembly-note" disabled={saving} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a short note about this service…" /><button className="primary" onClick={() => void addNote()} disabled={saving || !note.trim()}>{saving ? "Saving…" : "Save note"}</button></div>}</section>
    {message && <p className="cw-save-message">{message}</p>}
    {showActivity && <div className="cw-modal"><section role="dialog" aria-modal="true" aria-labelledby="assembly-activity-title" aria-busy={saving}>
      <button className="modal-close" disabled={saving} onClick={() => setShowActivity(false)} aria-label="Close activity form"><FiX /></button>
      <p className="eyebrow">Assembly Programme</p><h2 id="assembly-activity-title">Add Activity</h2>
      <label>Activity Name<input disabled={saving} maxLength={180} value={activityName} onChange={(e) => setActivityName(e.target.value)} placeholder="e.g. Opening prayer" /></label>
      <p className="assembly-form-context">{formatDate(programmeGroup?.serviceSession?.serviceDate)} · {programmeGroup?.serviceSession?.name}</p>
      <label>Led By<AppSelect disabled={saving} value={leaderId} onChange={(e) => setLeaderId(e.target.value)}><option value="">Choose a teacher (optional)</option>{(programmeGroup?.leaders || programmeGroup?.team || []).map((teacher) => <option key={teacher.userId} value={teacher.userId}>{teacher.name}</option>)}</AppSelect></label>
      <label>Notes <small>(optional)</small><textarea disabled={saving} value={activityNotes} onChange={(e) => setActivityNotes(e.target.value)} placeholder="Add context for the team…" /></label>
      <div className="media-picker"><label htmlFor="assembly-activity-media">Attach pictures or videos</label><small>Optional · up to 6 files. Pictures: 5 MB each. Videos: 20 MB each. Maximum 25 MB total. Use Trim video for a shorter clip before uploading. Only share media suitable for the authorised team.</small><input id="assembly-activity-media" disabled={saving || Boolean(trimming)} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" multiple onChange={(e) => { setAttachments(Array.from(e.target.files || [])); setMessage(""); e.target.value = ""; }} />{attachments.length > 0 && <><ul className="media-selected">{attachments.map((file, index) => <li key={`${file.name}-${index}`}><span>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</span><div className="media-file-actions">{(file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name)) && <button type="button" disabled={saving || Boolean(trimming)} onClick={() => setTrimming(file)}>Trim video<span className="sr-only">: {file.name}</span></button>}<button type="button" disabled={saving || Boolean(trimming)} aria-label={`Remove ${file.name}`} onClick={() => setAttachments((files) => files.filter((_, i) => i !== index))}>Remove</button></div></li>)}</ul><p className={`media-total ${attachments.reduce((sum, file) => sum + file.size, 0) > TOTAL_UPLOAD_BYTES ? "over-limit" : ""}`}>{(attachments.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)} MB of 25 MB total{attachments.reduce((sum, file) => sum + file.size, 0) > TOTAL_UPLOAD_BYTES ? " · Trim a video or remove an attachment before saving." : ""}</p></>}</div>
      {message && <p role="alert" className="interaction-error">{message}</p>}
      <footer><button disabled={saving || Boolean(trimming)} onClick={() => setShowActivity(false)}>Cancel</button><button className="primary" onClick={() => void submitActivity()} disabled={saving || Boolean(trimming) || !activityName.trim()}>{saving ? "Saving activity…" : "Save Activity"}</button></footer>
    </section></div>}
    {trimming && <VideoTrimmer file={trimming} budget={Math.max(0, Math.min(VIDEO_UPLOAD_BYTES, TOTAL_UPLOAD_BYTES - attachments.filter((file) => file !== trimming).reduce((sum, file) => sum + file.size, 0)))} onClose={() => setTrimming(null)} onUse={(clip) => { setAttachments((files) => files.map((file) => file === trimming ? clip : file)); setTrimming(null); setMessage("Trimmed video attached. The original file is unchanged."); }} />}
  </section>;
}

function classroomReviewOptions(data: Detail): ReviewService[] {
  const allowed = new Set(data.reviewableServiceSessionIds?.map(Number));
  const candidates = data.reviewableServices ?? [data.serviceSession, ...data.monthly.sessions]
    .flatMap((service) => service && allowed.has(Number(service.id)) ? [service] : []);
  const unique = new Map<number, ReviewService>();
  for (const service of candidates) {
    const id = Number(service.id);
    if (service.serviceDate.slice(0, 7) === data.monthly.month && !unique.has(id)) {
      unique.set(id, { ...service, id });
    }
  }
  return [...unique.values()].sort((left, right) => left.serviceDate.localeCompare(right.serviceDate));
}

export function ClassroomDetail({ classId, discussionOnly = false }: { classId: number; discussionOnly?: boolean }) {
  const session = useMemo(() => readTeacherSession(), []);
  const searchParams = useSearchParams();
  const context = useSundayContext();
  const [quickTeacher, setQuickTeacher] = useState<TeacherQuickTarget | null>(null);
  const [selectedChildId,setSelectedChildId]=useState<number|null>(null);
  const [exportingChildren,setExportingChildren]=useState(false);
  const [exportError,setExportError]=useState("");
  const requestedServiceId = Number(searchParams.get("serviceSessionId")) || 0;
  const active = context.services.find((service) => service.id === requestedServiceId)
    || context.selectedService;
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState("children");
  const [query, setQuery] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [error, setError] = useState("");
  const [discussionMessage, setDiscussionMessage] = useState("");
  const [reviewSessionId, setReviewSessionId] = useState("");
  const [workedWell, setWorkedWell] = useState("");
  const [needsImprovement, setNeedsImprovement] = useState("");
  const detailRequestVersion = useRef(0);
  useEffect(() => {
    if (active?.serviceDate) setMonth(active.serviceDate.slice(0, 7));
  }, [active?.id, active?.serviceDate]);
  const load = useCallback(async () => {
    if (!session || context.loading) return;
    const requestVersion = ++detailRequestVersion.current;
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
      const next: Detail = b.data;
      const options = classroomReviewOptions(next);
      const preferred = options.find((option) => Number(option.id) === Number(next.serviceSession?.id)) ?? options.at(-1);
      setData(next);
      setReviewSessionId((value) => options.some((option) => String(option.id) === value)
        ? value
        : String(preferred?.id ?? ""));
      setError("");
    } catch (reason) {
      if (requestVersion !== detailRequestVersion.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not load this classroom.",
      );
    }
  }, [active?.id, classId, context.loading, month, session]);
  useEffect(() => {
    setData(null); setReviewSessionId("");
  }, [active?.id, classId]);
  useEffect(() => {
    void load();
  }, [load]);
  const addWeeklyReview = async () => {
    if (
      !session ||
      discussionMessage === "Saving discussion…" ||
      !data || !classroomReviewOptions(data).some((option) => String(option.id) === reviewSessionId) ||
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
      (!attendanceFilter || child.todayStatus === attendanceFilter),
  );
  if (discussionOnly) return <section className="cw-page class-detail" aria-label={`${data.class.name} discussions`}>

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
          authorId={session?.staffUserId}
          onChanged={load}
        />

<style jsx>{styles}</style><style>{mobileDetailStyles}</style></section>;
  return (
    <section className="cw-page class-detail">
      <Link
        className="cw-back"
        href={`/account/classrooms${data.serviceSession?.id ? `?serviceSessionId=${data.serviceSession.id}&date=${data.serviceSession.serviceDate}` : ""}`}
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
              <button
                type="button"
                className="teacher-quick-trigger"
                onClick={() => setQuickTeacher({ userId: teacher.userId, name: teacher.name, image: teacher.profileImageUrl, date: data.serviceSession?.serviceDate, roles: [`${teacher.dutyName || "Class teacher"} · ${data.class.name}`] })}
                aria-label={`View ${teacher.name}'s contact details`}
              >
                <Avatar teacher={teacher} />
              </button>
              <div>
                <button type="button" className="teacher-quick-trigger" onClick={() => setQuickTeacher({ userId: teacher.userId, name: teacher.name, image: teacher.profileImageUrl, date: data.serviceSession?.serviceDate, roles: [`${teacher.dutyName || "Class teacher"} · ${data.class.name}`] })}>
                  <b>{teacher.name}</b>
                </button>
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
        <section className="classroom-children-section">
          <div className="detail-tools">
            <label>
              <FiSearch />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search child by name..."
              />
            </label>
            <AppSelect
              aria-label="Filter classroom attendance"
              value={attendanceFilter}
              onChange={(event) => setAttendanceFilter(event.target.value)}
            >
              <option value="">All Attendance</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
            </AppSelect>
            <button className="classroom-export" type="button" disabled={exportingChildren} onClick={async()=>{setExportError("");setExportingChildren(true);try{await downloadTablePdf(`TPK-${data.class.name.replace(/[^a-z0-9]+/gi,"-")}-${data.serviceSession?.serviceDate||"children"}.pdf`,classroomChildrenReport(data.class.name,data.serviceSession,visible,attendanceFilter,query));}catch(reason){setExportError(reason instanceof Error?reason.message:"We could not export this table. Please try again.");}finally{setExportingChildren(false);}}}><FiFileText/>{exportingChildren?"Preparing PDF…":"Export PDF"}</button>
          </div>
          <div className="classroom-table-heading"><div><h2>Children in {data.class.name}</h2><p>{formatDate(data.serviceSession?.serviceDate)}{data.serviceSession?.name?` · ${data.serviceSession.name}`:""}</p></div><span aria-live="polite">{visible.length} of {data.children.length} children</span></div>
          {exportError&&<p className="cw-error" role="alert">{exportError}</p>}
          <ChildrenTable rows={visible} openChild={setSelectedChildId}/>
        </section>
      )}
      {tab === "attendance" && (
        <Attendance data={data} month={month} setMonth={setMonth} />
      )}{" "}
      <Link className="cw-back" href={`/account/discussions/classrooms?classId=${classId}`}>Open class discussions <FiChevronRight /></Link>
      {selectedChildId!==null&&<ChildProfileDialog key={selectedChildId} childId={selectedChildId} close={()=>setSelectedChildId(null)} onUpdated={()=>void load()} initialMonth={data.serviceSession?.serviceDate.slice(0,7)}/>}
      {tab === "details" && (
        <section className="class-details-panel">
          <header>
            <div><p className="eyebrow">At a glance</p><h2>About this class</h2><p>The essentials for caring for your children.</p></div>
            {data.isSuperAdmin && <Link href="/account/classes" className="class-settings-link">Manage class <FiChevronRight /></Link>}
          </header>
          <div className="class-details-grid">
            <article><span className="class-detail-icon"><FiUsers /></span><h3>Class</h3><p>{data.class.name}</p><small>A place to belong, learn and grow.</small></article>
            <article><span className="class-detail-icon age"><FiUsers /></span><h3>Age range</h3><p>{data.class.ageLabel || "Not recorded"}</p><small>Children served by this class.</small></article>
            <article><span className="class-detail-icon children"><FiCheckCircle /></span><h3>Registered children</h3><p>{data.summary.registered}</p><small>Children on this class’s register.</small></article>
            <article><span className="class-detail-icon service"><FiCalendar /></span><h3>Selected Sunday</h3><p>{formatDate(data.serviceSession?.serviceDate)}</p><small>{data.serviceSession?.name || "No service selected"}</small></article>
          </div>
        </section>
      )}
      {quickTeacher && <TeacherQuickView teacher={quickTeacher} close={() => setQuickTeacher(null)} />}
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
  authorId,
  onChanged,
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
  authorId?: number;
  onChanged: () => Promise<void>;
}) {
  const sessions = classroomReviewOptions(data);
  const saving = discussionMessage === "Saving discussion…";
  const [historySelection, setHistorySelection] = useState<string | null>(null);
  const historyServices = new Map<string, ReviewService>();
  for (const service of [
    data.serviceSession,
    ...data.monthly.sessions,
    ...sessions,
    ...data.weeklyReviews.map((review) => ({ id: review.serviceSessionId, serviceDate: review.serviceDate, name: review.serviceName })),
  ]) {
    if (service?.serviceDate.slice(0, 7) !== month) continue;
    const id = String(service.id);
    if (!historyServices.has(id)) historyServices.set(id, service);
  }
  const activeServiceId = String(data.serviceSession?.id ?? "");
  const defaultHistory = historyServices.has(activeServiceId) ? activeServiceId : "all";
  const historyFilter = historySelection === "all" || (historySelection && historyServices.has(historySelection))
    ? historySelection
    : defaultHistory;
  const visibleReviews = data.weeklyReviews.filter((review) =>
    review.serviceDate.slice(0, 7) === month && (historyFilter === "all" || String(review.serviceSessionId) === historyFilter));
  const historyLoading = data.monthly.month !== month;
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
        <div className="discussion-month">
          <span>Review month</span>
          <MonthPicker
            value={new Date(`${month}-01T00:00:00Z`)}
            onChange={(value) => {
              setHistorySelection(null);
              setMonth(value.toISOString().slice(0, 7));
            }}
            className="discussion-month-picker"
            ariaLabel="Choose review month"
          />
        </div>
      </header>
      {!sessions.length && <p className="cw-empty">There are no completed Sunday services available in this month yet.</p>}
      {sessions.length > 0 && (
        <section className="review-form" aria-busy={saving}>
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
              <AppSelect
                value={reviewSessionId}
                disabled={saving}
                onChange={(event) => {
                  const id = event.target.value;
                  setReviewSessionId(id);
                  if (id) setHistorySelection(id);
                }}
              >
                <option value="">Choose Sunday</option>
                {sessions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {formatDate(item.serviceDate)} ·{" "}
                    {item.name || data.serviceSession?.name || "Service"}
                  </option>
                ))}
              </AppSelect>
            </label>
          </div>
          <div className="review-fields">
            <label className="review-field worked">
              <span><FiCheckCircle /> What worked well?</span>
              <small>Celebrate what helped children engage, learn or settle in.</small>
              <textarea
                disabled={saving}
                rows={6}
                value={workedWell}
                onChange={(event) => setWorkedWell(event.target.value)}
                placeholder="What helped the children learn, participate or settle well?"
              />
            </label>
            <label className="review-field improve">
              <span><FiAlertTriangle /> What should we improve?</span>
              <small>Note one thing to prepare or handle differently next time.</small>
              <textarea
                disabled={saving}
                rows={6}
                value={needsImprovement}
                onChange={(event) => setNeedsImprovement(event.target.value)}
                placeholder="What needs attention before the next Sunday?"
              />
            </label>
          </div>
          <footer className="review-actions">
            <p><FiUsers aria-hidden="true" /> Shared with this class’s teaching team.</p>
            {discussionMessage && <span role="status" className={`review-save-message${discussionMessage === "Discussion saved." ? " success" : ""}`}>{discussionMessage}</span>}
            <button
              className="primary"
              disabled={
                saving ||
                !sessions.some((option) => String(option.id) === reviewSessionId) ||
                (!workedWell.trim() && !needsImprovement.trim())
              }
              onClick={onSave}
            >
              <FiCheckCircle aria-hidden="true" /> {saving ? "Saving…" : "Save discussion"}
            </button>
          </footer>
        </section>
      )}
      <div className="review-list">
        <header className="review-history-heading">
          <div>
            <p className="eyebrow">Discussion history</p>
            <h3>This month’s class reviews</h3>
          </div>
          {!historyLoading && <span aria-live="polite">{visibleReviews.length} {visibleReviews.length === 1 ? "review" : "reviews"}</span>}
        </header>
        <label className="review-history-filter">
          <span>View reviews for</span>
          <AppSelect value={historyFilter} disabled={historyLoading} onChange={(event) => setHistorySelection(event.target.value)}>
            <option value="all">All Sundays</option>
            {[...historyServices.entries()].sort(([, left], [, right]) => left.serviceDate.localeCompare(right.serviceDate)).map(([id, service]) => (
              <option key={id} value={id}>{formatDate(service.serviceDate)} · {service.name || "Sunday service"}</option>
            ))}
          </AppSelect>
        </label>
        {historyLoading && <p className="cw-empty" role="status">Loading reviews for this month…</p>}
        {!historyLoading && visibleReviews.map((review) => (
          <ClassroomReviewCard key={review.id} review={review}
            isAuthor={authorId != null && Number(review.authorId) === Number(authorId)} onChanged={onChanged} />
        ))}
        {!historyLoading && !visibleReviews.length && (
          <div className="discussion-empty">
            <i><FiMessageCircle /></i>
            <div>
              <b>{historyFilter === "all" ? "No reviews for this month yet" : "No reviews for this service yet"}</b>
              <p>Choose another service or month to see more reviews.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ClassroomReviewCard({ review, isAuthor, onChanged }: {
  review: Detail["weeklyReviews"][number];
  isAuthor: boolean;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [workedWell, setWorkedWell] = useState("");
  const [needsImprovement, setNeedsImprovement] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstField = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (editing) firstField.current?.focus();
  }, [editing]);

  async function change(method: "PATCH" | "DELETE") {
    if (busy || !isAuthor) return;
    if (method === "DELETE" && !window.confirm("Delete your review and its discussion?")) return;
    setBusy(true);
    setError("");
    try {
      await changeReview(`classroom-reviews/${review.id}`, method,
        method === "PATCH" ? { workedWell: workedWell.trim(), needsImprovement: needsImprovement.trim() } : undefined);
      await onChanged();
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not update this review.");
    } finally {
      setBusy(false);
    }
  }

  return <article>
    <header>
      <div className="review-service">
        <b>{formatDate(review.serviceDate)}</b>
        <small>{review.serviceName || "Sunday service"}</small>
      </div>
      <TeacherAttribution name={review.author} staffId={review.authorId} photo={review.authorProfileImageUrl} createdAt={review.createdAt} />
      {isAuthor && !editing && <ReviewActions disabled={busy} onEdit={() => {
        setError("");
        setWorkedWell(review.workedWell ?? "");
        setNeedsImprovement(review.needsImprovement ?? "");
        setEditing(true);
      }} onDelete={() => void change("DELETE")} />}
    </header>
    {error && <p className="review-save-message" role="alert">{error}</p>}
    {editing ? <form className="review-inline-editor" onSubmit={(event) => { event.preventDefault(); void change("PATCH"); }}>
      <div className="review-fields">
        <label className="review-field worked">
          <span>What worked well?</span>
          <textarea ref={firstField} value={workedWell} disabled={busy} onChange={(event) => setWorkedWell(event.target.value)} />
        </label>
        <label className="review-field improve">
          <span>What should we improve?</span>
          <textarea value={needsImprovement} disabled={busy} onChange={(event) => setNeedsImprovement(event.target.value)} />
        </label>
      </div>
      <footer className="review-actions">
        <button type="button" disabled={busy} onClick={() => { setError(""); setEditing(false); }}>Cancel</button>
        <button className="primary" disabled={busy || (!workedWell.trim() && !needsImprovement.trim())}>Save changes</button>
      </footer>
    </form> : <>
      {review.workedWell && <p><strong>Worked well</strong>{review.workedWell}</p>}
      {review.needsImprovement && <p><strong>Improve next time</strong>{review.needsImprovement}</p>}
    </>}
    <DiscussionThread reviewId={review.id} />
  </article>;
}

export function ChildrenTable({ rows,openChild }: { rows: Child[];openChild:(id:number)=>void }) {
  return (
    <div className="cw-table children-table">
      <table>
        <caption className="classroom-table-caption">Classroom children and attendance for the selected service</caption>
        <thead><tr><th scope="col">Child</th><th scope="col">Age</th><th scope="col">Parent / guardian</th><th scope="col">Attendance</th><th scope="col">View more</th></tr></thead>
        <tbody>
          {rows.map((child) => (
            <tr key={child.id}>
              <td data-label="Child"><button className="classroom-child-name" type="button" onClick={()=>openChild(child.id)}><span className="classroom-child-initials" aria-hidden="true">{`${child.firstName[0]||""}${child.lastName[0]||""}`.toUpperCase()}</span><b>{child.firstName} {child.lastName}</b></button></td>
              <td data-label="Age"><span>{child.age==null?"Not recorded":`${child.age} ${child.age===1?"year":"years"}`}</span></td>
              <td data-label="Parent / guardian"><div className="classroom-guardian"><b>{child.guardianName||"Not recorded"}</b>{child.guardianPhone&&<a href={`tel:${child.guardianPhone.replace(/[^+\d]/g,"")}`}>{child.guardianPhone}</a>}</div></td>
              <td data-label="Attendance"><Status value={child.todayStatus} /></td>
              <td data-label="View more"><button className="classroom-view-more" type="button" onClick={()=>openChild(child.id)} aria-label={`View more about ${child.firstName} ${child.lastName}`}>View more <FiChevronRight aria-hidden="true"/></button></td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="cw-empty">No children match this filter.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
function Attendance({ data, month, setMonth }: {
  data: Detail;
  month: string;
  setMonth: (value: string) => void;
}) {
  const [sunday, setSunday] = useState(data.serviceSession?.serviceDate || "");
  const historyLoading = data.monthly.month !== month;
  const sessions = historyLoading ? [] : [...data.monthly.sessions];
  const selected = data.serviceSession;
  // Older servers may omit the selected session from history. Keep its canonical roster visible.
  if (!historyLoading && selected?.serviceDate.startsWith(month) && !sessions.some((week) => Number(week.id) === Number(selected.id))) sessions.push(selected);
  sessions.sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || Number(a.id) - Number(b.id));
  const dates = [...new Set(sessions.map((week) => week.serviceDate))];
  const effectiveSunday = sunday && dates.includes(sunday) ? sunday : "";
  const visibleSessions = sessions.filter((week) => !effectiveSunday || week.serviceDate === effectiveSunday);
  const counts = data.children.reduce((summary, child) => {
    visibleSessions.forEach((week) => {
      const status = classroomAttendanceStatus(data, child, week);
      if (status === "PRESENT") summary.present++;
      if (status === "ABSENT") summary.absent++;
    });
    return summary;
  }, { present: 0, absent: 0 });
  const statusBadge = (child: Child, week: Detail["monthly"]["sessions"][number]) => {
    const status = classroomAttendanceStatus(data, child, week);
    return status === "NOT_REGISTERED"
      ? <span className="attendance-not-registered">Not yet registered</span>
      : <Status value={status} />;
  };
  return (
    <section className="class-attendance-panel">
      <header className="class-attendance-header">
        <div><p className="eyebrow">Class register</p><h2>Attendance</h2><p>{historyLoading ? "Loading this month’s register…" : visibleSessions.length ? `${counts.present} present · ${counts.absent} absent${visibleSessions.length > 1 ? " across the services shown" : " for this service"}.` : "No recorded services in this month."}</p></div>
        <div className="class-attendance-filters">
          <div><span>Review month</span><MonthPicker value={new Date(`${month}-01T12:00:00Z`)} onChange={(value) => setMonth(value.toISOString().slice(0, 7))} ariaLabel="Choose attendance month" /></div>
          <label><span>Sunday</span><AppSelect value={effectiveSunday} onChange={(event) => setSunday(event.target.value)} aria-label="Choose attendance Sunday"><option value="">All Sundays</option>{dates.map((date) => <option key={date} value={date}>Sunday, {formatDate(date)}</option>)}</AppSelect></label>
        </div>
      </header>
      {historyLoading ? <div className="class-attendance-empty" role="status">Loading attendance…</div> : visibleSessions.length ? <>
        <div className="cw-table matrix class-attendance-matrix"><table>
          <thead><tr><th>Child</th>{visibleSessions.map((week) => <th key={week.id}><span>{formatDate(week.serviceDate)}</span><small>{week.name || selected?.name || "Sunday service"}</small></th>)}</tr></thead>
          <tbody>{data.children.map((child) => <tr key={child.id}><td><b>{child.firstName} {child.lastName}</b></td>{visibleSessions.map((week) => <td key={week.id}>{statusBadge(child, week)}</td>)}</tr>)}</tbody>
        </table></div>
        <div className="class-attendance-mobile">{data.children.map((child) => <article key={child.id}><h3>{child.firstName} {child.lastName}</h3><div>{visibleSessions.map((week) => <div key={week.id}><span>{formatDate(week.serviceDate)}<small>{week.name || selected?.name || "Sunday service"}</small></span>{statusBadge(child, week)}</div>)}</div></article>)}</div>
        <p className="class-attendance-note">A child remains present after pickup. “Not yet registered” means they joined after that Sunday.</p>
      </> : <div className="class-attendance-empty"><FiCalendar /><h3>No attendance to show</h3><p>Choose another month to see its Sunday registers.</p></div>}
    </section>
  );
}

const styles = `.cw-page{max-width:1260px;padding-top:16px}.cw-heading{margin-bottom:17px}.eyebrow{color:#ff5938;font-size:10px;font-weight:900;letter-spacing:.14em;text-transform:uppercase}.cw-page h1,.cw-page h2,.cw-page h3{font-family:var(--font-display,var(--font-body),sans-serif);color:#101d3b}.cw-page h1{margin:5px 0;font-size:37px;letter-spacing:-1.2px}.cw-heading>div>p:last-child,.detail-header p{margin:0;color:#617493;font-size:15px}.cw-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:19px 0}.cw-metric{min-height:104px;padding:17px;border:1px solid #f0e6df;border-radius:10px;background:#fff5f1;display:grid;grid-template-columns:51px 1fr;grid-template-rows:30px 20px 18px}.cw-metric>i{grid-row:1/4;width:43px;height:43px;border-radius:10px;background:#ffe2db;color:#ff5938;display:grid;place-items:center;font-size:22px}.cw-metric b{font:700 28px var(--font-body),sans-serif}.cw-metric strong{font-size:12px}.cw-metric small{color:#70809a;font-size:10px}.cw-metric.green{background:#effbf4}.cw-metric.green>i{background:#d7f6e3;color:#009653}.cw-metric.purple{background:#f5f0ff}.cw-metric.purple>i{background:#e7dcff;color:#7440e8}.cw-metric.red{background:#fff1ee}.cw-metric.red>i{background:#ffdcd7;color:#f04d35}.cw-metric.blue{background:#edf6ff}.cw-metric.blue>i{background:#dceeff;color:#1576d2}.cw-tools,.detail-tools{display:grid;grid-template-columns:minmax(250px,1.7fr) 180px 180px auto;gap:10px;margin:18px 0}.cw-tools label,.detail-tools label{height:41px;border:1px solid #dbe1eb;border-radius:8px;background:#fff;display:flex;align-items:center;gap:9px;padding:0 12px;color:#6580a3}.cw-tools input,.detail-tools input{min-width:0;width:100%;border:0;outline:0;background:transparent;font:12px var(--font-body)}.cw-tools select,.detail-tools select,.cw-table select{height:41px;border:1px solid #dbe1eb;border-radius:8px;background:#fff;padding:0 10px;color:#1a2c4a;font:700 11px var(--font-body)}.cw-tools button,.detail-tools button{height:41px;border:1px solid #dbe1eb;border-radius:8px;background:#fff;padding:0 13px;font:800 11px var(--font-body);display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer}.cw-list-heading{display:flex;align-items:center;justify-content:space-between;margin-top:24px}.cw-list-heading h2{font-size:22px;margin:0}.cw-list-heading span{color:#5d6e89;font-size:11px}.class-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:15px}.class-card{min-height:270px;border:1px solid #e1e4e9;border-radius:10px;background:#fff;padding:16px;display:flex;flex-direction:column}.class-card>header{display:flex;justify-content:space-between;gap:10px}.class-card>header>div{display:grid;grid-template-columns:47px 1fr;column-gap:10px}.class-symbol{grid-row:1/3;width:45px;height:45px;border-radius:11px;display:grid;place-items:center;background:#fbe5f6;color:#d336a7;font-size:21px}.class-card h3{margin:2px 0 3px;font-size:18px}.class-card header p{margin:0;color:#6d7e99;font-size:11px}.cw-status{width:max-content;max-width:100%;display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:5px 8px;font-size:10px;font-weight:900;white-space:nowrap}.cw-status.good{background:#e6f8ec;color:#07844f}.cw-status.warn{background:#fff0e8;color:#d85332}.cw-status.quiet{background:#eff2f7;color:#5e6d85}.teacher-heading{margin:17px 0 8px;color:#1b2b49;font-size:11px;font-weight:900}.teacher-strip{display:flex;gap:9px;min-height:46px;flex-wrap:wrap}.teacher-strip>span{display:grid;grid-template-columns:31px auto;column-gap:6px;min-width:105px}.teacher-strip b{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.teacher-strip small{grid-column:2;color:#71809a;font-size:9px}.teacher-photo{width:31px;height:31px;border-radius:50%;object-fit:cover;background:#e9effa;color:#2d67a7;display:grid;place-items:center;font-size:9px;font-style:normal;font-weight:900}.no-teacher{font-size:10px;color:#d64e32;text-decoration:none;display:flex;gap:4px;align-items:center}.class-numbers{display:grid;grid-template-columns:repeat(3,1fr);margin:14px 0}.class-numbers b{font:700 21px var(--font-body),sans-serif}.class-numbers small{display:block;color:#71809a;font:600 10px var(--font-body)}.attendance-progress{display:grid;grid-template-columns:1fr auto;align-items:center;gap:10px;font-size:10px;font-weight:800;color:#18345e}.attendance-progress:before{content:"";grid-area:1/1;height:9px;border-radius:99px;background:#e8edf3}.attendance-progress i{grid-area:1/1;height:9px;border-radius:99px;background:#00af65;z-index:1}.attendance-progress span{grid-area:1/2}.class-card footer{display:flex;align-items:center;justify-content:space-between;margin-top:auto;padding-top:13px;border-top:1px solid #edf0f3}.class-card footer small{display:flex;align-items:center;gap:5px;color:#71809a;font-size:9px}.class-card footer a,.assigned header a,.class-info a{border:1px solid #dce2eb;border-radius:7px;padding:8px 10px;color:#075dd3;text-decoration:none;font-size:10px;font-weight:900;display:flex;align-items:center;gap:4px}.cw-empty{min-height:90px;display:grid;place-items:center;gap:6px;color:#74829a;font-size:12px;text-align:center}.cw-empty b{color:#1d2f4c}.cw-error{padding:13px;border-radius:8px;background:#fff0ed;color:#c6452d}.cw-back{display:inline-flex;align-items:center;gap:7px;color:#476187;text-decoration:none;font-size:11px;font-weight:800}.detail-header{display:flex;align-items:center;justify-content:space-between;margin:10px 0 14px}.detail-header h1{margin:4px 0}.detail-metrics{grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}.assigned{padding:15px;border:1px solid #e1e4e9;border-radius:10px;background:#fff}.assigned header{display:flex;align-items:center;justify-content:space-between;gap:10px}.assigned h2{margin:0;font-size:19px}.teacher-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.teacher-cards article{min-height:78px;padding:12px;border:1px solid #e1e5eb;border-radius:8px;display:flex;align-items:flex-start;gap:9px}.teacher-cards article>div{min-width:0;flex:1;display:grid;gap:4px}.teacher-cards b{font-size:11px}.teacher-cards small{overflow:hidden;color:#70809a;font-size:9px;text-overflow:ellipsis;white-space:nowrap}.teacher-cards p{margin:0;color:#6f7f97;font-size:11px}.teacher-cards p a{color:#075dd3}.class-tabs{display:flex;gap:5px;margin-top:20px;border-bottom:1px solid #e2e6eb;overflow:auto}.class-tabs button{flex:none;border:0;border-bottom:2px solid transparent;background:transparent;padding:11px 14px;color:#64738c;font:800 11px var(--font-body);cursor:pointer}.class-tabs button.selected{border-color:#ff5938;color:#142543}.detail-tools{grid-template-columns:minmax(220px,1.5fr) repeat(3,170px) auto}.primary{border-color:#ff5938!important;background:#ff5938!important;color:#fff!important}.cw-table{overflow:auto;border:1px solid #e0e4ea;border-radius:9px;background:#fff}.cw-table table{width:100%;border-collapse:collapse;min-width:720px}.cw-table th{padding:11px;text-align:left;background:#fbfaf7;color:#73819a;font-size:9px;text-transform:uppercase;letter-spacing:.05em}.cw-table td{padding:11px;border-top:1px solid #ebedf0;color:#203451;font-size:11px}.cw-table td a{color:#153d86;text-decoration:none}.cw-table td small{display:block;color:#71809b;font-size:9px;margin-top:3px}.cw-table select{height:31px;font-size:10px}.attendance-view>header,.assignment-panel>header{display:flex;justify-content:space-between;align-items:center;padding:16px 0}.attendance-view h2,.assignment-panel h2{margin:0;font-size:21px}.attendance-view p,.assignment-panel p{color:#697a95;font-size:12px}.attendance-view input{height:38px;border:1px solid #dbe1eb;border-radius:7px;padding:0 9px;font:11px var(--font-body)}.matrix th small{display:block;margin-top:3px;font-size:8px}.notes-panel{display:grid;gap:10px;padding:16px 0}.notes-panel textarea{min-height:90px;border:1px solid #dce1e8;border-radius:8px;padding:11px;font:12px var(--font-body);resize:vertical}.notes-panel article{padding:13px;border:1px solid #e2e5ea;border-radius:8px;background:#fff}.notes-panel article small{margin-left:8px;color:#75829a;font-size:9px}.notes-panel article p{margin:7px 0 0;color:#586a85;font-size:12px;white-space:pre-wrap}.class-info{display:grid;gap:10px;padding:17px 0}.class-info p{display:grid;gap:3px;margin:0;color:#677995;font-size:12px}.class-info b{color:#182b48}.assignment-panel{padding:5px 0}.assignment-panel>header{padding-bottom:8px}.cw-modal{position:fixed;z-index:99;inset:0;background:#0a173a77;display:grid;place-items:center;padding:20px}.cw-modal>section{position:relative;width:min(100%,510px);padding:25px;border-radius:12px;background:#fffdfa;box-shadow:0 20px 60px #101c373d;display:grid;gap:12px}.cw-modal h2{margin:0;font:700 26px var(--font-body),sans-serif}.cw-modal label{display:grid;gap:6px;color:#33445f;font-size:11px;font-weight:800}.cw-modal input,.cw-modal textarea{border:1px solid #dce2eb;border-radius:8px;padding:10px;font:12px var(--font-body)}.cw-modal textarea{min-height:90px;resize:vertical}.modal-close{position:absolute;top:12px;right:14px;border:0;background:none;font-size:23px;cursor:pointer}.cw-modal footer{display:flex;justify-content:flex-end;gap:9px}.cw-modal footer button{height:40px;border:1px solid #dce2eb;border-radius:8px;padding:0 14px;background:#fff;font:800 11px var(--font-body);cursor:pointer}@media(max-width:1100px){.cw-metrics{grid-template-columns:repeat(2,1fr)}.class-grid{grid-template-columns:1fr}.cw-tools,.detail-tools{grid-template-columns:1fr 1fr}.cw-tools label,.detail-tools label{grid-column:1/-1}.teacher-cards{grid-template-columns:1fr 1fr}}@media(max-width:650px){.cw-page{padding-top:0}.cw-page h1{font-size:31px}.cw-metrics,.cw-tools,.detail-tools,.teacher-cards{grid-template-columns:1fr}.cw-tools label,.detail-tools label{grid-column:auto}.cw-list-heading{align-items:flex-start;gap:7px;flex-direction:column}.class-card{min-height:285px}.detail-header{align-items:flex-start;gap:10px;flex-direction:column}.assigned header{align-items:flex-start;flex-direction:column}.class-tabs button{padding:11px 9px;font-size:10px}.cw-modal{align-items:end;padding:0}.cw-modal>section{width:100%;border-radius:14px 14px 0 0}.teacher-cards article{min-width:0}}`;

const assemblyStyles = `.cw-context-line{display:block;margin-top:7px;color:#7586a0;font-size:11px}.cw-service-group{margin-top:15px}.cw-service-group>h3{display:flex;align-items:baseline;gap:8px;margin:18px 0 0;font-size:17px}.cw-service-group>h3 small{font:600 10px var(--font-body);color:#76849d}.assembly-view{display:grid;gap:15px}.assembly-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;padding:20px;border:1px solid #f0e6df;border-radius:12px;background:#fff8f1}.assembly-intro h2{margin:3px 0;font:700 28px var(--font-body),sans-serif;color:#15294a}.assembly-intro p{margin:0;color:#667895;font-size:12px}.assembly-intro select{height:39px;border:1px solid #dbe1eb;border-radius:8px;background:#fff;padding:0 11px;color:#1a2c4a;font:700 11px var(--font-body)}.assembly-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.assembly-groups{display:flex;gap:8px;overflow:auto}.assembly-groups button{flex:none;border:1px solid #dce2eb;border-radius:8px;background:#fff;padding:9px 12px;color:#536783;font:800 11px var(--font-body);cursor:pointer}.assembly-groups button.selected{border-color:#ff5938;background:#fff1eb;color:#d94f32}.assembly-groups small{display:block;margin-top:2px;color:#8693a8;font-size:9px}.assembly-panel{padding:17px;border:1px solid #e1e5eb;border-radius:11px;background:#fff}.assembly-panel>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:13px}.assembly-panel h3{margin:2px 0 0;font-size:19px}.assembly-panel>header a{border:1px solid #dce2eb;border-radius:7px;padding:8px 10px;color:#075dd3;text-decoration:none;font-size:10px;font-weight:900;display:flex;align-items:center;gap:4px}.assembly-panel>header button{height:37px;display:flex;align-items:center;gap:5px}.assembly-team{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.assembly-team article{display:flex;gap:9px;align-items:flex-start;padding:12px;border:1px solid #e3e7ed;border-radius:9px;background:#fffdfa}.assembly-team article>div{display:grid;gap:4px;min-width:0}.assembly-team b{font-size:11px}.assembly-team small{color:#71809a;font-size:10px}.assembly-team .cw-status{font-size:9px;padding:3px 6px}.assembly-activity-list{display:grid;gap:8px}.assembly-activity-list article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;border:1px solid #e3e7ed;border-radius:8px}.assembly-activity-list article>div{display:grid;gap:4px;min-width:0}.assembly-activity-list b{font-size:12px;color:#1b2d4b}.assembly-activity-list small{color:#71809a;font-size:10px}.assembly-activity-list select{height:32px;border:1px solid #dbe1eb;border-radius:7px;background:#fff;padding:0 8px;color:#1a2c4a;font:700 10px var(--font-body)}.assembly-notes{display:grid;gap:8px}.assembly-notes article{padding:12px;border-left:3px solid #ff5938;border-radius:7px;background:#fff8f1}.assembly-notes p{margin:0;color:#425673;font-size:12px;line-height:1.55;white-space:pre-wrap}.assembly-notes small{display:block;margin-top:8px;color:#78869e;font-size:9px}.assembly-note-form{display:flex;gap:9px;margin-top:12px}.assembly-note-form textarea{flex:1;min-height:67px;border:1px solid #dce2eb;border-radius:8px;padding:10px;font:12px var(--font-body);resize:vertical}.assembly-note-form button{align-self:flex-end;height:38px}.assembly-empty{display:grid;place-items:center;gap:8px;min-height:220px;border:1px dashed #d8e0ea;border-radius:11px;color:#74829a;text-align:center}.assembly-empty svg{font-size:30px;color:#ff5938}.assembly-empty h2{margin:0;color:#1b2d4b;font:700 20px var(--font-body),sans-serif}.assembly-empty p{margin:0;font-size:12px}.cw-save-message{margin:0;padding:10px;border-radius:7px;background:#effbf4;color:#07844f;font-size:11px}@media(max-width:900px){.assembly-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.assembly-team{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.cw-primary-tabs button{padding:11px 13px}.assembly-intro{align-items:stretch;flex-direction:column}.assembly-intro select{width:100%}.assembly-metrics,.assembly-team{grid-template-columns:1fr}.assembly-panel>header{align-items:flex-start;flex-direction:column}.assembly-activity-list article{align-items:flex-start;flex-direction:column}.assembly-activity-list select{width:100%}.assembly-note-form{align-items:stretch;flex-direction:column}.assembly-note-form button{width:100%}}`;

const mobileDetailStyles = `
  .attendance-cards{display:none}.weekly-reviews{padding:18px 0}.weekly-reviews>header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:14px}.weekly-reviews h2{margin:4px 0;font-size:23px}.weekly-reviews p{margin:0;color:#697a95;font-size:12px}.weekly-reviews>header label{display:grid;gap:5px;color:#62718a;font-size:10px;font-weight:800}.weekly-reviews input,.review-form select,.review-form textarea{border:1px solid #dce2eb;border-radius:8px;background:#fff;padding:10px;color:#203451;font:12px var(--font-body)}.review-form{padding:15px;border:1px solid #e1e5eb;border-radius:10px;background:#fffdfa}.review-form-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;color:#243653;font-size:12px}.review-form-heading select{min-width:220px}.review-fields{display:grid;grid-template-columns:1fr 1fr;gap:11px}.review-fields label{display:grid;gap:6px;color:#40516d;font-size:11px;font-weight:800}.review-fields textarea{min-height:96px;resize:vertical}.review-form .primary{height:39px;margin-top:12px}.review-form .primary:disabled{cursor:not-allowed;opacity:.48}.review-list{display:grid;gap:10px;margin-top:14px}.review-list article{padding:14px;border:1px solid #e2e5ea;border-radius:9px;background:#fff}.review-list article header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.review-list article header div{display:grid;gap:4px}.review-list article header b{font-size:12px}.review-list article header small{color:#71809b;font-size:10px}.review-list article header svg{color:#ff5938}.review-list article p{display:grid;gap:4px;margin:12px 0 0;white-space:pre-wrap;color:#586a85;line-height:1.5}.review-list article strong{color:#203451;font-size:11px}.teacher-cards article>a{display:block;line-height:0}.teacher-cards article>div>a{color:#172a48;text-decoration:none}.teacher-cards article>div>a:hover{text-decoration:underline}
  @media(max-width:650px){.cw-page{width:100%;max-width:100%;overflow:hidden}.cw-table.children-table{overflow:visible;border:0;background:transparent}.children-table table,.children-table tbody,.children-table tr,.children-table td{display:block;width:100%;box-sizing:border-box;min-width:0}.children-table thead{display:none}.children-table tr{margin-bottom:10px;overflow:hidden;border:1px solid #e0e4ea;border-radius:10px;background:#fff}.children-table td{display:flex;align-items:center;justify-content:space-between;gap:14px;border-top:1px solid #edf0f2;padding:10px 12px;text-align:right}.children-table td:first-child{border-top:0;background:#fbfaf7;text-align:left}.children-table td:before{content:attr(data-label);flex:none;color:#74819a;text-align:left;font-size:9px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}.children-table td:first-child:before{display:none}.children-table td select{max-width:155px}.matrix{display:none}.attendance-cards{display:grid;gap:9px;margin-top:13px}.attendance-cards article{padding:12px;border:1px solid #e0e4ea;border-radius:9px;background:#fff}.attendance-cards article>b{display:block;margin-bottom:8px;font-size:12px;color:#203451}.attendance-cards article>div{display:grid;gap:7px}.attendance-cards article span{display:flex;align-items:center;justify-content:space-between;gap:9px}.attendance-cards article small{color:#70809a;font-size:10px}.weekly-reviews>header{align-items:flex-start;flex-direction:column}.weekly-reviews>header label,.weekly-reviews input{width:100%;box-sizing:border-box}.review-form-heading{align-items:stretch;flex-direction:column}.review-form-heading select{min-width:0;width:100%}.review-fields{grid-template-columns:1fr}.review-form .primary{width:100%}.teacher-cards article{min-width:0}.class-tabs{padding-bottom:1px}.class-tabs button{font-size:9px}.detail-metrics{grid-template-columns:1fr 1fr}.detail-metrics .cw-metric{min-height:92px;padding:12px;grid-template-columns:42px 1fr}.detail-metrics .cw-metric>i{width:35px;height:35px;font-size:18px}.detail-metrics .cw-metric b{font-size:23px}}
`;

"use client";

import Link from "next/link";
import { AttentionPanel } from "@/components/attention-panel";
import { EventHighlights } from "@/components/events-workspace";
import { TeacherQuickView, type TeacherQuickTarget } from "@/components/dashboard-quick-views";
import { useEffect, useState } from "react";
import {
  FiCheckCircle,
  FiCalendar,
  FiChevronRight,
  FiClock,
  FiUsers,
} from "react-icons/fi";
import { QuickActions } from "@/components/quick-actions";
import { UserGreeting } from "@/components/user-greeting";
import { StatCard } from "@/components/stat-card";
import { apiBase, authHeaders, mediaUrl, readTeacherSession } from "@/lib/session";
import { subscribeToActiveService } from "@/lib/active-service";
import { useSundayContext } from "@/lib/sunday-context";
import "./overview-team.css";

type DashboardClass = {
  id: number;
  name: string;
  ageLabel: string;
  checkedIn: number;
  total: number;
};
type Attention = {
  type: string;
  severity: string;
  message: string;
  actionLabel: string;
  actionDestination: string;
};
type PersonalAssignment = {
  assignmentId?: number;
  assignmentDate: string;
  serviceSessionId?: number | null;
  dutyName: string;
  className?: string;
  serviceName?: string;
  serviceType?: string;
};
type Dashboard = {
  serviceSession: { serviceType?: string; name?: string } | null;
  metrics: {
    checkedIn: number;
    pickedUp: number;
    stillPresent: number;
    activeClasses: number;
  };
  classes: DashboardClass[];
  personalAssignment: PersonalAssignment | null;
  personalAssignments: PersonalAssignment[];
  todayTeam: {
    assignmentId: number;
    userId: number;
    serviceType: string;
    status: string;
    dutyName: string;
    teacherName: string;
    profileImageUrl?: string | null;
  }[];
  needsAttention: Attention[];
  childrenRelations: { total: number; contacted: number; pending: number };
  upcomingRoster: {
    assignmentDate: string;
    serviceSessionId: number;
    duties: number;
    filled: number;
    teachers?: number;
    serviceName?: string;
  }[];
};
const empty: Dashboard = {
  serviceSession: null,
  metrics: { checkedIn: 0, pickedUp: 0, stillPresent: 0, activeClasses: 0 },
  classes: [],
  personalAssignment: null,
  personalAssignments: [],
  todayTeam: [],
  needsAttention: [],
  childrenRelations: { total: 0, contacted: 0, pending: 0 },
  upcomingRoster: [],
};
const teacherInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "TP";
const teacherImage = mediaUrl;
function TeacherPhoto({ name, src }: { name: string; src?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  return src && !imageFailed ? (
    <img src={teacherImage(src)} alt={`${name} profile`} onError={() => setImageFailed(true)} />
  ) : (
    <i aria-hidden>{teacherInitials(name)}</i>
  );
}
export default function AccountOverview() {
  const session = readTeacherSession();
  const sundayContext = useSundayContext();
  const [dashboard, setDashboard] = useState<Dashboard>(empty);
  const [live, setLive] = useState(false);
  const [quickTeacher, setQuickTeacher] = useState<TeacherQuickTarget | null>(null);
  const [today, setToday] = useState("");
  const [serviceSessionId, setServiceSessionId] = useState<
    number | undefined
  >();
  useEffect(() => {
    setToday(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date()));
  }, []);
  useEffect(
    () =>
      subscribeToActiveService((service) => setServiceSessionId(service?.id)),
    [],
  );
  useEffect(() => {
    if (!session || !serviceSessionId) return;
    setLive(false);
    fetch(
      `${apiBase}/api/v1/dashboard/overview?serviceSessionId=${serviceSessionId}`,
      { headers: authHeaders(session) },
    )
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((response) => {
        if (response.success) {
          setDashboard(response.data);
          setLive(true);
        }
      })
      .catch(() => setLive(false));
  }, [serviceSessionId]); // eslint-disable-line react-hooks/exhaustive-deps
  const superAdmin = session?.accessLevel === "TPK_SUPER_ADMIN";
  const todayInLagos = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  const viewingToday = sundayContext.selectedSundayDate === todayInLagos;
  const viewingHistorical = Boolean(sundayContext.selectedSundayDate && !viewingToday);
  const { metrics, classes } = dashboard;
  const upcomingSundays = dashboard.upcomingRoster.filter(item => new Date(`${item.assignmentDate}T12:00:00Z`).getUTCDay() === 0);
  const personalAssignments = dashboard.personalAssignments?.length
    ? dashboard.personalAssignments
    : dashboard.personalAssignment
      ? [dashboard.personalAssignment]
      : [];
  return (
    <div className="overview">
      <header className="overview-header">
        <div>
          <p className="eyebrow">
            Petra Wuse {live && <span className="live-status">Live</span>}
          </p>
          <UserGreeting />
          <p className="intro">
            {superAdmin
              ? "Here’s what’s happening across TribePetra Kids."
              : "Here’s what you’re responsible for at TribePetra Kids."}
          </p>
          {sundayContext.selectedSundayDate && sundayContext.selectedService && <p className="context-indicator">Viewing Sunday, {new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${sundayContext.selectedSundayDate}T12:00:00Z`))} · {sundayContext.selectedService.name}</p>}
        </div>
      </header>
      <EventHighlights />
      {personalAssignments.length > 0 && (
        <section className="panel assignment-card">
          <div>
            <p className="eyebrow">
              {today && personalAssignments.some((assignment) => assignment.assignmentDate === today)
                ? "You’re Serving Today"
                : "Your Assignment"}
            </p>
            <h2>{personalAssignments.length === 1 ? personalAssignments[0].dutyName : "Today’s roles"}</h2>
            <div className="assignment-list">
              {personalAssignments.map((assignment, index) => (
                <div className="assignment-row" key={assignment.assignmentId ?? `${assignment.assignmentDate}-${assignment.dutyName}-${assignment.serviceSessionId ?? index}`}>
                  <b>{assignment.dutyName}</b>
                  <span>{[assignment.serviceName, assignment.className].filter(Boolean).join(" · ") || "Service assignment"}</span>
                </div>
              ))}
            </div>
          </div>
          <Link className="outline-button" href="/account/roster">
            View My Roster <FiChevronRight />
          </Link>
        </section>
      )}
      <section className="metrics">
        <Metric
          icon={<FiUsers />}
          value={String(metrics.checkedIn)}
          title="Checked In"
          sub={
            dashboard.serviceSession
              ? "Children checked in this service"
              : "No service is currently open"
          }
          tone="orange"
        />
        <Metric
          icon={<FiCheckCircle />}
          value={String(metrics.pickedUp)}
          title="Picked Up"
          sub="Children safely collected"
          tone="green"
        />
        <Metric
          icon={<FiClock />}
          value={String(viewingHistorical ? metrics.pickedUp : metrics.stillPresent)}
          title={viewingHistorical ? "Completed Pickups" : "Still Present"}
          sub={viewingHistorical ? "Children safely collected" : dashboard.serviceSession ? "Children currently in class" : "Shown when a service is open"}
          tone="yellow"
        />
        <Metric
          icon={<FiUsers />}
          value={String(metrics.activeClasses)}
          title="Active Classes"
          sub="Configured classes"
          tone="dark"
        />
      </section>
      <section className="dashboard-grid">
        <div className="left-column">
          <section className="panel attendance-panel">
            <div className="panel-heading">
              <div>
                <h2>Attendance by Class</h2>
                <p>
                  {dashboard.serviceSession
                    ? "Children checked in for the current service."
                    : "Registered children by class."}
                </p>
              </div>
              <Link href="/account/classrooms" className="outline-button">
                View All Classrooms <FiChevronRight />
              </Link>
            </div>
            <div className="attendance-list">
              {classes.length ? (
                classes.map((item) => (
                  <div className="attendance-row" key={item.id}>
                    <div>
                      <b>{item.name}</b>
                      <span>{item.ageLabel}</span>
                    </div>
                    <div className="progress">
                      <i
                        style={{
                          width: `${item.total ? (item.checkedIn / item.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <strong>
                      {item.checkedIn}/{item.total}
                    </strong>
                  </div>
                ))
              ) : (
                <p className="account-empty">
                  No classes are available for your current assignment.
                </p>
              )}
            </div>
          </section>
          <>
              <section className="panel team-summary">
                <div className="panel-heading">
                  <div>
                    <h2>{viewingToday ? "Today’s Team" : "Service Team"}</h2>
                    <p>{viewingToday ? "See who is assigned and available for service." : "See who was assigned for this service."}</p>
                  </div>
                  <Link href="/account/roster" className="outline-button">
                    {superAdmin ? "Manage Roster" : "View My Roster"} <FiChevronRight />
                  </Link>
                </div>
                {dashboard.todayTeam.length ? (
                  <div className="team-people-list">
                    {dashboard.todayTeam.slice(0, 5).map((item) => (
                      <button
                        type="button"
                        key={item.assignmentId}
                        onClick={() => setQuickTeacher({ userId: item.userId, name: item.teacherName, image: item.profileImageUrl, date: sundayContext.selectedSundayDate || undefined, roles: dashboard.todayTeam.filter(assignment => Number(assignment.userId) === Number(item.userId)).map(assignment => `${assignment.dutyName} · ${assignment.serviceType.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, char => char.toUpperCase())}`) })}
                        className="team-person"
                      >
                        <TeacherPhoto
                          name={item.teacherName}
                          src={item.profileImageUrl}
                        />
                        <span>
                          <b>{item.teacherName}</b>
                          <small>
                            {item.dutyName} ·{" "}
                            {item.serviceType.replaceAll("_", " ")}
                          </small>
                        </span>
                        <em
                          className={
                            item.status === "PRESENT" ? "present" : "assigned"
                          }
                        >
                          {item.status === "PRESENT" ? "Present" : "Assigned"}
                        </em>
                        <FiChevronRight />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="account-empty">
                    No roster assignments are scheduled for this service date.
                  </p>
                )}
              </section>
              {superAdmin && <section className="panel roster-summary">
                <div className="panel-heading">
                  <div>
                    <h2>Upcoming Sunday</h2>
                    <p>Staffing for the next scheduled roster.</p>
                  </div>
                  <Link href="/account/roster" className="outline-button">
                    Manage Roster <FiChevronRight />
                  </Link>
                </div>
                {upcomingSundays.length ? (
                  <div className="upcoming-service-list">
                    {upcomingSundays.map((item) => (
                      <div
                        key={`${item.assignmentDate}-${item.serviceSessionId}`}
                      >
                        <i><FiCalendar /></i><section><small>Sunday · {new Intl.DateTimeFormat("en-NG", {day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${item.assignmentDate}T12:00:00Z`))}</small><b>{item.serviceName || "Scheduled service"}</b><span>{item.teachers != null ? `${item.teachers} teacher${Number(item.teachers) === 1 ? "" : "s"} assigned` : "Staffing count unavailable"}</span></section><Link href={`/account/roster?date=${item.assignmentDate}`} aria-label={`View roster for ${item.assignmentDate}`}><FiChevronRight /></Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="account-empty">
                    No upcoming roster entries are available yet.
                  </p>
                )}
              </section>}
          </>
        </div>
        <aside className="right-column">
          <QuickActions />
          <AttentionPanel items={dashboard.needsAttention} />
          {superAdmin && (
            <section className="panel relations-summary">
              <div className="panel-heading">
                <div>
                  <h2>Children’s follow-up</h2>
                  <p>A caring check-in for children we’ve missed.</p>
                </div>
                <Link href="/account/relations" className="outline-button">
                  View Follow-Ups <FiChevronRight />
                </Link>
              </div>
              <div className="relation-numbers">
                <b>
                  {dashboard.childrenRelations.total || 0}
                  <small>need follow-up</small>
                </b>
                <b>
                  {dashboard.childrenRelations.contacted || 0}
                  <small>families contacted</small>
                </b>
                <b>
                  {dashboard.childrenRelations.pending || 0}
                  <small>awaiting contact</small>
                </b>
              </div>
            </section>
          )}
        </aside>
      </section>
      {quickTeacher && <TeacherQuickView teacher={quickTeacher} close={() => setQuickTeacher(null)} />}
      <style jsx global>{`
        .assignment-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 18px;
        }
        .assignment-card h2 {
          font:
            700 25px var(--font-body);
          margin: 0;
        }
        .assignment-card p:not(.eyebrow) {
          margin: 5px 0 0;
          color: #687184;
          font-size: 12px;
        }
        .assignment-list {
          display: grid;
          gap: 6px;
          margin-top: 8px;
        }
        .assignment-row {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 5px 10px;
          color: #687184;
          font-size: 12px;
        }
        .assignment-row b {
          color: #243655;
          font-size: 13px;
        }
        .summary-list {
          display: grid;
          gap: 10px;
        }
        .summary-list > div {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-top: 1px solid var(--line);
          font-size: 12px;
        }
        .summary-list span {
          color: var(--muted);
          text-align: right;
        }
        .attention-item {
          color: inherit;
          text-decoration: none;
        }
        .attention-item span {
          display: grid;
          gap: 3px;
        }
        .attention-item small {
          color: var(--orange);
          font-size: 10px;
          font-weight: 800;
        }
        .relation-numbers {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 7px;
        }
        .relation-numbers b {
          display: grid;
          gap: 3px;
          font:
            700 30px var(--font-body);
        }
        .relation-numbers small {
          font: 600 10px var(--font-body);
          color: var(--muted);
        }
        .account-empty {
          padding: 20px 0 4px;
          color: #687184;
          font-size: 12px;
        }
        .overview-header {
          padding-top: 0;
        }
        .live-status {
          display: inline-block;
          margin-left: 8px;
          border-radius: 999px;
          padding: 3px 7px;
          background: #e4f7ed;
          color: #08734e;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .context-indicator {
          margin: 8px 0 0;
          color: #7b8494;
          font-size: 11px;
          font-weight: 700;
        }
        @media (max-width: 590px) {
          .assignment-card {
            align-items: flex-start;
            gap: 12px;
            flex-direction: column;
          }
          .summary-list > div {
            display: grid;
          }
          .summary-list span {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
}
function Metric({
  icon,
  value,
  title,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  value: string;
  title: string;
  sub: string;
  tone: "orange" | "green" | "yellow" | "dark";
}) {
  return <StatCard icon={icon} value={value} title={title} description={sub} tone={tone} />;
}

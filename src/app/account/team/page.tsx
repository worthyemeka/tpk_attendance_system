"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  FiActivity,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiFilter,
  FiMail,
  FiMapPin,
  FiMoreHorizontal,
  FiPhone,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";

type Onboarding = "PROBATION" | "ONBOARDED";
type Member = {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  accessLevel?: "TPK_SUPER_ADMIN" | "TPK_ADMIN";
  accountActive?: boolean;
  joinedAt?: string | null;
  profileImageUrl?: string | null;
  whatsappNumber?: string | null;
  mobileNumber?: string | null;
  birthDate?: string | null;
  residentialAddress?: string | null;
  onboardingStatus: Onboarding;
  probationStartedAt?: string | null;
  probationTargetWeeks: number;
  probationWeek?: number | null;
  probationExtensionReason?: string | null;
  assignedClasses?: string | null;
  currentAssignment?: string | null;
  assignedServices?: number;
  presentServices?: number;
  attendanceRate?: number | null;
};
type TeamResponse = {
  members: Member[];
  permissions: { isSuperAdmin: boolean; staffUserId: number };
};
type Tab = "ALL" | "ONBOARDED" | "PROBATION";

const niceDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`))
    : "—";
const personName = (member: Member) =>
  member.name ||
  [member.title, member.firstName, member.lastName].filter(Boolean).join(" ");
const initials = (member: Member) =>
  `${member.firstName?.[0] || member.name?.[0] || "T"}${member.lastName?.[0] || ""}`.toUpperCase();

export default function TeamPage() {
  const session = useMemo(() => readTeacherSession(), []);
  const searchParams = useSearchParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [permissions, setPermissions] = useState<
    TeamResponse["permissions"] | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<Tab>("ALL");
  const [query, setQuery] = useState("");
  const [assignment, setAssignment] = useState("");
  const [status, setStatus] = useState("");
  const [access, setAccess] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [drawerTab, setDrawerTab] = useState<
    "OVERVIEW" | "ROSTER" | "ATTENDANCE" | "ONBOARDING"
  >("OVERVIEW");
  const [actionOpen, setActionOpen] = useState(false);
  const [extendWeeks, setExtendWeeks] = useState("1");
  const [extendReason, setExtendReason] = useState("");
  const [saving, setSaving] = useState(false);
  const isSuper =
    permissions?.isSuperAdmin ?? session?.accessLevel === "TPK_SUPER_ADMIN";
  const load = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/team`, {
        headers: authHeaders(session),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not load the TPK Team.",
        );
      const body = result.data as TeamResponse;
      setMembers(body.members || []);
      setPermissions(body.permissions);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not load the TPK Team.",
      );
    } finally {
      setLoading(false);
    }
  }, [session]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const memberId = Number(searchParams.get("member"));
    const member = members.find((item) => item.id === memberId);
    if (member) {
      setSelected(member);
      setDrawerTab("OVERVIEW");
      setActionOpen(false);
    }
  }, [members, searchParams]);
  const counts = useMemo(
    () => ({
      all: members.length,
      onboarded: members.filter((item) => item.onboardingStatus === "ONBOARDED")
        .length,
      probation: members.filter((item) => item.onboardingStatus === "PROBATION")
        .length,
      superAdmins: members.filter(
        (item) => item.accessLevel === "TPK_SUPER_ADMIN",
      ).length,
    }),
    [members],
  );
  const assignments = useMemo(
    () =>
      Array.from(
        new Set(
          members
            .map((item) => item.currentAssignment)
            .filter(Boolean) as string[],
        ),
      ).sort(),
    [members],
  );
  const shown = useMemo(
    () =>
      members.filter((item) => {
        const searchable = [
          personName(item),
          item.email,
          item.whatsappNumber,
          item.mobileNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          (tab === "ALL" || item.onboardingStatus === tab) &&
          (!query || searchable.includes(query.toLowerCase())) &&
          (!assignment || item.currentAssignment === assignment) &&
          (!status ||
            (status === "ACTIVE"
              ? item.accountActive !== false
              : item.accountActive === false)) &&
          (!access || item.accessLevel === access)
        );
      }),
    [access, assignment, members, query, status, tab],
  );
  function openMember(member: Member) {
    setSelected(member);
    setDrawerTab("OVERVIEW");
    setActionOpen(false);
    setExtendReason("");
  }
  async function apiAction(path: string, body: unknown, success: string) {
    if (!session || !selected) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}${path}`, {
        method: "PATCH",
        headers: {
          ...authHeaders(session),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not update this teacher.",
        );
      setNotice(success);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not update this teacher.",
      );
    } finally {
      setSaving(false);
      setActionOpen(false);
    }
  }
  function exportTeam(kind: "CSV" | "PDF") {
    setExportOpen(false);
    const rows = shown.map((item) => ({
      Teacher: personName(item),
      WhatsApp: item.whatsappNumber || "",
      Mobile: item.mobileNumber || "",
      Email: item.email || "",
      Joined: niceDate(item.joinedAt),
      "Onboarding Status":
        item.onboardingStatus === "PROBATION"
          ? `Probation · Week ${item.probationWeek || 1}/${item.probationTargetWeeks}`
          : "Onboarded",
      "Account Status": item.accountActive === false ? "Inactive" : "Active",
      "Current Assignment": item.currentAssignment || "—",
      Attendance: item.attendanceRate == null ? "—" : `${item.attendanceRate}%`,
      "Access Level":
        item.accessLevel === "TPK_SUPER_ADMIN"
          ? "TPK Super Admin"
          : "TPK Admin",
    }));
    if (kind === "CSV") {
      const csv = [
        Object.keys(rows[0] || {}).join(","),
        ...rows.map((row) =>
          Object.values(row)
            .map((value) => `\"${String(value).replaceAll('"', '""')}\"`)
            .join(","),
        ),
      ].join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "TPK-team.csv";
      link.click();
      URL.revokeObjectURL(url);
      return;
    }
    const page = window.open("", "_blank", "noopener,noreferrer");
    if (!page) return;
    page.document.write(
      `<!doctype html><title>TPK Team</title><style>body{font-family:Arial;color:#142440;margin:36px}h1{font-family:Georgia;font-size:27px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:9px;border:1px solid #dde3e8;text-align:left;font-size:11px}th{background:#f7f5f0}</style><h1>TribePetra Kids · Team Directory</h1><table><thead><tr><th>Teacher</th><th>WhatsApp</th><th>Joined</th><th>Onboarding</th><th>Account</th><th>Assignment</th><th>Attendance</th><th>Access</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.Teacher}</td><td>${row.WhatsApp}</td><td>${row.Joined}</td><td>${row["Onboarding Status"]}</td><td>${row["Account Status"]}</td><td>${row["Current Assignment"]}</td><td>${row.Attendance}</td><td>${row["Access Level"]}</td></tr>`).join("")}</tbody></table><script>window.print()</script>`,
    );
    page.document.close();
  }
  return (
    <section className="team-page">
      <header className="team-heading">
        <p className="eyebrow">People</p>
        <h1>TPK Team</h1>
        <p>View and manage teachers serving with TribePetra Kids.</p>
      </header>
      {error && <p className="feedback error">{error}</p>}
      {notice && (
        <p className="feedback success">
          <FiCheck />
          {notice}
        </p>
      )}
      <section className="team-cards">
        <InfoCard
          icon={<FiUsers />}
          value={counts.all}
          title="Team Members"
          detail="Active TPK teachers"
          tone="green"
        />
        <InfoCard
          icon={<FiCheck />}
          value={counts.onboarded}
          title="Onboarded"
          detail="Completed onboarding"
          tone="blue"
        />
        <InfoCard
          icon={<FiClock />}
          value={counts.probation}
          title="On Probation"
          detail="Currently onboarding"
          tone="orange"
        />
        {isSuper && (
          <InfoCard
            icon={<FiShield />}
            value={counts.superAdmins}
            title="Super Admins"
            detail="Leadership access"
            tone="purple"
          />
        )}
      </section>
      <div className="team-tabs">
        <button
          className={tab === "ALL" ? "active" : ""}
          onClick={() => setTab("ALL")}
        >
          All Team ({counts.all})
        </button>
        <button
          className={tab === "ONBOARDED" ? "active" : ""}
          onClick={() => setTab("ONBOARDED")}
        >
          Onboarded ({counts.onboarded})
        </button>
        <button
          className={tab === "PROBATION" ? "active" : ""}
          onClick={() => setTab("PROBATION")}
        >
          On Probation ({counts.probation})
        </button>
      </div>
      <section className="team-directory">
        <div className="toolbar">
          <label className="search">
            <FiSearch />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search teacher by name, phone or email…"
            />
          </label>
          <select
            value={assignment}
            onChange={(event) => setAssignment(event.target.value)}
          >
            <option value="">All Assignments</option>
            {assignments.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <div className="more-wrap">
            <button
              className="filter-button"
              onClick={() => setMoreOpen((value) => !value)}
            >
              <FiFilter />
              More Filters
            </button>
            {moreOpen && (
              <div className="more-menu">
                {isSuper ? (
                  <>
                    <label>
                      Access level
                      <select
                        value={access}
                        onChange={(event) => setAccess(event.target.value)}
                      >
                        <option value="">All</option>
                        <option value="TPK_ADMIN">TPK Admin</option>
                        <option value="TPK_SUPER_ADMIN">TPK Super Admin</option>
                      </select>
                    </label>
                    <button
                      onClick={() => {
                        setAccess("");
                        setStatus("");
                        setAssignment("");
                        setMoreOpen(false);
                      }}
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <p>
                    Use search and assignment filters to find a team member.
                  </p>
                )}
              </div>
            )}
          </div>
          {isSuper && (
            <div className="export-wrap">
              <button
                className="filter-button"
                onClick={() => setExportOpen((value) => !value)}
              >
                <FiDownload />
                Export <FiChevronDown />
              </button>
              {exportOpen && (
                <div className="export-menu">
                  <button onClick={() => exportTeam("PDF")}>
                    PDF · Print / share
                  </button>
                  <button onClick={() => exportTeam("CSV")}>
                    CSV · Spreadsheet
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="directory-count">
          {loading
            ? "Loading team…"
            : `${shown.length} team member${shown.length === 1 ? "" : "s"}`}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Teacher</th>
                <th>Team Status</th>
                <th>Current Assignment</th>
                <th>Joined</th>
                {isSuper && <th>Attendance</th>}
                <th aria-label="Open profile" />
              </tr>
            </thead>
            <tbody>
              {shown.map((member, index) => (
                <tr key={member.id} onClick={() => openMember(member)}>
                  <td>{index + 1}</td>
                  <td>
                    <div className="teacher">
                      <Avatar member={member} />
                      <span>
                        <b>{personName(member)}</b>
                        <small>
                          {isSuper
                            ? member.email ||
                              member.whatsappNumber ||
                              "No contact added"
                            : "TPK Teacher"}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>
                    <OnboardingBadge member={member} />
                  </td>
                  <td>
                    {member.currentAssignment ||
                      member.assignedClasses ||
                      "No upcoming assignment"}
                  </td>
                  <td>{niceDate(member.joinedAt)}</td>
                  {isSuper && (
                    <td>
                      {member.attendanceRate == null
                        ? "—"
                        : `${member.attendanceRate}%`}
                    </td>
                  )}
                  <td>
                    <FiChevronRight />
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td className="empty" colSpan={isSuper ? 7 : 6}>
                    {loading
                      ? "Loading registered teachers…"
                      : "No team members match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="paging">
          Showing {shown.length ? `1–${shown.length}` : "0"} of {members.length}{" "}
          team members
        </p>
      </section>
      {selected && (
        <TeacherDrawer
          member={selected}
          isSuper={Boolean(isSuper)}
          ownProfile={selected.id === permissions?.staffUserId}
          tab={drawerTab}
          setTab={setDrawerTab}
          closing={() => setSelected(null)}
          actionOpen={actionOpen}
          setActionOpen={setActionOpen}
          saving={saving}
          extendWeeks={extendWeeks}
          setExtendWeeks={setExtendWeeks}
          extendReason={extendReason}
          setExtendReason={setExtendReason}
          onboard={() =>
            void apiAction(
              `/api/v1/staff/${selected.id}/onboarding`,
              { action: "MARK_ONBOARDED" },
              `${personName(selected)} is now onboarded.`,
            )
          }
          startProbation={() =>
            void apiAction(
              `/api/v1/staff/${selected.id}/onboarding`,
              { action: "START_PROBATION", weeks: 4 },
              `${personName(selected)} has started a four-week probation period.`,
            )
          }
          extend={() =>
            void apiAction(
              `/api/v1/staff/${selected.id}/onboarding`,
              {
                action: "EXTEND_PROBATION",
                weeks: Number(extendWeeks),
                reason: extendReason,
              },
              `${personName(selected)}’s probation has been extended.`,
            )
          }
          toggleAccount={() =>
            void apiAction(
              `/api/v1/staff/${selected.id}/account-activity`,
              { active: selected.accountActive === false },
              selected.accountActive === false
                ? `${personName(selected)} is active again.`
                : `${personName(selected)} is now inactive.`,
            )
          }
          manageAccess={(level) =>
            void apiAction(
              `/api/v1/staff/${selected.id}/access-level`,
              { accessLevel: level },
              `${personName(selected)}’s access has been updated.`,
            )
          }
        />
      )}
      <style jsx>{styles}</style>
    </section>
  );
}

function InfoCard({
  icon,
  value,
  title,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  title: string;
  detail: string;
  tone: string;
}) {
  return (
    <article className={`info-card ${tone}`}>
      <i>{icon}</i>
      <b>{value}</b>
      <strong>{title}</strong>
      <small>{detail}</small>
    </article>
  );
}
function Avatar({ member }: { member: Member }) {
  return member.profileImageUrl ? (
    <img
      className="avatar"
      src={`${apiBase}${member.profileImageUrl}`}
      alt=""
    />
  ) : (
    <i className="avatar">{initials(member)}</i>
  );
}
function OnboardingBadge({ member }: { member: Member }) {
  return member.onboardingStatus === "PROBATION" ? (
    <span className="status probation">
      <FiClock />
      Probation · Week {member.probationWeek || 1}/{member.probationTargetWeeks}
    </span>
  ) : (
    <span className="status onboarded">
      <FiCheck />
      Onboarded
    </span>
  );
}

function TeacherDrawer({
  member,
  isSuper,
  ownProfile,
  tab,
  setTab,
  closing,
  actionOpen,
  setActionOpen,
  saving,
  extendWeeks,
  setExtendWeeks,
  extendReason,
  setExtendReason,
  onboard,
  startProbation,
  extend,
  toggleAccount,
  manageAccess,
}: {
  member: Member;
  isSuper: boolean;
  ownProfile: boolean;
  tab: "OVERVIEW" | "ROSTER" | "ATTENDANCE" | "ONBOARDING";
  setTab: (value: "OVERVIEW" | "ROSTER" | "ATTENDANCE" | "ONBOARDING") => void;
  closing: () => void;
  actionOpen: boolean;
  setActionOpen: (value: boolean) => void;
  saving: boolean;
  extendWeeks: string;
  setExtendWeeks: (value: string) => void;
  extendReason: string;
  setExtendReason: (value: string) => void;
  onboard: () => void;
  startProbation: () => void;
  extend: () => void;
  toggleAccount: () => void;
  manageAccess: (level: "TPK_ADMIN" | "TPK_SUPER_ADMIN") => void;
}) {
  const progress =
    member.onboardingStatus === "ONBOARDED"
      ? 100
      : Math.min(
          100,
          Math.round(
            ((member.probationWeek || 1) / member.probationTargetWeeks) * 100,
          ),
        );
  const tabs: [typeof tab, string][] = [
    ["OVERVIEW", "Overview"],
    ["ROSTER", "Roster"],
    ["ATTENDANCE", "Attendance"],
    ["ONBOARDING", "Onboarding"],
  ];
  return (
    <div className="drawer-backdrop" onClick={closing}>
      <aside
        className="teacher-drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="drawer-close" onClick={closing}>
          <FiX />
        </button>
        <header>
          <Avatar member={member} />
          <div>
            <h2>{personName(member)}</h2>
            <p>TPK Teacher</p>
            <OnboardingBadge member={member} />
          </div>
        </header>
        <nav>
          {tabs
            .filter(
              ([key]) =>
                isSuper ||
                key === "OVERVIEW" ||
                key === "ROSTER" ||
                (member.onboardingStatus === "PROBATION" &&
                  key === "ONBOARDING"),
            )
            .map(([key, label]) => (
              <button
                key={key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
        </nav>
        <div className="drawer-content">
          {tab === "OVERVIEW" && (
            <>
              <Section title="Contact information">
                <Info
                  icon={<FiPhone />}
                  label="WhatsApp"
                  value={member.whatsappNumber || "Not added"}
                />
                <Info
                  icon={<FiPhone />}
                  label="Mobile"
                  value={
                    member.mobileNumber || member.whatsappNumber || "Not added"
                  }
                />
                {isSuper && (
                  <Info
                    icon={<FiMail />}
                    label="Email"
                    value={member.email || "Not added"}
                  />
                )}
                <Info
                  icon={<FiMapPin />}
                  label="Location"
                  value={
                    isSuper
                      ? member.residentialAddress || "Not added"
                      : "Available to the TPK Team"
                  }
                />
              </Section>
              <Section title="TPK information">
                <Info
                  icon={<FiCalendar />}
                  label="Joined TPK"
                  value={niceDate(member.joinedAt)}
                />
                <Info
                  icon={<FiClock />}
                  label="Onboarding status"
                  value={
                    member.onboardingStatus === "PROBATION"
                      ? `Probation · Week ${member.probationWeek || 1} of ${member.probationTargetWeeks}`
                      : "Onboarded"
                  }
                />
                {isSuper && (
                  <Info
                    icon={<FiUserCheck />}
                    label="Account status"
                    value={
                      member.accountActive === false ? "Inactive" : "Active"
                    }
                  />
                )}
                <Info
                  icon={<FiUsers />}
                  label="Current assignment"
                  value={member.currentAssignment || "No upcoming assignment"}
                />
              </Section>
              {ownProfile && !isSuper && (
                <Link className="edit-link" href="/account/profile">
                  Edit my profile
                </Link>
              )}
            </>
          )}
          {tab === "ROSTER" && (
            <>
              <Section title="Current & next assignment">
                <Info
                  icon={<FiCalendar />}
                  label="Current assignment"
                  value={member.currentAssignment || "No upcoming assignment"}
                />
                <p className="quiet">
                  Super Admins manage roster changes from Team &amp; Roster, so
                  this profile stays focused on the teacher.
                </p>
              </Section>
              <Link className="outline-link" href="/account/roster">
                View full roster
              </Link>
            </>
          )}
          {isSuper && tab === "ATTENDANCE" && (
            <>
              <div className="attendance-grid">
                <Metric
                  value={member.assignedServices || 0}
                  label="Assigned Services"
                />
                <Metric value={member.presentServices || 0} label="Present" />
                <Metric
                  value={Math.max(
                    0,
                    (member.assignedServices || 0) -
                      (member.presentServices || 0),
                  )}
                  label="Missed"
                />
                <Metric
                  value={
                    member.attendanceRate == null
                      ? "—"
                      : `${member.attendanceRate}%`
                  }
                  label="Attendance Rate"
                />
              </div>
              <p className="quiet">
                This reflects confirmed TPK duty attendance, not children&apos;s
                attendance.
              </p>
            </>
          )}
          {tab === "ONBOARDING" && (
            <>
              <Section title="Onboarding progress">
                <b className="week">
                  {member.onboardingStatus === "ONBOARDED"
                    ? "Completed onboarding"
                    : `Week ${member.probationWeek || 1} of ${member.probationTargetWeeks}`}
                </b>
                <div className="progress">
                  <i style={{ width: `${progress}%` }} />
                </div>
                <small>{progress}% complete</small>
                <ol className="milestones">
                  <li className="done">
                    Getting Started <em>Completed</em>
                  </li>
                  <li className={progress >= 50 ? "current" : ""}>
                    Serving With the Team{" "}
                    <em>{progress >= 50 ? "In progress" : "Upcoming"}</em>
                  </li>
                  <li className={progress >= 75 ? "current" : ""}>
                    Growing in Responsibility <em>Upcoming</em>
                  </li>
                  <li>
                    Onboarding Review <em>Upcoming</em>
                  </li>
                </ol>
              </Section>
              {member.onboardingStatus === "PROBATION" && (
                <ProbationLog member={member} />
              )}
              {isSuper && member.onboardingStatus === "PROBATION" && (
                <section className="extend">
                  <b>Extend probation</b>
                  <label>
                    Extend by
                    <select
                      value={extendWeeks}
                      onChange={(event) => setExtendWeeks(event.target.value)}
                    >
                      <option value="1">1 week</option>
                      <option value="2">2 weeks</option>
                      <option value="3">3 weeks</option>
                    </select>
                  </label>
                  <label>
                    Reason
                    <textarea
                      value={extendReason}
                      onChange={(event) => setExtendReason(event.target.value)}
                      placeholder="Why does the review need more time?"
                    />
                  </label>
                  <button
                    className="outline"
                    disabled={saving || !extendReason.trim()}
                    onClick={extend}
                  >
                    Save extension
                  </button>
                </section>
              )}
            </>
          )}
        </div>
        {isSuper && (
          <footer className="drawer-actions">
            <button
              className="outline"
              onClick={() => setActionOpen(!actionOpen)}
            >
              <FiMoreHorizontal />
              More <FiChevronDown />
            </button>
            {member.onboardingStatus === "PROBATION" && (
              <button className="primary" disabled={saving} onClick={onboard}>
                Mark as Onboarded
              </button>
            )}
            {member.onboardingStatus === "ONBOARDED" && (
              <button
                className="primary"
                disabled={saving}
                onClick={startProbation}
              >
                Start probation
              </button>
            )}
            {actionOpen && (
              <div className="action-menu">
                <b>Leadership actions</b>
                <button disabled={saving} onClick={toggleAccount}>
                  {member.accountActive === false
                    ? "Mark Active"
                    : "Mark Inactive"}
                </button>
                <label>
                  Manage access
                  <select
                    value={member.accessLevel || "TPK_ADMIN"}
                    disabled={saving || member.id === undefined}
                    onChange={(event) =>
                      manageAccess(
                        event.target.value as "TPK_ADMIN" | "TPK_SUPER_ADMIN",
                      )
                    }
                  >
                    <option value="TPK_ADMIN">TPK Admin</option>
                    <option value="TPK_SUPER_ADMIN">TPK Super Admin</option>
                  </select>
                </label>
              </div>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}
function ProbationLog({ member }: { member: Member }) {
  const session = useMemo(() => readTeacherSession(), []);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    if (!session) return;
    try {
      const response = await fetch(
        `${apiBase}/api/v1/staff/${member.id}/probation-log`,
        { headers: authHeaders(session) },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not load the probation log.",
        );
      setData(result.data);
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not load the probation log.",
      );
    }
  }, [member.id, session]);
  useEffect(() => {
    void load();
  }, [load]);
  async function sign(week: any) {
    if (!session) return;
    setBusy(week.weekNumber);
    try {
      const response = await fetch(
        `${apiBase}/api/v1/staff/${member.id}/probation-log/weeks/${week.weekNumber}/sign`,
        {
          method: "POST",
          headers: {
            ...authHeaders(session),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            serviceDate: week.serviceDate,
            tribeAgeGroup: week.tribeAgeGroup,
            lessonTopicActivity: week.lessonTopicActivity,
            timeIn: week.timeIn,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not sign this week.",
        );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We could not sign this week.",
      );
    } finally {
      setBusy(null);
    }
  }
  if (!data)
    return (
      <Section title="Volunteer probation log">
        <p className="quiet">Loading the four-week volunteer log…</p>
      </Section>
    );
  const update = (week: number, key: string, value: string) =>
    setData((current: any) => ({
      ...current,
      weeks: current.weeks.map((item: any) =>
        item.weekNumber === week ? { ...item, [key]: value } : item,
      ),
    }));
  return (
    <section className="probation-log">
      <h3>Volunteer probation log</h3>
      <p>
        The four-week record is completed by the teacher serving alongside this
        volunteer and countersigned by a Super Admin.
      </p>
      <div className="probation-profile">
        <b>{data.profile.name}</b>
        <span>
          {data.profile.maritalStatus || "Marital status not recorded"} ·{" "}
          {data.profile.primaryPhone || "No primary phone"}
        </span>
        <span>
          {data.profile.email || "No email"} ·{" "}
          {data.profile.residentialAddress || "No address"}
        </span>
        <span>
          Emergency: {data.profile.emergencyContact || "Not recorded"}{" "}
          {data.profile.emergencyRelationshipPhone
            ? `· ${data.profile.emergencyRelationshipPhone}`
            : ""}
        </span>
      </div>
      {error && <p className="probation-error">{error}</p>}
      {data.weeks.map((week: any) => (
        <article className="probation-week" key={week.weekNumber}>
          <b>Week {week.weekNumber}</b>
          <label>
            Date
            <input
              type="date"
              value={week.serviceDate || ""}
              disabled={!week.canStaffSign}
              onChange={(event) =>
                update(week.weekNumber, "serviceDate", event.target.value)
              }
            />
          </label>
          <label>
            Tribe / age group
            <input
              value={week.tribeAgeGroup || ""}
              disabled={!week.canStaffSign}
              onChange={(event) =>
                update(week.weekNumber, "tribeAgeGroup", event.target.value)
              }
            />
          </label>
          <label>
            Lesson topic / activity
            <textarea
              value={week.lessonTopicActivity || ""}
              disabled={!week.canStaffSign}
              onChange={(event) =>
                update(
                  week.weekNumber,
                  "lessonTopicActivity",
                  event.target.value,
                )
              }
            />
          </label>
          <label>
            Time in
            <input
              type="time"
              value={week.timeIn?.slice(0, 5) || ""}
              disabled={!week.canStaffSign}
              onChange={(event) =>
                update(week.weekNumber, "timeIn", event.target.value)
              }
            />
          </label>
          <div className="signatures">
            <span>
              {week.staffSignedAt
                ? `Staff signed by ${week.staffSignerName}`
                : "Staff sign-off pending"}
            </span>
            <span>
              {week.superAdminSignedAt
                ? `Super Admin signed by ${week.superAdminSignerName}`
                : "Super Admin sign-off pending"}
            </span>
          </div>
          {week.canStaffSign ? (
            <button
              className="outline"
              disabled={busy === week.weekNumber}
              onClick={() => void sign(week)}
            >
              {busy === week.weekNumber
                ? "Signing…"
                : data.isSuperAdmin
                  ? "Sign as Super Admin"
                  : "Sign as assigned staff"}
            </button>
          ) : (
            <small>
              Only a staff member assigned with this volunteer on this date can
              sign.
            </small>
          )}
        </article>
      ))}
      <style jsx>{`
        .probation-log {
          display: grid;
          gap: 10px;
        }
        .probation-log > h3 {
          margin: 0;
          font-family: var(--font-display), Georgia, serif;
          font-size: 18px;
        }
        .probation-log > p {
          margin: 0;
          color: #64718a;
          font-size: 11px;
          line-height: 1.45;
        }
        .probation-profile {
          display: grid;
          gap: 4px;
          padding: 11px;
          border: 1px solid #e9e3db;
          border-radius: 8px;
          background: #faf9f5;
          color: #56647a;
          font-size: 10px;
        }
        .probation-profile b {
          color: #1f3150;
          font-size: 12px;
        }
        .probation-week {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          padding: 11px;
          border: 1px solid #e8e3dc;
          border-radius: 8px;
          background: #fff;
        }
        .probation-week > b {
          grid-column: 1/-1;
          color: #1f3150;
          font-size: 12px;
        }
        .probation-week label {
          display: grid;
          gap: 4px;
          color: #60708a;
          font-size: 9px;
          font-weight: 800;
        }
        .probation-week input,
        .probation-week textarea {
          box-sizing: border-box;
          width: 100%;
          border: 1px solid #d9dfe8;
          border-radius: 6px;
          padding: 7px;
          background: #fff;
          font: 11px var(--font-body);
        }
        .probation-week textarea {
          min-height: 48px;
          resize: vertical;
        }
        .probation-week textarea,
        .probation-week label:nth-of-type(3),
        .signatures {
          grid-column: 1/-1;
        }
        .signatures {
          display: grid;
          gap: 3px;
          padding-top: 4px;
          color: #64718a;
          font-size: 10px;
        }
        .probation-week small {
          grid-column: 1/-1;
          color: #946c1b;
          font-size: 10px;
        }
        .probation-error {
          margin: 0;
          padding: 9px;
          border-radius: 7px;
          background: #fff0ed;
          color: #b94029;
          font-size: 10px;
        }
        @media (max-width: 420px) {
          .probation-week {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="drawer-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="info">
      <i>{icon}</i>
      <span>
        <small>{label}</small>
        <b>{value}</b>
      </span>
    </div>
  );
}
function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="metric">
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

const styles = `.team-page{max-width:1260px}.team-page h1,.team-page h2,.team-page h3{font-family:var(--font-display),Georgia,serif}.team-heading{margin:5px 0 16px}.team-heading h1{margin:7px 0 6px;font-size:40px;letter-spacing:-1.25px}.team-heading>p:last-child{margin:0;color:#64718a;font-size:17px}.feedback{display:flex;align-items:center;gap:7px;margin:0 0 13px;padding:10px 13px;border-radius:8px;font-size:12px}.feedback.error{background:#fff0eb;color:#c4432d}.feedback.success{background:#e9f8ef;color:#097750}.team-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:18px}.info-card{min-height:111px;padding:15px 17px;border-radius:9px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto auto;column-gap:12px}.info-card i{grid-row:span 2;width:37px;height:37px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:20px}.info-card b{align-self:end;font-size:28px;line-height:1}.info-card strong{font-size:13px}.info-card small{grid-column:1 / -1;color:#65728b;font-size:11px}.info-card.green{background:#eff9f3}.info-card.green i{background:#d9f3e2;color:#078056}.info-card.blue{background:#eff6ff}.info-card.blue i{background:#ddecff;color:#1972c4}.info-card.orange{background:#fff6e6}.info-card.orange i{background:#ffebc1;color:#df8f00}.info-card.purple{background:#f6efff}.info-card.purple i{background:#eadcff;color:#7440c2}.team-tabs{display:flex;width:min(100%,540px);margin-bottom:15px;border:1px solid #e0e3e9;border-radius:8px;overflow:hidden;background:#fff}.team-tabs button{flex:1;height:39px;border:0;border-right:1px solid #e8e9ec;background:#fff;color:#59667d;font:800 11px var(--font-body);cursor:pointer}.team-tabs button:last-child{border-right:0}.team-tabs button.active{background:#fff6f0;color:#ec4d2b;box-shadow:inset 0 2px #ff5a35}.team-directory{padding:15px 17px 13px;border:1px solid #e4e1db;border-radius:10px;background:#fffdfa}.toolbar{display:flex;align-items:center;gap:10px}.search{height:42px;min-width:280px;flex:1;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #d9dfe8;border-radius:8px;background:#fff;color:#697792}.search input{width:100%;border:0;outline:0;background:transparent;font:600 12px var(--font-body)}.toolbar select,.filter-button{height:42px;border:1px solid #d9dfe8;border-radius:8px;background:#fff;padding:0 11px;color:#263550;font:800 11px var(--font-body)}.filter-button{display:inline-flex;align-items:center;gap:8px;cursor:pointer}.more-wrap,.export-wrap{position:relative}.more-menu,.export-menu{position:absolute;z-index:25;right:0;top:48px;min-width:210px;padding:10px;border:1px solid #dce1e7;border-radius:8px;background:#fff;box-shadow:0 15px 32px #12203a22}.more-menu label{display:grid;gap:6px;color:#4e5d77;font-size:10px;font-weight:800}.more-menu select{width:100%}.more-menu>button,.export-menu button{width:100%;margin-top:8px;padding:8px;border:0;border-radius:5px;background:transparent;text-align:left;color:#263550;font:700 11px var(--font-body);cursor:pointer}.more-menu>button:hover,.export-menu button:hover{background:#fff1ea;color:#df4b2c}.more-menu p{margin:0;color:#65728a;font-size:11px}.directory-count{margin:17px 0 10px;color:#243653;font-size:13px;font-weight:900}.table-wrap{overflow:auto;border:1px solid #e9e5de;border-radius:8px}.team-directory table{width:100%;min-width:900px;border-collapse:collapse}.team-directory th{padding:11px 10px;background:#f8f7f4;color:#60708a;text-align:left;font-size:10px;font-weight:900}.team-directory td{padding:9px 10px;border-top:1px solid #e9e8e5;color:#506079;font-size:11px}.team-directory tbody tr{cursor:pointer}.team-directory tbody tr:hover{background:#fff8f4}.teacher{display:flex;align-items:center;gap:9px;min-width:200px}.avatar{width:34px;height:34px;flex:none;border-radius:50%;object-fit:cover}.i.avatar,.avatar:not(img){display:grid;place-items:center;background:#e8eef8;color:#285f9f;font-size:10px;font-style:normal;font-weight:900}.teacher span{display:grid;gap:3px}.teacher b{color:#172841;font-size:12px}.teacher small{color:#6d7890;font-size:10px}.status{display:inline-flex;align-items:center;gap:5px;width:max-content;padding:6px 8px;border-radius:99px;font-size:10px;font-weight:900;white-space:nowrap}.status.onboarded{background:#e8f8ed;color:#087950}.status.probation{background:#fff1db;color:#ae6b00}.paging{margin:12px 0 0;color:#65728a;font-size:11px}.empty{text-align:center!important;padding:30px!important;color:#738098!important}.drawer-backdrop{position:fixed;z-index:100;inset:0;display:grid;justify-items:end;background:#09182d38}.teacher-drawer{position:relative;width:min(100%,410px);height:100%;overflow:auto;background:#fffdfa;box-shadow:-16px 0 45px #08172f28}.drawer-close{position:absolute;right:16px;top:17px;border:0;background:transparent;color:#35435d;font-size:20px;cursor:pointer}.teacher-drawer>header{display:flex;align-items:center;gap:13px;padding:28px 23px 18px}.teacher-drawer>header .avatar{width:66px;height:66px;font-size:16px}.teacher-drawer h2{margin:0;font-size:24px}.teacher-drawer header p{margin:3px 0 8px;color:#65728b;font-size:12px}.teacher-drawer nav{display:flex;padding:0 16px;border-bottom:1px solid #e8e6e1}.teacher-drawer nav button{flex:1;padding:11px 5px;border:0;border-bottom:2px solid transparent;background:transparent;color:#66728a;font:800 10px var(--font-body);cursor:pointer}.teacher-drawer nav button.active{border-bottom-color:#ff5533;color:#172a48}.drawer-content{padding:17px 23px 100px}.drawer-section{padding:0 0 15px;margin:0 0 15px;border-bottom:1px solid #ebe8e3}.drawer-section h3{margin:0 0 13px;font-size:16px}.info{display:flex;gap:10px;margin:12px 0}.info>i{width:20px;color:#607391;font-style:normal;font-size:17px}.info span{display:grid;gap:3px}.info small{color:#718099;font-size:10px}.info b{color:#263752;font-size:12px}.quiet{margin:13px 0 0;color:#748097;font-size:11px;line-height:1.5}.outline-link,.edit-link{display:block;padding:11px;border:1px solid #dce1e8;border-radius:7px;color:#283953;text-align:center;font:800 11px var(--font-body);text-decoration:none}.attendance-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.metric{padding:12px;border-radius:8px;background:#f7f8f8;display:grid;gap:5px}.metric b{font-size:21px}.metric small{color:#65728b;font-size:10px}.week{display:block;font-size:13px}.progress{height:9px;margin:11px 0 5px;overflow:hidden;border-radius:99px;background:#e8ebef}.progress i{display:block;height:100%;border-radius:99px;background:#f3a21c}.drawer-section>small{color:#64718a;font-size:10px}.milestones{margin:16px 0 0;padding:0;list-style:none;display:grid;gap:10px}.milestones li{display:flex;justify-content:space-between;gap:8px;color:#68758b;font-size:11px}.milestones li:before{content:"○";margin-right:6px}.milestones li.done:before{content:"✓";color:#099158}.milestones li.current:before{content:"◉";color:#f0a018}.milestones li em{margin-left:auto;padding:3px 6px;border-radius:99px;background:#eef0f4;color:#64708a;font-size:9px;font-style:normal}.extend{padding:13px;border-radius:8px;background:#fff7e8;display:grid;gap:9px}.extend>b{font-size:13px}.extend label{display:grid;gap:5px;color:#52607a;font-size:10px;font-weight:800}.extend select,.extend textarea{width:100%;box-sizing:border-box;border:1px solid #d9dfe8;border-radius:6px;background:#fff;padding:8px;font:11px var(--font-body)}.extend textarea{min-height:60px;resize:vertical}.drawer-actions{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:13px 16px;border-top:1px solid #e9e6df;background:#fffdfa}.drawer-actions button{height:39px}.outline,.primary{border-radius:7px;padding:0 12px;font:800 11px var(--font-body);cursor:pointer}.outline{border:1px solid #d8dee6;background:#fff;color:#253650}.primary{border:1px solid #ff5634;background:#ff5634;color:#fff}.drawer-actions .outline{display:flex;align-items:center;gap:6px}.action-menu{position:absolute;z-index:2;bottom:60px;left:16px;right:16px;padding:12px;border:1px solid #dce1e7;border-radius:8px;background:#fff;box-shadow:0 12px 30px #0b19302e;display:grid;gap:7px}.action-menu>b{font-size:11px}.action-menu>button{height:auto;padding:7px;border:0;background:transparent;color:#d04a31;text-align:left;font:800 11px var(--font-body)}.action-menu label{display:grid;gap:5px;color:#58667e;font-size:10px;font-weight:800}.action-menu select{height:34px;border:1px solid #dce1e7;border-radius:6px;background:#fff;padding:0 8px;font:11px var(--font-body)}@media(max-width:1080px){.team-cards{grid-template-columns:repeat(2,1fr)}.toolbar{flex-wrap:wrap}.search{min-width:240px}}@media(max-width:600px){.team-heading h1{font-size:34px}.team-cards{grid-template-columns:1fr 1fr;gap:8px}.info-card{padding:12px;min-height:100px}.info-card b{font-size:24px}.info-card strong{font-size:11px}.info-card small{font-size:9px}.team-tabs{width:100%;overflow:auto}.team-tabs button{min-width:135px}.toolbar>*{flex:1}.search{min-width:100%;flex-basis:100%}.filter-button{justify-content:center;width:100%}.teacher-drawer{width:100%}}`;

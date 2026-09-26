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
import { printBrandedDocument } from "@/lib/branded-print";
import { StatCard, type StatCardTone } from "@/components/stat-card";
import { ProbationJourney } from "@/components/probation-journey";
import { MonthPicker } from "@/components/month-picker";
import { DataViewToggle, type DataView } from "@/components/data-view-toggle";
import "./team-refinements.css";

type Onboarding = "PROBATION" | "ONBOARDED";
type SubUnit = { id: number; name: string; description?: string | null; isActive?: boolean; assignedCount?: number };
type Member = {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  email?: string;
  accessLevel?: "TPK_SUPER_ADMIN" | "TPK_FOLLOW_UP_ADMIN" | "TPK_ADMIN";
  accountActive?: boolean;
  inactiveReason?: string | null;
  inactiveAt?: string | null;
  gender?: "MALE" | "FEMALE" | string | null;
  joinedAt?: string | null;
  profileImageUrl?: string | null;
  whatsappNumber?: string | null;
  mobileNumber?: string | null;
  birthDate?: string | null;
  birthDayMonth?: string | null;
  residentialAddress?: string | null;
  emergencyContact?: string | null;
  emergencyRelationship?: string | null;
  emergencyPhone?: string | null;
  onboardingStatus: Onboarding;
  probationStartedAt?: string | null;
  probationTargetWeeks: number;
  probationWeek?: number | null;
  probationExtensionReason?: string | null;
  assignedClasses?: string | null;
  currentAssignment?: string | null;
  subUnits?: SubUnit[];
};
type TeamResponse = {
  members: Member[];
  roles?: string[];
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
const genderLabel = (gender?: string | null) =>
  gender === "MALE" ? "Male" : gender === "FEMALE" ? "Female" : "Not recorded";
const birthdayLabel = (value?: string | null) => value ? new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${/^\d{2}-\d{2}$/.test(value) ? `2000-${value}` : value.slice(0, 10)}T00:00:00Z`)) : "—";
const accessLabel = (level?: Member["accessLevel"]) => level === "TPK_SUPER_ADMIN" ? "TPK Super Admin" : level === "TPK_FOLLOW_UP_ADMIN" ? "Follow-Up Lead" : "TPK Admin";
const whatsappHref = (number?: string | null) => {
  const digits = String(number || "").replace(/\D/g, "");
  if (!digits || /not recorded/i.test(String(number))) return undefined;
  return `https://wa.me/${digits.startsWith("0") ? `234${digits.slice(1)}` : digits}`;
};

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
  const [assignmentMonth, setAssignmentMonth] = useState(() => new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [assignment, setAssignment] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [sort, setSort] = useState("NAME_ASC");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [exportOpen, setExportOpen] = useState(false);
  const [display, setDisplay] = useState<DataView>("LIST");
  const [selected, setSelected] = useState<Member | null>(null);
  const [drawerTab, setDrawerTab] = useState<
    "OVERVIEW" | "ROSTER" | "ONBOARDING"
  >("OVERVIEW");
  const [actionOpen, setActionOpen] = useState(false);
  const [extendWeeks, setExtendWeeks] = useState("1");
  const [extendReason, setExtendReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("tpk:team-display");
    if (saved === "GRID" || saved === "LIST") setDisplay(saved);
    else if (window.matchMedia("(max-width: 1024px)").matches) setDisplay("GRID");
  }, []);
  const setTeamDisplay = (value: DataView) => {
    setDisplay(value);
    window.localStorage.setItem("tpk:team-display", value);
  };
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
      const params = new URLSearchParams({ month: assignmentMonth.toISOString().slice(0, 7) });
      const response = await fetch(`${apiBase}/api/v1/team?${params}`, {
        headers: authHeaders(session),
      });
      const result = await response.json();
      if (!response.ok || !result.success)
        throw new Error(
          result.error?.message || "We could not load the TPK Team.",
        );
      const body = result.data as TeamResponse;
      setMembers(body.members || []);
      setSelected((current) => current ? (body.members || []).find((item) => item.id === current.id) || null : null);
      setRoles(body.roles || []);
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
  }, [assignmentMonth, session]);
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
  const shown = useMemo(() => {
    const filtered = members.filter((item) => {
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
          (!assignment || item.currentAssignment?.includes(assignment))
        );
      });
    return filtered.sort((left, right) => {
      if (sort === "NAME_DESC") return personName(right).localeCompare(personName(left));
      if (sort === "GENDER") return genderLabel(left.gender).localeCompare(genderLabel(right.gender)) || personName(left).localeCompare(personName(right));
      if (sort === "DOB_ASC") return String(left.birthDate || "9999-12-31").localeCompare(String(right.birthDate || "9999-12-31"));
      if (sort === "DOB_DESC") return String(right.birthDate || "0000-01-01").localeCompare(String(left.birthDate || "0000-01-01"));
      return personName(left).localeCompare(personName(right));
    });
  }, [assignment, members, query, sort, tab]);
  const totalPages = Math.max(1, Math.ceil(shown.length / perPage));
  const pagedMembers = shown.slice((page - 1) * perPage, page * perPage);
  useEffect(() => setPage(1), [assignment, assignmentMonth, perPage, query, sort, tab]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
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
      "Date of Birth": niceDate(item.birthDate),
      "Onboarding Status":
        item.onboardingStatus === "PROBATION"
          ? `Probation · Week ${item.probationWeek || 1}/${item.probationTargetWeeks}`
          : "Onboarded",
      "Account Status": item.accountActive === false ? "Inactive" : "Active",
      "Role this week": item.currentAssignment || "—",
      Gender: genderLabel(item.gender),
      "Access Level":
        accessLabel(item.accessLevel),
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
    printBrandedDocument({
      eyebrow: "Team directory",
      title: "TPK Team",
      subtitle: "Teachers serving with TribePetra Kids, Wuse Campus.",
      stats: [
        { label: "Team members", value: rows.length, note: "Directory total" },
        { label: "Onboarded", value: counts.onboarded },
        { label: "On probation", value: counts.probation },
        {
          label: "Active accounts",
          value: rows.filter((row) => row["Account Status"] === "Active")
            .length,
        },
      ],
      columns: [
        "Teacher",
        "WhatsApp",
        "Date of Birth",
        "Status",
        "Gender",
        "Assignment",
        "Account",
        "Access",
      ],
      rows: rows.map((row) => [
        row.Teacher,
        row.WhatsApp,
        row["Date of Birth"],
        row["Onboarding Status"],
        row.Gender,
        row["Role this week"],
        row["Account Status"],
        row["Access Level"],
      ]),
    });
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
      <section className={`team-cards ${isSuper ? "" : "team-cards--compact"}`}>
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
          <MonthPicker value={assignmentMonth} onChange={setAssignmentMonth} className="team-month-picker" ariaLabel="Choose assignment month" />
          <select
            value={assignment}
            onChange={(event) => setAssignment(event.target.value)}
          >
            <option value="">All roles</option>
            {roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <label className="directory-select">
            <span>Sort team</span>
            <select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="NAME_ASC">Name: A–Z</option>
              <option value="NAME_DESC">Name: Z–A</option>
              <option value="GENDER">Gender</option>
              {isSuper && <option value="DOB_ASC">Date of birth: oldest first</option>}
              {isSuper && <option value="DOB_DESC">Date of birth: youngest first</option>}
            </select>
          </label>
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
          <DataViewToggle compact value={display} onChange={setTeamDisplay} gridLabel="Teacher cards" listLabel="Teacher table" />
        </div>
        <p className="directory-count">
          {loading
            ? "Loading team…"
            : `${shown.length} team member${shown.length === 1 ? "" : "s"}`}
        </p>
        {display === "LIST" ? <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Teacher</th>
                <th>Team Status</th>
                <th>Role This Week</th>
                <th>Date of Birth</th>
                <th>Gender</th>
                <th aria-label="Open profile" />
              </tr>
            </thead>
            <tbody>
              {pagedMembers.map((member, index) => (
                <tr key={member.id} onClick={() => openMember(member)}>
                  <td>{(page - 1) * perPage + index + 1}</td>
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
                    {member.currentAssignment || "No upcoming assignment"}
                  </td>
                  <td>{birthdayLabel(member.birthDayMonth || member.birthDate)}</td>
                  <td>
                    <span
                      className={`gender-badge ${String(member.gender || "").toLowerCase()}`}
                    >
                      {genderLabel(member.gender)}
                    </span>
                  </td>
                  <td>
                    <FiChevronRight />
                  </td>
                </tr>
              ))}
              {!shown.length && (
                <tr>
                  <td className="empty" colSpan={7}>
                    {loading
                      ? "Loading registered teachers…"
                      : "No team members match these filters."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div> : <div className="team-member-grid">
          {pagedMembers.map((member) => <article key={member.id} onClick={() => openMember(member)}>
            <header><Avatar member={member} /><span><b>{personName(member)}</b><small>{isSuper ? member.email || member.whatsappNumber || "No contact added" : "TPK Teacher"}</small></span><FiChevronRight /></header>
            <div><span><small>Team status</small><OnboardingBadge member={member} /></span><span><small>This week</small><b>{member.currentAssignment || "No upcoming assignment"}</b></span></div>
          </article>)}
          {!shown.length && <p className="team-grid-empty">{loading ? "Loading registered teachers…" : "No team members match these filters."}</p>}
        </div>}
        <p className="paging">
          Showing {shown.length ? `${(page - 1) * perPage + 1}–${Math.min(page * perPage, shown.length)}` : "0"} of {shown.length} team members
        </p>
        <div className="team-pagination">
          <label>Show <select value={perPage} onChange={(event) => setPerPage(Number(event.target.value))}>{[5, 10, 20, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}</select> teachers</label>
          <div><button disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>{page} of {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div>
        </div>
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
          restoreAccount={() =>
            void apiAction(
              `/api/v1/staff/${selected.id}/account-activity`,
              { active: true },
              `${personName(selected)} is active again.`,
            )
          }
          manageAccess={(level) =>
            void apiAction(
              `/api/v1/staff/${selected.id}/access-level`,
              { accessLevel: level },
              `${personName(selected)}’s access has been updated.`,
            )
          }
          refreshTeam={load}
        />
      )}
      <style jsx>{styles}</style>
      <style jsx>{`
        .toolbar{grid-template-columns:minmax(180px,1fr) minmax(210px,270px) minmax(118px,145px) minmax(118px,145px) max-content max-content;gap:8px}
        .toolbar :global(.data-view-toggle){justify-self:end}
        @media(max-width:1180px){.toolbar{grid-template-columns:minmax(180px,1fr) minmax(200px,250px) minmax(110px,135px) minmax(110px,135px) max-content max-content}.toolbar :global(.data-view-toggle){justify-self:end}}
        @media(max-width:760px){.toolbar{grid-template-columns:1fr 1fr}.toolbar .directory-select,.toolbar .export-wrap,.toolbar :global(.data-view-toggle){grid-column:auto}}
      `}</style>
      <style jsx>{`
        .team-member-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.team-member-grid article{cursor:pointer;border:1px solid #e6e8eb;border-radius:10px;background:#fff;padding:14px;transition:border-color .16s,box-shadow .16s}.team-member-grid article:hover{border-color:#f3a08a;box-shadow:0 8px 22px #14213c0d}.team-member-grid header{display:flex;align-items:center;gap:9px}.team-member-grid header :global(.avatar){width:38px;height:38px;flex:none}.team-member-grid header span{display:grid;gap:3px;min-width:0;flex:1}.team-member-grid header b{overflow:hidden;color:#172841;text-overflow:ellipsis;white-space:nowrap;font-size:12px}.team-member-grid header small{overflow:hidden;color:#6d7890;text-overflow:ellipsis;white-space:nowrap;font-size:10px}.team-member-grid header>svg{color:#5f7391;font-size:18px}.team-member-grid article>div{display:grid;gap:9px;margin-top:13px;padding-top:11px;border-top:1px solid #edf0f2}.team-member-grid article>div span{display:grid;gap:5px}.team-member-grid article>div small{color:#768299;font-size:9px;text-transform:uppercase;letter-spacing:.05em}.team-member-grid article>div>span:last-child>b{color:#394b68;font-size:11px}.team-grid-empty{grid-column:1/-1;margin:0;padding:34px;border:1px dashed #dce2ea;border-radius:9px;color:#71809a;text-align:center;font-size:12px}@media(max-width:1050px){.team-member-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.team-member-grid{grid-template-columns:1fr}}
      `}</style>
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
  tone: StatCardTone;
}) {
  return <StatCard icon={icon} value={value} title={title} description={detail} tone={tone} />;
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
  restoreAccount,
  manageAccess,
  refreshTeam,
}: {
  member: Member;
  isSuper: boolean;
  ownProfile: boolean;
  tab: "OVERVIEW" | "ROSTER" | "ONBOARDING";
  setTab: (value: "OVERVIEW" | "ROSTER" | "ONBOARDING") => void;
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
  restoreAccount: () => void;
  manageAccess: (level: "TPK_ADMIN" | "TPK_FOLLOW_UP_ADMIN" | "TPK_SUPER_ADMIN") => void;
  refreshTeam: () => Promise<void>;
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
    ["ONBOARDING", member.onboardingStatus === "PROBATION" ? "Probation" : "Onboarding"],
    ["ROSTER", "Roster"],
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
        <header className="drawer-header">
          <Avatar member={member} />
          <div>
            <h2>{personName(member)}</h2>
            <p>TPK Teacher</p>
            <OnboardingBadge member={member} />
            <q>A place to belong, grow and lead.</q>
          </div>
          <img className="drawer-kids-logo" src="/brand/tpk-logo.png" alt="TribePetra Kids" />
        </header>
        <div className="drawer-teacher-meta">
          <span><FiCalendar /><small>Joined TPK</small><b>{niceDate(member.joinedAt)}</b></span>
          <span><FiUsers /><small>Role this week</small><b>{member.currentAssignment || "No role assigned this week"}</b></span>
          {isSuper && <span><FiMail /><small>Email</small><b>{member.email ? <a href={`mailto:${member.email}`}>{member.email}</a> : "Not added"}</b></span>}
        </div>
        <nav>
          {tabs.map(([key, label]) => (
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
          {tab === "OVERVIEW" && <TeacherOverview member={member} isSuper={isSuper} ownProfile={ownProfile} refreshTeam={refreshTeam} />}
          {false && tab === "OVERVIEW" && (
            <>
              <Section title="Contact information">
                <Info
                  icon={<FiPhone />}
                  label="WhatsApp"
                  value={member.whatsappNumber || "Not added"}
                  href={whatsappHref(member.whatsappNumber)}
                  external
                />
                <Info
                  icon={<FiPhone />}
                  label="Mobile"
                  value={
                    member.mobileNumber || member.whatsappNumber || "Not added"
                  }
                  href={member.mobileNumber || member.whatsappNumber ? `tel:${member.mobileNumber || member.whatsappNumber}` : undefined}
                />
                {isSuper && (
                  <Info
                    icon={<FiMail />}
                    label="Email"
                    value={member.email || "Not added"}
                    href={member.email ? `mailto:${member.email}` : undefined}
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
                <Info
                  icon={<FiUsers />}
                  label="Gender"
                  value={genderLabel(member.gender)}
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
              {(member.emergencyContact || member.emergencyPhone) && (
                <Section title="Emergency contact">
                  <Info icon={<FiUserCheck />} label="Contact" value={member.emergencyContact || "Not added"} />
                  <Info icon={<FiUsers />} label="Relationship" value={member.emergencyRelationship || "Not added"} />
                  <Info icon={<FiPhone />} label="Emergency phone" value={member.emergencyPhone || "Not added"} />
                  {member.emergencyPhone && <a className="emergency-call" href={`tel:${member.emergencyPhone}`}>Call emergency contact <FiPhone /></a>}
                </Section>
              )}
              {ownProfile && !isSuper && (
                <Link className="edit-link" href="/account/profile">
                  Edit my profile
                </Link>
              )}
            </>
          )}
          {tab === "ROSTER" && <TeacherRosterPanel member={member} />}
          {tab === "ONBOARDING" && (
            <>
              {member.onboardingStatus === "PROBATION" ? <ProbationJourney staffUserId={member.id} isSuper={isSuper} isSelf={ownProfile} onChanged={() => undefined} /> : <OnboardedSummary member={member} />}
              {false && <Section title="Onboarding progress">
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
              </Section>}
              {false && isSuper && member.onboardingStatus === "PROBATION" && (
                <section className="extend probation-extension">
                  <span className="action-kicker">Review period</span>
                  <b>Extend probation</b>
                  <p>
                    Give this teacher more time to complete their supported
                    service review.
                  </p>
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
                    className="primary"
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
              Manage teacher <FiChevronDown />
            </button>
            {false && member.onboardingStatus === "PROBATION" && (
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
              <div className="action-menu teacher-management">
                <div>
                  <span className="action-kicker">Leadership controls</span>
                  <b>Manage teacher</b>
                </div>
                {member.accountActive === false ? (
                  <button
                    className="primary"
                    disabled={saving}
                    onClick={restoreAccount}
                  >
                    Restore active account
                  </button>
                ) : (
                  <p className="account-always-active">
                    TPK accounts remain active. Remove a teacher from a roster
                    when their assignment changes.
                  </p>
                )}
                <label className="access-control">
                  Access level
                  <select
                    value={member.accessLevel || "TPK_ADMIN"}
                    disabled={saving || member.id === undefined}
                    onChange={(event) =>
                      manageAccess(
                        event.target.value as "TPK_ADMIN" | "TPK_FOLLOW_UP_ADMIN" | "TPK_SUPER_ADMIN",
                      )
                    }
                  >
                    <option value="TPK_ADMIN">TPK Admin</option>
                    <option value="TPK_FOLLOW_UP_ADMIN">Follow-Up Lead</option>
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

function SubUnitPanel({ member, isSuper, refreshTeam }: { member: Member; isSuper: boolean; refreshTeam: () => Promise<void> }) {
  const session = useMemo(() => readTeacherSession(), []);
  const [catalog, setCatalog] = useState<SubUnit[]>([]);
  const [assigned, setAssigned] = useState<SubUnit[]>(member.subUnits || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setAssigned(member.subUnits || []), [member.id, member.subUnits]);
  useEffect(() => {
    if (!isSuper || !session) return;
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/api/v1/sub-units`, { headers: authHeaders(session) });
        const result = await response.json();
        if (response.ok && result.success) setCatalog(result.data?.subUnits || []);
      } catch { /* The current assigned Sub Units remain visible if the catalog is unavailable. */ }
    })();
  }, [isSuper, session]);
  const selectedIds = new Set(assigned.map((unit) => unit.id));
  const toggle = (unit: SubUnit) => setAssigned((current) => current.some((item) => item.id === unit.id) ? current.filter((item) => item.id !== unit.id) : [...current, unit]);
  const save = async () => {
    if (!session) return;
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/v1/staff/${member.id}/sub-units`, {
        method: "PUT",
        headers: { ...authHeaders(session), "Content-Type": "application/json" },
        body: JSON.stringify({ subUnitIds: assigned.map((unit) => unit.id) }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not save the Sub Units.");
      await refreshTeam();
      setMessage("Sub Units saved.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "We could not save the Sub Units.");
    } finally { setSaving(false); }
  };
  return <article className="overview-card sub-units-card">
    <header><i><FiActivity /></i><div><h3>Sub Units</h3><p>Ministry responsibilities assigned by TPK Super Admins.</p></div></header>
    {assigned.length ? <div className="sub-unit-pills">{assigned.map((unit) => <span key={unit.id} title={unit.description || unit.name}>{unit.name}</span>)}</div> : <p className="sub-units-empty">No Sub Units have been assigned yet.</p>}
    {isSuper && <details className="sub-unit-manager"><summary>Manage Sub Units</summary><p>Only TPK Super Admins can change these responsibilities.</p><div>{catalog.map((unit) => <label key={unit.id}><input type="checkbox" checked={selectedIds.has(unit.id)} onChange={() => toggle(unit)} /><span><b>{unit.name}</b><small>{unit.description}</small></span></label>)}</div><button type="button" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Sub Units"}</button>{message && <small className="sub-unit-message">{message}</small>}</details>}
  </article>;
}

function TeacherOverview({ member, isSuper, ownProfile, refreshTeam }: { member: Member; isSuper: boolean; ownProfile: boolean; refreshTeam: () => Promise<void> }) {
  const probation = member.onboardingStatus === "PROBATION";
  return <section className="teacher-overview">
<article className="overview-card about-card"><header><i><FiUsers /></i><div><h3>About {member.firstName || personName(member)}</h3><p>Key information and ministry details.</p></div>{ownProfile && <Link href="/account/profile">Edit Details</Link>}</header><dl><div><dt>Full Name</dt><dd>{personName(member)}</dd></div><div><dt>Email Address</dt><dd>{member.email ? <a href={`mailto:${member.email}`}>{member.email}</a> : "Not added"}</dd></div><div><dt>System role</dt><dd>{accessLabel(member.accessLevel || "TPK_ADMIN")}</dd></div><div><dt>Phone Number</dt><dd>{whatsappHref(member.whatsappNumber) ? <a href={whatsappHref(member.whatsappNumber)} target="_blank" rel="noreferrer">{member.whatsappNumber}</a> : "Not added"}</dd></div><div><dt>Location</dt><dd>{isSuper ? member.residentialAddress || "Not added" : "Wuse Campus"}</dd></div><div><dt>Start Date</dt><dd>{niceDate(member.joinedAt)}</dd></div><div><dt>Date of Birth</dt><dd>{birthdayLabel(member.birthDayMonth || member.birthDate)}</dd></div><div><dt>Emergency Contact</dt><dd>{member.emergencyContact || "Not added"}</dd></div><div><dt>Status</dt><dd className={probation ? "probation-text" : "onboarded-text"}>{probation ? `● On Probation · Week ${member.probationWeek || 1}/${member.probationTargetWeeks}` : "✓ Onboarded"}</dd></div></dl></article>
    <div className="overview-split"><article className="overview-card assignment-card"><header><i><FiUsers /></i><div><h3>Roles &amp; Responsibilities</h3><p>Leadership assigns system access and ministry responsibilities.</p></div></header><dl><div><dt>System role</dt><dd>{accessLabel(member.accessLevel || "TPK_ADMIN")}</dd></div><div><dt>Upcoming responsibility</dt><dd>{member.currentAssignment || "No upcoming responsibility"}</dd></div><div><dt>Class responsibility</dt><dd>{member.assignedClasses || "Assigned by weekly roster"}</dd></div></dl></article>{probation ? <article className="overview-card probation-card"><header><i><FiShield /></i><div><h3>Probation Summary</h3><p>A quick view of their onboarding progress.</p></div></header><b>{member.probationWeek || 1} of {member.probationTargetWeeks + 1} milestones in progress</b><div className="overview-progress"><i style={{ width: `${Math.min(100, ((member.probationWeek || 1) / member.probationTargetWeeks) * 100)}%` }} /></div><small>Orientation · supported service weeks · final review</small></article> : <article className="overview-card onboarded-card"><header><i><FiCheck /></i><div><h3>Onboarding Complete</h3><p>Ready for ongoing ministry assignments.</p></div></header><b>✓ Fully onboarded</b><small>Orientation and supported serving completed.</small></article>}</div>
    <article className="overview-card ministry-card"><header><i><FiActivity /></i><div><h3>Ministry Information</h3><p>Serving profile and leadership details.</p></div></header><div><p><b>Profile</b><br/>Teacher details, assignment history and emergency contact information are held here for safe ministry coordination.</p><p><b>Emergency contact</b><br/>{member.emergencyRelationship || "Relationship not added"}{member.emergencyPhone ? ` · ${member.emergencyPhone}` : ""}</p></div></article>
    <SubUnitPanel member={member} isSuper={isSuper} refreshTeam={refreshTeam} />
    <article className="overview-card permissions-card"><header><i><FiShield /></i><div><h3>Account &amp; Permissions</h3><p>System access is separate from Sub Unit responsibilities.</p></div></header><div><span className="access-pill">TPK Teacher</span>{member.accessLevel && <span className="access-pill">{accessLabel(member.accessLevel)}</span>}{isSuper && <span className="access-pill">{member.accountActive === false ? "Inactive" : "Active account"}</span>}</div></article>
  </section>;
}

function OnboardedSummary({ member }: { member: Member }) {
  return <section className="onboarded-summary">
    <i><FiCheck /></i><div><h3>{member.title || "This teacher"} {member.firstName || personName(member)} is fully onboarded</h3><p>Orientation and the supported-service review have been completed. Their ministry profile is active and ready for Team &amp; Roster assignments.</p><dl><div><dt>Joined TPK</dt><dd>{niceDate(member.joinedAt)}</dd></div><div><dt>Current role</dt><dd>{member.currentAssignment || "TPK Teacher"}</dd></div><div><dt>Status</dt><dd>✓ Onboarded</dd></div></dl></div>
  </section>;
}

type TeacherRosterActivity = { id:number; assignmentDate:string; status:string; dutyName:string; dutyCode:string; serviceName:string; startsAt?:string|null; className?:string|null };
function TeacherRosterPanel({ member }: { member: Member }) {
  const session = useMemo(() => readTeacherSession(), []);
  const [month, setMonth] = useState(() => new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [activities, setActivities] = useState<TeacherRosterActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const monthLabel = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "UTC" }).format(month);
  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true); setError("");
    try {
      const r = await fetch(`${apiBase}/api/v1/staff/${member.id}/roster?month=${month.getUTCMonth() + 1}&year=${month.getUTCFullYear()}`, { headers: authHeaders(session) });
      const body = await r.json(); if (!r.ok || !body.success) throw new Error(body.error?.message || "We could not load this teaching roster.");
      setActivities(body.data.activities || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not load this teaching roster."); }
    finally { setLoading(false); }
  }, [member.id, month, session]);
  useEffect(() => { void load(); }, [load]);
  const exportRoster = (kind: "CSV" | "PDF") => {
    const rows = activities.map((item) => ({ Date: niceDate(item.assignmentDate), Service: item.serviceName, "Class / Duty": item.className || item.dutyName, Status: item.status === "PRESENT" ? "Served" : item.status === "ABSENT" ? "Absent" : "Upcoming" }));
    if (kind === "CSV") { const csv = [Object.keys(rows[0] || {}).join(","), ...rows.map((row) => Object.values(row).map((value) => `\"${String(value).replaceAll('"', '""')}\"`).join(","))].join("\n"); const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); const link = document.createElement("a"); link.href = url; link.download = `${personName(member).replaceAll(" ", "-").toLowerCase()}-${month.toISOString().slice(0, 7)}-roster.csv`; link.click(); URL.revokeObjectURL(url); return; }
    printBrandedDocument({ eyebrow: "Teaching roster", title: `${personName(member)}’s Roster`, subtitle: `${monthLabel} · TribePetra Kids, Wuse Campus.`, stats: [{ label: "Activities", value: rows.length }, { label: "Served", value: rows.filter((row) => row.Status === "Served").length }, { label: "Upcoming", value: rows.filter((row) => row.Status === "Upcoming").length }], columns: ["Date", "Service", "Class / Duty", "Status"], rows: rows.map((row) => [row.Date, row.Service, row["Class / Duty"], row.Status]) });
  };
  return <section className="teacher-roster-panel"><header><i><FiCalendar /></i><div><h3>Teaching Roster</h3><p>All scheduled services, assignments and attendance for the selected month.</p></div><div className="drawer-export"><button onClick={() => exportRoster("PDF")}><FiDownload /> PDF</button><button onClick={() => exportRoster("CSV")}>CSV</button></div></header><MonthPicker value={month} onChange={setMonth} ariaLabel="Choose roster month" />{error && <p className="journey-error">{error}</p>}<div className="teacher-roster-table"><table><thead><tr><th>Date</th><th>Service</th><th>Class / Duty</th><th>Status</th></tr></thead><tbody>{activities.map((item) => <tr key={item.id}><td data-label="Date"><b>{niceDate(item.assignmentDate)}</b></td><td data-label="Service">{item.serviceName}</td><td data-label="Class / Duty">{item.className || item.dutyName}</td><td data-label="Status"><span className={`roster-status ${item.status.toLowerCase()}`}>{item.status === "PRESENT" ? "✓ Served" : item.status === "ABSENT" ? "× Absent" : "○ Upcoming"}</span></td></tr>)}{!activities.length && <tr><td colSpan={4}>{loading ? "Loading roster…" : "No activities are scheduled for this month."}</td></tr>}</tbody></table></div><p className="quiet">Showing {activities.length} activit{activities.length === 1 ? "y" : "ies"} for {monthLabel}.</p></section>;
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
            serviceType: week.serviceType,
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
      <span className="action-kicker">Supported service review</span>
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
            Service taught
            <select
              value={week.serviceType || ""}
              disabled={!week.canStaffSign}
              onChange={(event) =>
                update(week.weekNumber, "serviceType", event.target.value)
              }
            >
              <option value="">Select service</option>
              <option value="FIRST_SERVICE">First Service · 8:30 AM</option>
              <option value="SECOND_SERVICE">Second Service · 10:30 AM</option>
            </select>
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
        .probation-week select,
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
        .probation-week label:nth-of-type(4),
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
  href,
  external = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  external?: boolean;
}) {
  return (
    <div className="info">
      <i>{icon}</i>
      <span>
        <small>{label}</small>
        <b>{href ? <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>{value}</a> : value}</b>
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

const styles = `.team-page{max-width:1260px}.team-page h1,.team-page h2,.team-page h3{font-family:var(--font-display),Georgia,serif}.team-heading{margin:5px 0 16px}.team-heading h1{margin:7px 0 6px;font-size:40px;letter-spacing:-1.25px}.team-heading>p:last-child{margin:0;color:#64718a;font-size:17px}.feedback{display:flex;align-items:center;gap:7px;margin:0 0 13px;padding:10px 13px;border-radius:8px;font-size:12px}.feedback.error{background:#fff0eb;color:#c4432d}.feedback.success{background:#e9f8ef;color:#097750}.team-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin-bottom:18px}.info-card{min-height:111px;padding:15px 17px;border-radius:9px;display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto auto;column-gap:12px}.info-card i{grid-row:span 2;width:37px;height:37px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-size:20px}.info-card b{align-self:end;font-size:28px;line-height:1}.info-card strong{font-size:13px}.info-card small{grid-column:1 / -1;color:#65728b;font-size:11px}.info-card.green{background:#eff9f3}.info-card.green i{background:#d9f3e2;color:#078056}.info-card.blue{background:#eff6ff}.info-card.blue i{background:#ddecff;color:#1972c4}.info-card.orange{background:#fff6e6}.info-card.orange i{background:#ffebc1;color:#df8f00}.info-card.purple{background:#f6efff}.info-card.purple i{background:#eadcff;color:#7440c2}.team-tabs{display:flex;width:min(100%,540px);margin-bottom:15px;border:1px solid #e0e3e9;border-radius:8px;overflow:hidden;background:#fff}.team-tabs button{flex:1;height:39px;border:0;border-right:1px solid #e8e9ec;background:#fff;color:#59667d;font:800 11px var(--font-body);cursor:pointer}.team-tabs button:last-child{border-right:0}.team-tabs button.active{background:#fff6f0;color:#ec4d2b;box-shadow:inset 0 2px #ff5a35}.team-directory{padding:15px 17px 13px;border:1px solid #e4e1db;border-radius:10px;background:#fffdfa}.toolbar{display:grid;grid-template-columns:minmax(220px,1fr) minmax(240px,300px) minmax(130px,170px) minmax(135px,160px) auto auto;align-items:end;gap:9px}.search{height:42px;min-width:0;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #d9dfe8;border-radius:8px;background:#fff;color:#697792}.search input{width:100%;min-width:0;border:0;outline:0;background:transparent;font:600 12px var(--font-body)}.team-month-picker{min-width:0!important;width:100%;height:42px!important}.team-month-picker .tpk-month-picker-arrow{width:35px;font-size:16px}.team-month-picker .tpk-month-picker-trigger{gap:7px;padding:0 9px;font-size:14px}.team-month-picker .tpk-month-picker-trigger>svg:first-child{font-size:16px}.toolbar select,.filter-button{width:100%;height:42px;border:1px solid #d9dfe8;border-radius:8px;background:#fff;padding:0 10px;color:#263550;font:800 11px var(--font-body)}.directory-select{display:grid;gap:4px;min-width:0;color:#6a7890;font-size:9px;font-weight:900}.filter-button{width:auto;display:inline-flex;align-items:center;gap:7px;cursor:pointer}.more-wrap,.export-wrap{position:relative}.more-menu,.export-menu{position:absolute;z-index:25;right:0;top:48px;min-width:210px;padding:10px;border:1px solid #dce1e7;border-radius:8px;background:#fff;box-shadow:0 15px 32px #12203a22}.more-menu label{display:grid;gap:6px;color:#4e5d77;font-size:10px;font-weight:800}.more-menu select{width:100%}.more-menu>button,.export-menu button{width:100%;margin-top:8px;padding:8px;border:0;border-radius:5px;background:transparent;text-align:left;color:#263550;font:700 11px var(--font-body);cursor:pointer}.more-menu>button:hover,.export-menu button:hover{background:#fff1ea;color:#df4b2c}.more-menu p{margin:0;color:#65728a;font-size:11px}.directory-count{margin:17px 0 10px;color:#243653;font-size:13px;font-weight:900}.table-wrap{overflow:auto;border:1px solid #e9e5de;border-radius:8px}.team-directory table{width:100%;min-width:900px;border-collapse:collapse}.team-directory th{padding:11px 10px;background:#f8f7f4;color:#60708a;text-align:left;font-size:10px;font-weight:900}.team-directory td{padding:9px 10px;border-top:1px solid #e9e8e5;color:#506079;font-size:11px}.team-directory tbody tr{cursor:pointer}.team-directory tbody tr:hover{background:#fff8f4}.teacher{display:flex;align-items:center;gap:9px;min-width:200px}.avatar{width:34px;height:34px;flex:none;border-radius:50%;object-fit:cover}.i.avatar,.avatar:not(img){display:grid;place-items:center;background:#e8eef8;color:#285f9f;font-size:10px;font-style:normal;font-weight:900}.teacher span{display:grid;gap:3px}.teacher b{color:#172841;font-size:12px}.teacher small{color:#6d7890;font-size:10px}.status{display:inline-flex;align-items:center;gap:5px;width:max-content;padding:6px 8px;border-radius:99px;font-size:10px;font-weight:900;white-space:nowrap}.status.onboarded{background:#e8f8ed;color:#087950}.status.probation{background:#fff1db;color:#ae6b00}.paging{margin:12px 0 0;color:#65728a;font-size:11px}.empty{text-align:center!important;padding:30px!important;color:#738098!important}.drawer-backdrop{position:fixed;z-index:100;inset:0;display:grid;justify-items:end;background:#09182d38}.teacher-drawer{position:relative;width:min(100%,410px);height:100%;overflow:auto;background:#fffdfa;box-shadow:-16px 0 45px #08172f28}.drawer-close{position:absolute;right:16px;top:17px;border:0;background:transparent;color:#35435d;font-size:20px;cursor:pointer}.teacher-drawer>header{display:flex;align-items:center;gap:13px;padding:28px 23px 18px}.teacher-drawer>header .avatar{width:66px;height:66px;font-size:16px}.teacher-drawer h2{margin:0;font-size:24px}.teacher-drawer header p{margin:3px 0 8px;color:#65728b;font-size:12px}.teacher-drawer nav{display:flex;padding:0 16px;border-bottom:1px solid #e8e6e1}.teacher-drawer nav button{flex:1;padding:11px 5px;border:0;border-bottom:2px solid transparent;background:transparent;color:#66728a;font:800 10px var(--font-body);cursor:pointer}.teacher-drawer nav button.active{border-bottom-color:#ff5533;color:#172a48}.drawer-content{padding:17px 23px 100px}.drawer-section{padding:0 0 15px;margin:0 0 15px;border-bottom:1px solid #ebe8e3}.drawer-section h3{margin:0 0 13px;font-size:16px}.info{display:flex;gap:10px;margin:12px 0}.info>i{width:20px;color:#607391;font-style:normal;font-size:17px}.info span{display:grid;gap:3px}.info small{color:#718099;font-size:10px}.info b{color:#263752;font-size:12px}.quiet{margin:13px 0 0;color:#748097;font-size:11px;line-height:1.5}.outline-link,.edit-link{display:block;padding:11px;border:1px solid #dce1e8;border-radius:7px;color:#283953;text-align:center;font:800 11px var(--font-body);text-decoration:none}.attendance-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}.metric{padding:12px;border-radius:8px;background:#f7f8f8;display:grid;gap:5px}.metric b{font-size:21px}.metric small{color:#65728b;font-size:10px}.week{display:block;font-size:13px}.progress{height:9px;margin:11px 0 5px;overflow:hidden;border-radius:99px;background:#e8ebef}.progress i{display:block;height:100%;border-radius:99px;background:#f3a21c}.drawer-section>small{color:#64718a;font-size:10px}.milestones{margin:16px 0 0;padding:0;list-style:none;display:grid;gap:10px}.milestones li{display:flex;justify-content:space-between;gap:8px;color:#68758b;font-size:11px}.milestones li:before{content:"○";margin-right:6px}.milestones li.done:before{content:"✓";color:#099158}.milestones li.current:before{content:"◉";color:#f0a018}.milestones li em{margin-left:auto;padding:3px 6px;border-radius:99px;background:#eef0f4;color:#64708a;font-size:9px;font-style:normal}.extend{padding:13px;border-radius:8px;background:#fff7e8;display:grid;gap:9px}.extend>b{font-size:13px}.extend label{display:grid;gap:5px;color:#52607a;font-size:10px;font-weight:800}.extend select,.extend textarea{width:100%;box-sizing:border-box;border:1px solid #d9dfe8;border-radius:6px;background:#fff;padding:8px;font:11px var(--font-body)}.extend textarea{min-height:60px;resize:vertical}.drawer-actions{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:13px 16px;border-top:1px solid #e9e6df;background:#fffdfa}.drawer-actions button{height:39px}.outline,.primary{border-radius:7px;padding:0 12px;font:800 11px var(--font-body);cursor:pointer}.outline{border:1px solid #d8dee6;background:#fff;color:#253650}.primary{border:1px solid #ff5634;background:#ff5634;color:#fff}.drawer-actions .outline{display:flex;align-items:center;gap:6px}.action-menu{position:absolute;z-index:2;bottom:60px;left:16px;right:16px;padding:12px;border:1px solid #dce1e7;border-radius:8px;background:#fff;box-shadow:0 12px 30px #0b19302e;display:grid;gap:7px}.action-menu>b{font-size:11px}.action-menu>button{height:auto;padding:7px;border:0;background:transparent;color:#d04a31;text-align:left;font:800 11px var(--font-body)}.action-menu label{display:grid;gap:5px;color:#58667e;font-size:10px;font-weight:800}.action-menu select{height:34px;border:1px solid #dce1e7;border-radius:6px;background:#fff;padding:0 8px;font:11px var(--font-body)}@media(max-width:1100px){.team-cards{grid-template-columns:repeat(2,1fr)}.toolbar{grid-template-columns:minmax(220px,1fr) minmax(240px,300px) 150px auto;align-items:end}.toolbar .directory-select{grid-column:3}.toolbar .export-wrap{grid-column:4}.toolbar :global(.data-view-toggle){grid-column:4}}@media(max-width:760px){.toolbar{grid-template-columns:1fr 1fr}.search{grid-column:1/-1}.team-month-picker{grid-column:1/-1}.toolbar .directory-select,.toolbar .export-wrap,.toolbar :global(.data-view-toggle){grid-column:auto}}@media(max-width:600px){.team-heading h1{font-size:34px}.team-cards{grid-template-columns:1fr 1fr;gap:8px}.info-card{padding:12px;min-height:100px}.info-card b{font-size:24px}.info-card strong{font-size:11px}.info-card small{font-size:9px}.team-tabs{width:100%;overflow:auto}.team-tabs button{min-width:135px}.toolbar{grid-template-columns:1fr}.toolbar>*{min-width:0}.search,.team-month-picker{grid-column:auto}.filter-button{justify-content:center;width:100%}.teacher-drawer{width:100%}}`;

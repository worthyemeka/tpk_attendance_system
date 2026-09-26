"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FiBarChart2,
  FiBookOpen,
  FiCheckSquare,
  FiChevronRight,
  FiClock,
  FiHome,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiUser,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import {
  apiBase,
  authHeaders,
  clearTeacherSession,
  readTeacherSession,
  type TeacherSession,
} from "@/lib/session";
import "./sidebar-refinement.css";

type Item = readonly [string, string, typeof FiHome];
const superSunday: readonly Item[] = [
  ["Overview", "/account/overview", FiHome],
  ["Check-In", "/account/check-in", FiCheckSquare],
  ["Pick-Up", "/account/pick-up", FiLogOut],
  ["Classrooms", "/account/classrooms", FiUsers],
];
const superPeople: readonly Item[] = [
  ["Children", "/account/children", FiUser],
  ["Guardians", "/account/guardians", FiUserCheck],
  ["Families", "/account/families", FiUsers],
  ["Team", "/account/team", FiUsers],
];
const superMinistry: readonly Item[] = [
  ["Team & Roster", "/account/roster", FiClock],
  ["Relations & Follow-Up", "/account/relations", FiUserCheck],
  ["Classes & Curriculum", "/account/classes", FiBookOpen],
  ["Reports", "/account/reports", FiBarChart2],
];
const adminSunday: readonly Item[] = [
  ["Overview", "/account/overview", FiHome],
  ["Check-In", "/account/check-in", FiCheckSquare],
  ["Pick-Up", "/account/pick-up", FiLogOut],
  ["My Classrooms", "/account/classrooms", FiUsers],
];
const adminPeople: readonly Item[] = [["Team", "/account/team", FiUsers]];
const adminMinistry: readonly Item[] = [
  ["My Roster", "/account/roster", FiClock],
  ["My Follow-Ups", "/account/relations", FiUserCheck],
  ["Classes & Curriculum", "/account/classes", FiBookOpen],
];
const followUpLeadMinistry: readonly Item[] = [
  ["My Roster", "/account/roster", FiClock],
  ["Relations & Follow-Up", "/account/relations", FiUserCheck],
  ["Classes & Curriculum", "/account/classes", FiBookOpen],
];
function initials(session: TeacherSession) {
  return (
    `${session.firstName?.[0] || ""}${session.lastName?.[0] || ""}`.toUpperCase() ||
    "TP"
  );
}
function Group({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: readonly Item[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <section className="side-group">
      <p className="side-label">{title}</p>
      {items.map(([label, href, Icon]) => (
        <Link
          key={label}
          href={href}
          onClick={onNavigate}
          className={pathname === href ? "active" : ""}
        >
          <i className="side-icon">
            <Icon />
          </i>
          <span>{label}</span>
        </Link>
      ))}
    </section>
  );
}

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<TeacherSession | null>(null);
  const [open, setOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => setSession(readTeacherSession()), []);
  useEffect(() => {
    setMobileNavOpen(false);
    setOpen(false);
  }, [pathname]);
  if (!session) return null;
  const superAdmin = session.accessLevel === "TPK_SUPER_ADMIN";
  const followUpLead = session.accessLevel === "TPK_FOLLOW_UP_ADMIN";
  async function signOut() {
    try {
      await fetch(`${apiBase}/api/teachers/logout`, {
        method: "POST",
        headers: authHeaders(session),
      });
    } finally {
      clearTeacherSession();
      router.replace("/teacher/login");
    }
  }
  const closeMobileNav = () => setMobileNavOpen(false);
  return (
    <>
      <Link className="mobile-tpk-mark" href="/account/overview">
        <Image
          src="/brand/tpk-logo.png"
          alt="TribePetra Kids"
          width={118}
          height={27}
          priority
        />
      </Link>
      <button
        className="mobile-nav-toggle"
        type="button"
        onClick={() => setMobileNavOpen((value) => !value)}
        aria-expanded={mobileNavOpen}
        aria-controls="dashboard-navigation"
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        title={mobileNavOpen ? "Close navigation" : "Open navigation"}
      >
        {mobileNavOpen ? <FiX /> : <FiMenu />}
      </button>
      {mobileNavOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={closeMobileNav}
        />
      )}
      <aside
        className={`sidebar${mobileNavOpen ? " mobile-open" : ""}`}
        id="dashboard-navigation"
      >
        <div className="sidebar-scroll">
          <Link className="brand" href="/account/overview">
            <Image
              src="/brand/petra-logo.jpg"
              alt="Petra Church"
              width={54}
              height={54}
              className="petra-logo"
              priority
            />
            <span className="brand-copy">
              <Image
                src="/brand/tpk-logo.png"
                alt="TribePetra Kids"
                width={118}
                height={27}
                className="tpk-logo"
                priority
              />
              <small>Wuse Campus</small>
            </span>
          </Link>
          <nav aria-label="Dashboard navigation">
            <Group
              title="Sunday"
              items={superAdmin ? superSunday : adminSunday}
              onNavigate={closeMobileNav}
            />
            {superAdmin && (
              <>
                <Group
                  title="People"
                  items={superPeople}
                  onNavigate={closeMobileNav}
                />
                <Group
                  title="Ministry"
                  items={superMinistry}
                  onNavigate={closeMobileNav}
                />
              </>
            )}
            {!superAdmin && (
              <>
                <Group
                  title="People"
                  items={adminPeople}
                  onNavigate={closeMobileNav}
                />
                <Group
                  title="My Ministry"
                  items={followUpLead ? followUpLeadMinistry : adminMinistry}
                  onNavigate={closeMobileNav}
                />
              </>
            )}
            <section className="side-group settings-link">
              <Link href="/account/settings" onClick={closeMobileNav}>
                <i className="side-icon">
                  <FiSettings />
                </i>
                <span>Settings</span>
              </Link>
            </section>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-footer-wrap">
            <button
              className="sidebar-footer"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
            >
              {session.profileImageUrl ? (
                <img
                  className="avatar avatar-image"
                  src={`${apiBase}${session.profileImageUrl}`}
                  alt=""
                />
              ) : (
                <div className="avatar">
                  {initials(session)}
                  <i />
                </div>
              )}
              <div>
                <b>
                  {session.title} {session.firstName}
                </b>
                <small>{superAdmin ? "TPK Super Admin" : "TPK Teacher"}</small>
                <em>
                  <i />
                  {session.teamStatus === "PROBATION" ? "Probation" : "Online"}
                </em>
              </div>
              <FiChevronRight />
            </button>
            {open && (
              <div className="profile-menu">
                <Link
                  className="profile-menu-item"
                  href="/account/profile"
                  onClick={() => setOpen(false)}
                >
                  <FiUser />
                  My Profile
                </Link>
                <Link
                  className="profile-menu-item"
                  href="/account/settings"
                  onClick={() => setOpen(false)}
                >
                  <FiSettings />
                  Account Settings
                </Link>
                <button className="profile-menu-item" onClick={signOut}>
                  <FiLogOut />
                  Sign Out
                </button>
              </div>
            )}
          </div>
          <p className="sidebar-tagline">
            CHECK IN <b>•</b> BELONG <b>•</b> GROW
          </p>
        </div>
        <style jsx>{`
          .sidebar-scroll {
            min-height: 0;
            flex: 1;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: thin;
            scrollbar-color: #555 #171817;
          }
          .sidebar-bottom {
            flex: none;
          }
          .sidebar-footer-wrap {
            position: relative;
          }
          .sidebar-footer {
            width: 100%;
            border: 0;
            background: transparent;
            color: inherit;
            text-align: left;
            cursor: pointer;
          }
          .profile-menu {
            position: absolute;
            z-index: 9;
            bottom: 77px;
            left: 0;
            right: 0;
            padding: 6px;
            background: #292a29;
            border: 1px solid #464746;
            border-radius: 9px;
            box-shadow: 0 12px 24px #0005;
          }
          .profile-menu-item {
            display: block;
            width: 100%;
            padding: 9px;
            border: 0;
            background: transparent;
            color: #fff !important;
            text-align: left;
            text-decoration: none !important;
            border-radius: 6px;
            font: 700 11px var(--font-body);
            cursor: pointer;
          }
          .profile-menu-item:hover {
            background: #3b3c3b;
          }
          .avatar-image {
            object-fit: cover;
          }
        `}</style>
        <style jsx global>{`
          .mobile-tpk-mark,
          .mobile-nav-toggle,
          .sidebar-backdrop {
            display: none;
          }
          .sidebar {
            width: 290px;
            height: 100dvh;
            min-height: 0;
            overflow: hidden;
            padding: 20px 18px 14px;
          }
          .content {
            margin-left: 290px;
            max-width: none;
            padding: 28px 36px 36px;
          }
          @media (max-width: 1100px) {
            .sidebar {
              width: 224px;
            }
            .content {
              margin-left: 224px;
              padding: 24px;
            }
          }
          @media (max-width: 780px) {
            .sidebar {
              width: 68px;
              padding: 18px 8px;
            }
            .content {
              margin-left: 68px;
            }
          }
          @media (max-width: 590px) {
            .mobile-tpk-mark {
              position: fixed;
              z-index: 104;
              top: 0;
              left: 0;
              display: flex;
              align-items: center;
              width: 100%;
              height: 64px;
              padding: 0 17px;
              background: #fff5eb;
              border-bottom: 1px solid #eadfd4;
              box-shadow: 0 4px 16px #5a2b1712;
            }
            .mobile-tpk-mark img {
              width: 76px;
              height: 42px;
              object-fit: contain;
              object-position: left center;
            }
            .mobile-nav-toggle {
              position: fixed;
              z-index: 104;
              top: 12px;
              right: 12px;
              left: auto;
              height: 40px;
              display: inline-flex;
              align-items: center;
              border: 1px solid #e0d9cf;
              border-radius: 8px;
              background: #fffdfa;
              color: #172641;
              width: 40px;
              justify-content: center;
              padding: 0;
              box-shadow: none;
              cursor: pointer;
            }
            .mobile-nav-toggle svg {
              font-size: 18px;
            }
            .sidebar-backdrop {
              display: block;
              position: fixed;
              z-index: 102;
              inset: 0;
              border: 0;
              background: #0b172f70;
            }
            .sidebar {
              position: fixed !important;
              z-index: 103 !important;
              inset: 0 0 0 auto !important;
              width: min(330px, 88vw) !important;
              height: 100dvh !important;
              min-height: 100dvh !important;
              overflow: hidden !important;
              display: flex !important;
              flex-direction: column !important;
              padding: 20px 18px 14px !important;
              transform: translateX(105%);
              transition: transform 0.22s ease;
              box-shadow: -18px 0 42px #07132d45;
            }
            .sidebar.mobile-open {
              transform: translateX(0);
            }
            .sidebar-scroll {
              overflow-y: auto !important;
            }
            .sidebar-bottom {
              display: block !important;
            }
            .sidebar .side-group {
              display: grid !important;
            }
            .sidebar .side-group a {
              padding: 0 10px !important;
              justify-content: flex-start !important;
              gap: 11px !important;
            }
            .sidebar .side-group a span,
            .sidebar .side-label,
            .sidebar .brand-copy {
              display: block !important;
            }
            .sidebar .brand {
              display: flex !important;
            }
            .content {
              margin-left: 0 !important;
              padding: 75px 17px 20px !important;
            }
          }
        `}</style>
      </aside>
    </>
  );
}

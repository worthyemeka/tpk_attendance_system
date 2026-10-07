"use client";

import Image from "next/image";
import localFont from "next/font/local";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FiBarChart2,
  FiCalendar,
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
  mediaUrl,
  clearTeacherSession,
  readTeacherSession,
  teacherSessionChangedEvent,
  type TeacherSession,
} from "@/lib/session";
import { subscribeToActiveService, type ActiveService } from "@/lib/active-service";
import { NotificationBell } from "@/components/notification-bell";
import { useProfileDialog } from "@/components/use-profile-dialog";
import "./sidebar-refinement.css";

const campusFont = localFont({ src: "../../public/fonts/dm-serif-display.ttf", weight: "400", display: "swap", variable: "--font-campus" });

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
  ["Events & Conferences", "/account/events", FiCalendar],
  ["Teacher Check-In", "/account/teacher-check-in", FiCheckSquare],
  ["Team & Roster", "/account/roster", FiClock],
  ["Relations & Follow-Up", "/account/relations", FiUserCheck],
  ["Classes & Curriculum", "/account/classes", FiBookOpen],
  ["Reports", "/account/reports", FiBarChart2],
];
const adminSunday: readonly Item[] = [
  ["Overview", "/account/overview", FiHome],
  ["Check-In", "/account/check-in", FiCheckSquare],
  ["Pick-Up", "/account/pick-up", FiLogOut],
  ["Classrooms", "/account/classrooms", FiUsers],
];
const adminPeople: readonly Item[] = [["Team", "/account/team", FiUsers]];
const serviceLeadPeople: readonly Item[] = [
  ["Children", "/account/children", FiUser],
  ["Guardians", "/account/guardians", FiUserCheck],
  ["Families", "/account/families", FiUsers],
  ["Team", "/account/team", FiUsers],
];
const adminMinistry: readonly Item[] = [
  ["Events & Conferences", "/account/events", FiCalendar],
  ["Teacher Check-In", "/account/teacher-check-in", FiCheckSquare],
  ["My Roster", "/account/roster", FiClock],
  ["My Follow-Ups", "/account/relations", FiUserCheck],
  ["Classes & Curriculum", "/account/classes", FiBookOpen],
];
const followUpLeadMinistry: readonly Item[] = [
  ["Events & Conferences", "/account/events", FiCalendar],
  ["Teacher Check-In", "/account/teacher-check-in", FiCheckSquare],
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
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavScrolled, setMobileNavScrolled] = useState(false);
  const [activeService, setActiveService] = useState<ActiveService | null>(null);
  const [checkinVisible, setCheckinVisible] = useState(false);
  const [peopleDirectoryVisible, setPeopleDirectoryVisible] = useState(false);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  useProfileDialog(() => setMobileNavOpen(false), ".sidebar.mobile-open", mobileNavOpen);
  useEffect(() => {
    const refreshSession = () => { setSession(readTeacherSession()); setProfileImageFailed(false); };
    const onStorage = (event: StorageEvent) => { if (event.key === "tpk-teacher" || event.key === null) refreshSession(); };
    refreshSession();
    window.addEventListener(teacherSessionChangedEvent, refreshSession);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(teacherSessionChangedEvent, refreshSession);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  useEffect(() => subscribeToActiveService(setActiveService), []);
  useEffect(() => {
    if (!session) return;
    if (session.accessLevel === "TPK_SUPER_ADMIN") {
      setCheckinVisible(true);
      setPeopleDirectoryVisible(true);
      return;
    }
    if (session.accessLevel === "TPK_FOLLOW_UP_ADMIN") {
      setCheckinVisible(false);
      setPeopleDirectoryVisible(true);
      return;
    }
    let cancelled = false;
    const headers = authHeaders(session);
    Promise.all([
      fetch(`${apiBase}/api/v1/check-ins`, { headers }),
      fetch(`${apiBase}/api/v1/guardians/summary`, { headers }),
    ])
      .then(([checkinResponse, peopleResponse]) => {
        if (cancelled) return;
        setCheckinVisible(checkinResponse.ok);
        setPeopleDirectoryVisible(peopleResponse.ok);
      })
      .catch(() => {
        if (cancelled) return;
        setCheckinVisible(false);
        setPeopleDirectoryVisible(false);
      });
    return () => { cancelled = true; };
  }, [activeService?.id, session]);
  useEffect(() => {
    const update = () => setMobileNavScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    setMobileNavOpen(false);
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    accountMenuRef.current?.querySelector<HTMLAnchorElement>(".profile-menu a")?.focus({ preventScroll: true });
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) setOpen(false);
    };
    const dismissWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      accountTriggerRef.current?.focus({ preventScroll: true });
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissWithEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("keydown", dismissWithEscape, true);
    };
  }, [open]);
  useEffect(() => {
    if (!mobileNavOpen) return;
    const resize = () => { if (!window.matchMedia("(max-width: 590px)").matches) setMobileNavOpen(false); };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [mobileNavOpen]);
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
      {!mobileNavOpen && <div className={`mobile-nav-bar${mobileNavScrolled ? " is-scrolled" : ""}`}>
        <Link className="mobile-tpk-mark" href="/account/overview">
          <Image
            src="/brand/tpk-logo.png"
            alt="TribePetra Kids"
            width={118}
            height={27}
            priority
          />
        </Link>
        <div className="mobile-nav-actions">
          <NotificationBell serviceSessionId={activeService?.id} />
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
        </div>
      </div>}
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
        role={mobileNavOpen ? "dialog" : undefined}
        aria-modal={mobileNavOpen || undefined}
        aria-label={mobileNavOpen ? "Navigation" : undefined}
      >
        {mobileNavOpen && <button className="sidebar-menu-close" type="button" aria-label="Close navigation" onClick={closeMobileNav}><FiX /></button>}
        <div className="sidebar-scroll">
          <Link className={`brand ${campusFont.variable}`} href="/account/overview">
            <span className="brand-logos">
            <Image
              src="/brand/petra-logo.jpg"
              alt="Petra Church"
              width={54}
              height={54}
              className="petra-logo"
              priority
            />
              <Image
                src="/brand/tpk-logo.png"
                alt="TribePetra Kids"
                width={76}
                height={76}
                className="tpk-logo"
                priority
              />
            </span>
            <span className="brand-copy"><small>Mabushi (Regional) Campus</small></span>
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
                  items={peopleDirectoryVisible ? serviceLeadPeople : adminPeople}
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
          <div className={`sidebar-footer-wrap${open ? " account-open" : ""}`} ref={accountMenuRef}>
            <button
              className="sidebar-footer"
              ref={accountTriggerRef}
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={open ? "sidebar-account-menu" : undefined}
              aria-label={`Account options for ${[session.title, session.firstName, session.lastName].filter(Boolean).join(" ")}`}
            >
              {session.profileImageUrl && !profileImageFailed ? (
                <img
                  className="avatar avatar-image"
                  src={mediaUrl(session.profileImageUrl)}
                  alt={`${session.title} ${session.firstName} profile`}
                  onError={() => setProfileImageFailed(true)}
                />
              ) : (
                <div className="avatar">
                  {initials(session)}
                  <i />
                </div>
              )}
              <div className="sidebar-account-copy">
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
              <nav className="profile-menu" id="sidebar-account-menu" aria-label="Your account">
                <p className="profile-menu-label">Your account</p>
                <Link
                  className="profile-menu-item"
                  href="/account/profile"
                  onClick={() => setOpen(false)}
                >
                  <i className="profile-menu-icon"><FiUser /></i>
                  <span><b>My profile</b><small>Manage your details</small></span>
                </Link>
                <Link
                  className="profile-menu-item"
                  href="/account/settings"
                  onClick={() => setOpen(false)}
                >
                  <i className="profile-menu-icon"><FiSettings /></i>
                  <span><b>Account settings</b><small>Preferences and access</small></span>
                </Link>
                <div className="profile-menu-signout"><button type="button" className="profile-menu-item" onClick={signOut}>
                  <i className="profile-menu-icon"><FiLogOut /></i>
                  <span><b>Sign out</b></span>
                </button></div>
              </nav>
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
          .avatar-image {
            object-fit: cover;
          }
        `}</style>
        <style jsx global>{`
          .mobile-tpk-mark,
          .mobile-nav-toggle,
          .mobile-nav-bar,
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
            .mobile-nav-bar {
              position: fixed;
              z-index: 104;
              top: 0;
              left: 0;
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: 100%;
              height: 64px;
              padding: 0 17px;
              background: transparent;
              border-bottom: 1px solid transparent;
              transition: background .2s ease, border-color .2s ease, box-shadow .2s ease;
            }
            .mobile-nav-bar.is-scrolled {
              background: #fff5eb;
              border-bottom-color: #eadfd4;
              box-shadow: 0 4px 16px #5a2b1712;
            }
            .mobile-tpk-mark {
              display: flex;
              align-items: center;
              height: 42px;
            }
            .mobile-nav-actions {
              display: flex;
              align-items: center;
              gap: 8px;
            }
            .mobile-tpk-mark img {
              width: 76px;
              height: 42px;
              object-fit: contain;
              object-position: left center;
            }
            .mobile-nav-toggle {
              position: static;
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
            .mobile-nav-actions .notification-wrap {
              position: relative;
              display: block;
            }
            .mobile-nav-actions .notification-button {
              width: 40px;
              height: 40px;
              background: #fffdfa;
              box-shadow: none;
            }
            .mobile-nav-actions .notification-popover {
              top: 48px;
              right: 0;
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

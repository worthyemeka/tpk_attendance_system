import type { Metadata } from "next";

export const SITE_NAME = "TribePetra Kids | Wuse";
// Canonicals always use the public site, not a temporary deployment or query token.
export const SITE_URL = new URL(process.env.SITE_URL || "https://tpk-checkin.vercel.app").origin;
const brandKeywords = ["TribePetra Kids", "TPK", "Petra Church", "Wuse Campus", "children's ministry", "Abuja"];
type PageSeo = { title: string; description: string; keywords: string[]; public?: boolean };
export const PAGE_SEO: Record<string, PageSeo> = {
  "/": { title: "TribePetra Kids — Wuse Campus", description: "Welcome to TribePetra Kids at Petra Church, Wuse Campus. Register your family, check in your children and connect with our children's ministry team.", keywords: ["Petra Wuse", "kids church", "family registration", "children check-in", "safe child pickup"], public: true },
  "/account": { title: "Staff Dashboard", description: "Access the TribePetra Kids staff dashboard and your authorised ministry tools.", keywords: ["staff dashboard", "ministry operations"] },
  "/account/overview": { title: "Ministry Overview", description: "Review attendance, service assignments, classroom activity and follow-up for the selected Sunday and service.", keywords: ["Sunday overview", "service attendance", "ministry dashboard"] },
  "/account/check-in": { title: "Check-In Desk", description: "Review child arrivals and check-in approvals for the selected TribePetra Kids Sunday service.", keywords: ["child check-in", "arrival approvals", "check-in desk"] },
  "/account/check-in/assisted": { title: "Assisted Check-In", description: "Help registered families check in, register new children and record assisted arrivals for the selected service.", keywords: ["assisted check-in", "desk registration", "family arrivals"] },
  "/account/pick-up": { title: "Pick-Up Desk", description: "Verify authorised collectors, manage assisted pickups and review children awaiting pickup or already collected.", keywords: ["child pickup", "authorised collectors", "assisted pickup", "pickup history"] },
  "/account/children": { title: "Children Directory", description: "View authorised child profiles, classroom assignments, guardian details, attendance and follow-up information.", keywords: ["children directory", "child profiles", "class assignments", "attendance history"] },
  "/account/guardians": { title: "Guardians Directory", description: "View authorised guardian records and family contact information for safeguarding and ministry support.", keywords: ["guardians directory", "parent contacts", "authorised pickup"] },
  "/account/families": { title: "Families Directory", description: "Review registered households, linked children and guardian contacts in the TribePetra Kids family directory.", keywords: ["families directory", "registered households", "family profiles"] },
  "/account/team": { title: "Team Directory", description: "View the TribePetra Kids teaching team, staff profiles, service duties and permitted contact details.", keywords: ["teacher directory", "ministry team", "staff profiles"] },
  "/account/roster": { title: "Team & Roster", description: "Review teaching and ministry assignments by date and service, and download weekly roster PDFs.", keywords: ["teaching roster", "Sunday assignments", "service duties", "weekly roster PDF"] },
  "/account/classrooms": { title: "Classrooms & Assembly", description: "Review classroom attendance, assigned teachers, assembly activities and service notes for the selected Sunday.", keywords: ["classrooms", "assembly programme", "assigned teachers", "class attendance"] },
  "/account/classrooms/[classId]": { title: "Classroom Details", description: "Review a classroom's children, assigned teachers, attendance, discussions and lesson activities for the selected service.", keywords: ["classroom details", "class attendance", "teacher discussions", "lesson activities"] },
  "/account/classes": { title: "Classes & Curriculum", description: "Review TribePetra Kids classroom configuration, age groups and curriculum resources available to your account.", keywords: ["classes and curriculum", "class age groups", "ministry lessons"] },
  "/account/relations": { title: "Relations & Follow-Up", description: "Review families needing follow-up, assign family calls and record contact updates and leadership reports.", keywords: ["family follow-up", "absence follow-up", "pastoral care", "follow-up reports"] },
  "/account/reports": { title: "Attendance & Ministry Reports", description: "Review service attendance, classroom and ministry reports using the selected Sunday and service context.", keywords: ["attendance reports", "ministry reports", "service reporting"] },
  "/account/settings": { title: "Settings & Sunday Services", description: "Manage account settings and authorised Sunday service planning, including service themes and times.", keywords: ["Sunday service planning", "service times", "service themes", "account settings"] },
  "/account/profile": { title: "My Staff Profile", description: "Manage your TribePetra Kids staff profile, contact details and account information.", keywords: ["staff profile", "teacher account", "contact details"] },
  "/account/notifications": { title: "Staff Notifications", description: "Review your TribePetra Kids assignment notices, roster updates and follow-up notifications.", keywords: ["staff notifications", "roster updates", "assignment notices"] },
  "/teacher/login": { title: "Teacher Sign In", description: "Sign in to the TribePetra Kids team portal to view your authorised assignments and ministry tools.", keywords: ["teacher sign in", "staff login", "TPK team portal"] },
  "/teacher/sign-up": { title: "Join the TPK Team Portal", description: "Create your TribePetra Kids teacher account and provide the details needed to join the team portal.", keywords: ["teacher registration", "staff account", "TPK team onboarding"] },
  "/teacher/verify": { title: "Verify Teacher Account", description: "Complete your TribePetra Kids teacher account verification to continue to the team portal.", keywords: ["teacher verification", "account verification", "team portal"] },
  "/check-in": { title: "Family Check-In", description: "Find your family's TribePetra Kids check-in options and record children's arrivals with the ministry team.", keywords: ["family check-in", "child arrivals", "Sunday check-in"] },
  "/check-in/parent": { title: "Parent & Guardian Check-In", description: "Check in registered children or register your family, choose pickup arrangements and wait for teacher approval.", keywords: ["parent check-in", "guardian check-in", "family registration", "teacher approval"] },
  "/families": { title: "Family Lookup", description: "Look up registered TribePetra Kids family records using authorised family search tools.", keywords: ["family lookup", "family search", "registered families"] },
  "/families/new": { title: "Register a Family", description: "Register a new TribePetra Kids family with children's details, guardian contacts and pickup arrangements.", keywords: ["new family registration", "child registration", "guardian details"] },
  "/pick-up": { title: "Secure Child Pick-Up", description: "Use the TribePetra Kids pickup desk to verify an authorised collector and safely release children.", keywords: ["secure child pickup", "collector verification", "pickup desk"] },
  "/pickup-ticket": { title: "Child Pickup Ticket", description: "View your private TribePetra Kids pickup ticket for verification by the ministry team.", keywords: ["pickup ticket", "pickup verification", "child collection"] },
};

export function pageMetadata(path: string): Metadata {
  const page = PAGE_SEO[path] || { title: "Staff Portal", description: "Authorised TribePetra Kids ministry tools for Wuse Campus.", keywords: ["staff portal", "ministry tools"] };
  const index = page.public === true && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");
  const title = `${page.title} | ${SITE_NAME}`;
  // Never fetch names, contacts, medical details or pickup tokens for metadata.
  return {
    title: { absolute: path === "/" ? `${page.title} | Petra Church` : title },
    description: page.description,
    keywords: [...brandKeywords, ...page.keywords],
    alternates: path.includes("[") || !PAGE_SEO[path] ? null : { canonical: new URL(path, SITE_URL).href },
    robots: index ? { index: true, follow: true } : { index: false, follow: false, noarchive: true, nosnippet: true, noimageindex: true, googleBot: { index: false, follow: false, noimageindex: true, nosnippet: true } },
    openGraph: { type: "website", locale: "en_NG", siteName: SITE_NAME, title: page.title, description: page.description, images: [{ url: `${SITE_URL}/brand/tpk-logo.png`, alt: "TribePetra Kids" }], ...(index ? { url: new URL(path, SITE_URL).href } : {}) },
    twitter: { card: "summary", title: page.title, description: page.description, images: [`${SITE_URL}/brand/tpk-logo.png`] },
  };
}

export function sectionMetadata(section: string, account = true): Metadata {
  const path = `/account/${section}`;
  const legacy = section === "volunteers" ? "/account/team" : path;
  // Legacy routes retain safe generic metadata and are never advertised in sitemap.
  return account ? pageMetadata(path) : { ...pageMetadata(legacy), alternates: null };
}

export const rootMetadata: Metadata = {
  ...pageMetadata("/account"), metadataBase: new URL(SITE_URL), applicationName: "TribePetra Kids", creator: "TribePetra Kids", publisher: "Petra Church", category: "Children's ministry",
  icons: { icon: "/brand/tpk-logo.jpg", apple: "/brand/tpk-logo.png" },
};

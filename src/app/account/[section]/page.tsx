"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowRight } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";

const configuration: Record<string, { title: string; description: string; endpoint?: string; columns?: Array<[string, string]>; action?: [string, string] }> = {
  children: { title: "Children", description: "Active child records available to your current access level.", endpoint: "/api/v1/children?limit=100", columns: [["firstName", "Child"], ["className", "Class"], ["gender", "Gender"], ["classAssignmentRequired", "Needs Class Assignment"]] },
  guardians: { title: "Guardians", description: "Guardian records for safeguarding and family support.", endpoint: "/api/v1/guardians?limit=100", columns: [["firstName", "Guardian"], ["relationship", "Relationship"], ["primaryPhone", "Phone"], ["authorisedPickup", "Authorised Pickup"]] },
  families: { title: "Families", description: "Households registered at Petra Wuse.", endpoint: "/api/v1/families", columns: [["surname", "Family"], ["familyCode", "Family Code"], ["phone", "Phone"], ["children", "Active Children"]] },
  classrooms: { title: "Classrooms", description: "Classes available to your current assignment.", endpoint: "/api/v1/classes", columns: [["name", "Class"], ["ageLabel", "Age Group"], ["active", "Status"]] },
  classes: { title: "Classes & Curriculum", description: "Current classes and their active configuration.", endpoint: "/api/v1/classes", columns: [["name", "Class"], ["ageLabel", "Age Group"], ["minAge", "Minimum Age"], ["maxAge", "Maximum Age"]] },
  roster: { title: "Team & Roster", description: "Scheduled duties and service assignments.", endpoint: "/api/v1/me/roster", columns: [["assignmentDate", "Date"], ["dutyName", "Duty"], ["className", "Class"], ["status", "Status"]] },
  relations: { title: "Relations & Follow-Up", description: "Follow-up activity is surfaced from the live ministry overview.", action: ["View Ministry Overview", "/account/overview"] },
  reports: { title: "Reports", description: "Open the live overview for current attendance and service indicators.", action: ["View Ministry Overview", "/account/overview"] },
  settings: { title: "Account Settings", description: "Manage your profile and account details.", action: ["Open My Profile", "/account/profile"] },
  "pick-up": { title: "Pick-Up", description: "Use the secure pickup desk to verify a collector and complete release.", action: ["Open Pick-Up Desk", "/pick-up"] },
};
export default function AccountSection({ params }: { params: { section: string } }) {
  const config = configuration[params.section] || { title: "TribePetra Kids", description: "This area is not available." }; const session = readTeacherSession(); const [rows, setRows] = useState<Record<string, unknown>[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (!config.endpoint || !session) return; fetch(`${apiBase}${config.endpoint}`, { headers: authHeaders(session) }).then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || "You do not have access to this area."); setRows(Array.isArray(result.data) ? result.data : result.data?.items || []); }).catch((reason) => setError(reason instanceof Error ? reason.message : "We could not load this data.")); }, [config.endpoint, session]);
  return <section className="directory-page"><header><p className="eyebrow">Petra Wuse</p><h1>{config.title}</h1><p className="intro">{config.description}</p></header>{config.action && <Link className="solid-button" href={config.action[1]}>{config.action[0]} <FiArrowRight /></Link>}{config.endpoint && <section className="panel"><div className="panel-heading"><div><h2>{config.title}</h2><p>{rows.length ? `${rows.length} records` : "No records found."}</p></div></div>{error ? <p className="directory-error">{error}</p> : <div className="table-wrap"><table><thead><tr>{config.columns?.map(([, label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id || index)}>{config.columns?.map(([key]) => <td key={key}>{formatValue(row[key], key)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={config.columns?.length || 1} className="empty">No matching records are available.</td></tr>}</tbody></table></div>}</section>}<style jsx>{`.directory-page h1,.directory-page h2{font-family:Georgia,serif}.directory-page header{margin-bottom:22px}.directory-error{color:#c8452c;font-size:12px}`}</style></section>;
}
function formatValue(value: unknown, key: string): string { if (key === "firstName" && value) return String(value); if (typeof value === "boolean") return value ? "Yes" : "No"; if (value === null || value === undefined || value === "") return "—"; return String(value); }

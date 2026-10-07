"use client";

import Link from "next/link";
import { FiChevronDown, FiChevronRight, FiPhone } from "react-icons/fi";
import "./children-records.css";
import { ClassBadge, GenderBadge } from "./record-badge";

export type ChildRecord = {
  id: number;
  firstName: string;
  lastName: string;
  age?: number;
  gender?: string;
  className?: string;
  guardianId?: number;
  guardianName?: string;
  guardianPhone?: string;
  lastAttended?: string;
  name?: string;
  homeCampus?: string;
};
type Props = { rows: ChildRecord[]; onOpen: (id: number) => void; restricted?:boolean };
const nameOf = (child: ChildRecord) => child.name||`${child.firstName} ${child.lastName}`.trim();
const ageOf = (child: ChildRecord) => child.age == null ? "Age not recorded" : child.age === 0 ? "Under 1 year" : `${child.age} ${child.age === 1 ? "year" : "years"} old`;
const lastSeen = (child: ChildRecord) => {
  if (!child.lastAttended) return "No attendance yet";
  const value = new Date(`${child.lastAttended.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(value.getTime()) ? "Date not recorded" : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(value);
};

function ChildName({ child, onOpen, restricted=false }: { child: ChildRecord; onOpen: Props["onOpen"]; restricted?:boolean }) {
  return <button type="button" className="record-child-name" onClick={() => onOpen(child.id)} aria-label={`View ${nameOf(child)}’s profile`}>
    <span className="record-child-avatar" aria-hidden="true">{`${child.firstName[0] || ""}${child.lastName[0] || ""}`.toUpperCase()}</span>
    <span className="record-child-title"><strong>{nameOf(child)}</strong>{!restricted&&<small>{ageOf(child)}</small>}</span>
  </button>;
}

function GuardianContact({ child,restricted=false }: { child: ChildRecord;restricted?:boolean }) {
  if(restricted)return <div className="record-guardian-contact"><span>{child.guardianName||"Guardian not recorded"}</span></div>;
  return <div className="record-guardian-contact">
    {child.guardianId && child.guardianName ? <Link href={`/account/guardians?guardianId=${child.guardianId}`} onClick={(event) => event.stopPropagation()}>{child.guardianName}</Link> : <span className={child.guardianName ? "" : "record-muted"}>{child.guardianName || "Guardian not recorded"}</span>}
    <small><FiPhone aria-hidden="true" />{child.guardianPhone || "Phone not provided"}</small>
  </div>;
}

export function ChildrenGrid({ rows, onOpen,restricted=false }: Props) {
  return <div className="children-records-grid">
    {rows.map((child) => <article className="child-directory-card" key={child.id}>
      <header><ChildName child={child} onOpen={onOpen} restricted={restricted}/></header>
      {!restricted&&<dl className="record-child-facts"><div><dt>Class</dt><dd><ClassBadge name={child.className} /></dd></div><div><dt>Gender</dt><dd><GenderBadge gender={child.gender} /></dd></div></dl>}
      <section className="record-guardian"><h3>Parent or guardian</h3><GuardianContact child={child} restricted={restricted}/></section>
      <footer>{!restricted&&<div><span>Last attended</span><b>{lastSeen(child)}</b></div>}<button type="button" className="record-profile-action" onClick={() => onOpen(child.id)} aria-label={`Open ${nameOf(child)}’s profile`}>View profile <FiChevronRight aria-hidden="true" /></button></footer>
    </article>)}
  </div>;
}

export function ChildrenList({ rows, onOpen, sort, order, onSort, rowOffset = 0,restricted=false }: Props & { rowOffset?: number; sort: string; order: string; onSort: (field: string) => void }) {
  const heading = (label: string, field: string) => <th scope="col" aria-sort={sort === field ? order === "asc" ? "ascending" : "descending" : "none"}><button type="button" className={`record-sort ${sort === field ? "active" : ""}`} onClick={() => onSort(field)}>{label}<FiChevronDown className={sort === field && order === "desc" ? "descending" : ""} aria-hidden="true" /></button></th>;
  return <div className={`children-records-list ${restricted?"children-records-safe":""}`}><table><caption className="record-sr-only">{restricted?"Children and their parent or guardian names":"Children, their class, guardian contact and last attendance"}</caption><thead><tr><th scope="col">S/N</th>{heading("Child", "name")}{restricted?<th scope="col">Parent or guardian</th>:<>{heading("Class", "class")}{heading("Age", "age")}{heading("Gender", "gender")}{heading("Parent or guardian", "guardian")}{heading("Last attended", "lastAttended")}</>}<th scope="col"><span className="record-sr-only">Profile</span></th></tr></thead><tbody>
    {rows.map((child, index) => <tr key={child.id}>
      <td className="record-list-serial" data-label="S/N">{rowOffset + index + 1}</td>
      <td className="record-list-child"><ChildName child={child} onOpen={onOpen} restricted={restricted}/></td>
      {restricted?<td className="record-list-guardian" data-label="Parent or guardian"><GuardianContact child={child} restricted/></td>:<><td className="record-list-class" data-label="Class"><ClassBadge name={child.className} /></td>
      <td className="record-list-age" data-label="Age">{child.age == null ? "Not recorded" : child.age === 0 ? "Under 1" : child.age}</td>
      <td className="record-list-gender" data-label="Gender"><GenderBadge gender={child.gender} /></td>
      <td className="record-list-guardian" data-label="Parent or guardian"><GuardianContact child={child} /></td>
      <td className="record-list-attendance" data-label="Last attended">{lastSeen(child)}</td></>}
      <td className="record-list-action"><button type="button" className="record-profile-action" onClick={() => onOpen(child.id)} aria-label={`Open ${nameOf(child)}’s profile`}>View <FiChevronRight aria-hidden="true" /></button></td>
    </tr>)}
  </tbody></table></div>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FiArrowLeft, FiCalendar, FiMail, FiPhone, FiSearch, FiUsers, FiX } from "react-icons/fi";
import { apiBase, authHeaders, mediaUrl, readTeacherSession } from "@/lib/session";
import { useProfileDialog } from "./use-profile-dialog";
import "./dashboard-quick-views.css";

function QuickDialog({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  useProfileDialog(close, ".dashboard-quick-dialog");
  return createPortal(<div className="dashboard-quick-backdrop" onMouseDown={close}>
    <section role="dialog" aria-modal="true" aria-label={title} className="dashboard-quick-dialog" onMouseDown={event => event.stopPropagation()}>
      <header><div><small>TRIBEPETRA KIDS</small><h2>{title}</h2></div><button type="button" aria-label={`Close ${title}`} onClick={close}><FiX /></button></header>
      {children}
    </section>
  </div>, document.body);
}

type FoundChild = { id: number; firstName: string; lastName: string; className?: string; age?: number; guardianNames?: string; guardianPhones?: string; authorisedPickupNames?: string };
export function FindChildDialog({ close }: { close: () => void }) {
  const session = useMemo(readTeacherSession, []);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FoundChild[]>([]);
  const [selected, setSelected] = useState<FoundChild | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setItems([]); setError(""); setLoading(Boolean(query.trim()));
    if (!query.trim() || !session) { setLoading(false); return; }
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${apiBase}/api/v1/children?search=${encodeURIComponent(query.trim())}&limit=30`, { headers: authHeaders(session), cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || "We couldn’t search the child records. Please try again.");
        if (!controller.signal.aborted) setItems(Array.isArray(result.data) ? result.data : []);
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Search unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, session]);
  return <QuickDialog title="Find a child" close={close}>
    {selected ? <div className="quick-child-detail"><button className="quick-back" onClick={() => setSelected(null)}><FiArrowLeft />Back to results</button><h3>{selected.firstName} {selected.lastName}</h3><p>{selected.className || "Class not assigned"}{selected.age != null ? ` · Age ${selected.age}` : ""}</p><dl><div><dt>Parent / guardian</dt><dd>{selected.guardianNames || "Not recorded"}</dd></div><div><dt>Contact number</dt><dd>{selected.guardianPhones || "Not recorded"}</dd></div><div><dt>Authorised pickup person</dt><dd>{selected.authorisedPickupNames || "Confirm with the guardian at pickup"}</dd></div></dl></div> : <>
      <p className="quick-intro">Find a child’s class and guardian details without leaving this page.</p>
      <label className="quick-search"><FiSearch /><input autoFocus aria-label="Search child, guardian or phone number" placeholder="Child, guardian or phone number" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <div className="quick-results" aria-live="polite" aria-busy={loading}>
        {error ? <p role="alert" className="quick-error">{error}</p> : loading ? <p className="quick-empty">Searching children…</p> : !query.trim() ? <p className="quick-empty">Enter a name or phone number to get started.</p> : !items.length ? <p className="quick-empty">No children found. Try another name or phone number.</p> : <><small className="quick-count">{items.length === 30 ? "First 30 matches · refine your search for more" : `${items.length} child${items.length === 1 ? "" : "ren"} found`}</small>{items.map(child => <button key={child.id} className="quick-child-result" onClick={() => setSelected(child)}><i>{child.firstName[0]}{child.lastName[0]}</i><span><b>{child.firstName} {child.lastName}</b><small>{child.className || "Class not assigned"}</small><small>{child.guardianNames || "Guardian not recorded"}</small></span><span className="quick-view-label">View details</span></button>)}</>}
      </div>
    </>}
  </QuickDialog>;
}

export type TeacherQuickTarget = { userId: number; name: string; image?: string | null; date?: string; roles?: string[] };
type Contact = { id: number; name: string; email?: string; whatsappNumber?: string; mobileNumber?: string };
export function TeacherQuickView({ teacher, close }: { teacher: TeacherQuickTarget; close: () => void }) {
  const session = useMemo(readTeacherSession, []);
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    if (!session) { setLoading(false); setError("Please sign in to view teacher contact details."); return; }
    setContact(null); setLoading(true); setError("");
    fetch(`${apiBase}/api/v1/team?month=${encodeURIComponent(teacher.date?.slice(0,7) || new Date().toISOString().slice(0,7))}`, { headers: authHeaders(session), signal: controller.signal, cache: "no-store" })
      .then(async response => { const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error?.message || "Teacher contact details are unavailable."); return result.data.members as Contact[]; })
      .then(members => { if (controller.signal.aborted) return; const match = members.find(member => Number(member.id) === Number(teacher.userId)); if (!match) throw new Error("This teacher is not available in your team directory."); setContact(match); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Contact details unavailable."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, teacher.userId, teacher.date]);
  const phone = contact?.whatsappNumber || contact?.mobileNumber;
  const date = teacher.date ? new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${teacher.date}T12:00:00Z`)) : "Selected Sunday";
  return <QuickDialog title="Teacher contact" close={close}><div className="quick-teacher-identity">{teacher.image ? <img src={mediaUrl(teacher.image)} alt="" /> : <i><FiUsers /></i>}<div><h3>{teacher.name}</h3><p>Serving with TribePetra Kids</p></div></div>
    <div className="quick-duty"><small><FiCalendar />{date}</small><b>{teacher.roles?.length ? [...new Set(teacher.roles)].join(" · ") : "No role recorded for this Sunday"}</b></div>
    <dl className="quick-contact" aria-busy={loading}><div><dt><FiPhone />Phone number</dt><dd>{loading ? "Loading…" : phone ? <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}>{phone}</a> : "Not recorded"}</dd></div><div><dt><FiMail />Email address</dt><dd>{loading ? "Loading…" : contact?.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "Not recorded"}</dd></div></dl>{error && <p className="quick-error" role="alert">{error}</p>}
  </QuickDialog>;
}

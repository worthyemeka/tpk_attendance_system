"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiChevronRight, FiDownload, FiEdit3, FiFileText, FiFilter, FiSearch, FiUserCheck, FiUsers, FiX } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";

type Kind = "children" | "guardians" | "families";
type Child = { id:number; firstName:string; lastName:string; classId?:number; className?:string; familySurname?:string; gender?:string; age?:number|null; guardianNames?:string; guardianPhones?:string; authorisedPickupNames?:string; visitType?:string; sundaysPresent?:number; attendanceDates?:string[]; attendancePresentDates?:string[]; dateOfBirth?:string; schoolGrade?:string; active?:boolean };
type Guardian = { id:number; firstName:string; lastName:string; relationship?:string; primaryPhone?:string; childrenCount?:number; childrenNames?:string; authorisedPickupNames?:string; familySurname?:string };
type Family = { id:number; surname:string; familyCode?:string; phone?:string; email?:string; childrenCount?:number; childrenNames?:string; guardianNames?:string; guardianPhones?:string };
type ClassOption = { id:number; name:string };

const copy = {
  children: { title:"Children", description:"View and manage children registered with TribePetra Kids." },
  guardians: { title:"Guardians", description:"Connected household, child and authorised-pickup records for safe handover." },
  families: { title:"Families", description:"Households with more than one active child, grouped together for clarity." },
} as const;

function initials(first = "", last = "") { return `${first[0] || ""}${last[0] || ""}`.toUpperCase() || "TP"; }
function pretty(value?: string | null) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, char => char.toUpperCase()) : "—"; }
function profileComplete(child: Child) { return Boolean(child.dateOfBirth && child.gender && child.guardianNames && child.guardianNames !== "—"); }
function lastAttended(child: Child) { const date = [...(child.attendancePresentDates || [])].sort().at(-1); return date ? new Intl.DateTimeFormat("en-NG", { day:"numeric", month:"short", year:"numeric" }).format(new Date(`${date}T12:00:00`)) : "Not yet attended"; }

export function PeopleDirectory({ kind }: { kind: Kind }) {
  const session = readTeacherSession();
  const [rows, setRows] = useState<Array<Child | Guardian | Family>>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [visitType, setVisitType] = useState("");
  const [classId, setClassId] = useState("");
  const [active, setActive] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Child | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const endpoint = useMemo(() => {
    const search = new URLSearchParams({ limit: "100" });
    if (query) search.set("search", query);
    if (kind === "children") {
      search.set("month", month);
      if (visitType) search.set("visitType", visitType);
      if (classId) search.set("classId", classId);
      if (active) search.set("active", active);
    }
    return `/api/v1/${kind}?${search.toString()}`;
  }, [active, classId, kind, month, query, visitType]);

  async function load() {
    if (!session) return;
    setLoading(true); setError("");
    try {
      const response = await fetch(`${apiBase}${endpoint}`, { headers: authHeaders(session) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load these records.");
      setRows(Array.isArray(result.data) ? result.data : []);
      setTotal(Number(result.meta?.total ?? result.data?.length ?? 0));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not load these records."); }
    finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(() => void load(), query ? 160 : 0); return () => window.clearTimeout(timer); }, [endpoint]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!session || kind !== "children") return;
    void fetch(`${apiBase}/api/v1/classes`, { headers: authHeaders(session) }).then(response => response.json()).then(result => {
      if (result.success && Array.isArray(result.data)) setClasses(result.data);
    }).catch(() => undefined);
  }, [kind, session?.sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function openChild(child: Child) {
    if (!session) return;
    setSelected(child); setDetail(null); setEditing(false);
    try {
      const response = await fetch(`${apiBase}/api/v1/children/${child.id}`, { headers: authHeaders(session) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load this child profile.");
      setDetail(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not load this child profile."); }
  }
  async function saveChild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !session) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      const payload = { firstName: String(form.get("firstName") || "").trim(), lastName: String(form.get("lastName") || "").trim(), dateOfBirth: String(form.get("dateOfBirth") || ""), gender: String(form.get("gender") || "") };
      const response = await fetch(`${apiBase}/api/v1/children/${selected.id}`, { method:"PATCH", headers:{ ...authHeaders(session), "Content-Type":"application/json" }, body:JSON.stringify(payload) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not save this child record.");
      setEditing(false); await load(); await openChild({ ...selected, ...payload });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not save this child record."); }
    finally { setSaving(false); }
  }
  function printProfile() {
    if (!detail || !selected) return;
    const guardians = ((detail.guardians as Array<{ firstName:string; lastName:string; primaryPhone:string }> | undefined) || []).map(item => `${item.firstName} ${item.lastName} · ${item.primaryPhone}`).join("<br>") || "—";
    const win = window.open("", "_blank", "noopener,noreferrer"); if (!win) return;
    win.document.write(`<!doctype html><title>${selected.firstName} ${selected.lastName} · TPK record</title><style>body{font-family:Arial,sans-serif;margin:42px;color:#0b1c3c}h1{font-family:Georgia,serif}dt{font-weight:700;margin-top:16px}dd{margin:4px 0}</style><h1>TribePetra Kids child record</h1><p>${selected.firstName} ${selected.lastName}</p><dl><dt>Class</dt><dd>${selected.className || "—"}</dd><dt>Date of birth</dt><dd>${String(detail.dateOfBirth || "—")}</dd><dt>Gender</dt><dd>${pretty(String(detail.gender || ""))}</dd><dt>Parents / guardians</dt><dd>${guardians}</dd><dt>Authorised pickup</dt><dd>${((detail.authorisedPickups as Array<{ firstName:string; lastName:string; phone:string }> | undefined) || []).map(item => `${item.firstName} ${item.lastName}${item.phone ? ` · ${item.phone}` : ""}`).join("<br>") || "No additional authorised pickup"}</dd></dl><script>window.print()</script>`); win.document.close();
  }

  const children = rows as Child[]; const guardians = rows as Guardian[]; const families = rows as Family[];
  const complete = children.filter(profileComplete).length;
  const activeCount = children.filter(child => child.active !== false).length;
  const hasFilters = Boolean(query || classId || visitType || active || month !== new Date().toISOString().slice(0, 7));
  function resetFilters() { setQuery(""); setClassId(""); setVisitType(""); setActive(""); setMonth(new Date().toISOString().slice(0, 7)); }
  return <section className="people-directory">
    <header className="directory-header"><div><p className="eyebrow">People</p><h1>{copy[kind].title}</h1><p className="intro">{copy[kind].description}</p></div>{kind === "children" && <Link href="/account/check-in/assisted" className="add-child">+<span>Add Child</span></Link>}</header>
    {kind === "children" && <section className="directory-metrics" aria-label="Child record summary"><Metric icon={<FiUsers />} value={total || children.length} label="Registered children" tone="green" /><Metric icon={<FiUserCheck />} value={activeCount} label="Active" tone="blue" /><Metric icon={<FiFileText />} value={complete} label="Complete profiles" tone="amber" /><Metric icon={<FiAlertTriangle />} value={Math.max(0, children.length - complete)} label="Need information" tone="red" /></section>}
    <section className="directory-panel"><div className="directory-tools"><label className="search"><FiSearch /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={kind === "children" ? "Search child, guardian or phone number…" : `Search ${kind.slice(0, -1)}…`} /></label>{kind === "children" && <><select aria-label="Filter by class" value={classId} onChange={event => setClassId(event.target.value)}><option value="">All classes</option>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select aria-label="Filter by visit type" value={visitType} onChange={event => setVisitType(event.target.value)}><option value="">All visits</option><option value="FIRST_TIMER">First-timer</option><option value="RETURNING">Returning</option></select><select aria-label="Filter by status" value={active} onChange={event => setActive(event.target.value)}><option value="">All statuses</option><option value="1">Active</option><option value="0">Inactive</option></select><label className="month-filter"><span>Attendance month</span><input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label><button className="filter-button" type="button" onClick={resetFilters}><FiFilter />{hasFilters ? "Clear filters" : "More filters"}</button></>}</div>
      <div className="records-toolbar"><p>{loading ? "Loading live records…" : `${total || rows.length} ${kind === "children" ? "children" : `${kind.slice(0, -1)} records`}`}</p>{kind === "children" && <button className="export-button" onClick={() => window.print()}><FiDownload />Export</button>}</div>
      {error ? <p className="directory-error">{error}</p> : kind === "children" ? <ChildrenTable rows={children} onView={openChild} /> : kind === "guardians" ? <GuardiansTable rows={guardians} /> : <FamiliesTable rows={families} />}
      {kind === "children" && !loading && <p className="showing">Showing {rows.length ? `1–${rows.length}` : "0"} of {total || rows.length} children</p>}
    </section>
    {selected && <ChildModal child={selected} detail={detail} editing={editing} saving={saving} canEdit={session?.accessLevel === "TPK_SUPER_ADMIN"} onClose={() => setSelected(null)} onEdit={() => setEditing(true)} onCancel={() => setEditing(false)} onSave={saveChild} onPrint={printProfile} />}
    <style jsx>{`
      .people-directory{max-width:1540px}.people-directory h1,.people-directory h2{font-family:var(--font-display),Georgia,serif}.directory-header{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;margin:4px 0 18px}.directory-header h1{margin:7px 0 5px;font-size:40px;letter-spacing:-1.35px}.directory-header .intro{margin:0;color:#647088;font-size:17px;letter-spacing:-.3px}.add-child{height:50px;min-width:142px;border-radius:9px;background:#ff5d34;color:#fff;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:11px;font-size:21px;box-shadow:0 6px 14px #ef583420}.add-child span{font:800 12px var(--font-body)}.directory-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;margin:14px 0 25px}.metric{min-height:132px;border-radius:10px;padding:18px 22px;background:#fff;border:1px solid #eee8e0;display:grid;align-content:center;gap:7px}.metric i{width:39px;height:39px;border-radius:11px;display:grid;place-items:center;font-style:normal;font-size:22px}.metric strong{font:700 34px/1 var(--font-body);letter-spacing:-1.5px}.metric span{font-size:13px;color:#26324a;font-weight:700}.metric.green{background:linear-gradient(135deg,#effaf4,#fcfcfa)}.metric.green i{background:#dff6e8;color:#148b54}.metric.blue{background:linear-gradient(135deg,#eef7ff,#fdfdfc)}.metric.blue i{background:#e0f1ff;color:#267ac6}.metric.amber{background:linear-gradient(135deg,#fff7e6,#fdfcf9)}.metric.amber i{background:#fff0cd;color:#d98108}.metric.red{background:linear-gradient(135deg,#fff0ec,#fdfcfb)}.metric.red i{background:#fee0d7;color:#e5502b}.directory-panel{border-radius:10px;background:#fffdfa;border:1px solid #eae4dc;padding:20px 24px 18px;box-shadow:0 3px 14px #25190705}.directory-tools{display:grid;grid-template-columns:minmax(270px,1.6fr) repeat(3,minmax(125px,.58fr)) minmax(150px,.72fr) auto;gap:12px;align-items:end;margin-bottom:20px}.search{height:45px;display:flex;align-items:center;gap:10px;padding:0 14px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#71809a}.search svg{font-size:18px;flex:none}.search input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:#182a4b;font:600 12px var(--font-body)}.directory-tools select,.month-filter input{height:45px;width:100%;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#263550;padding:0 12px;font:700 11px var(--font-body)}.month-filter{display:grid;gap:4px;color:#647088;font:800 9px var(--font-body)}.filter-button,.export-button{height:45px;border:1px solid #dbe0e9;border-radius:8px;background:#fff;color:#2d3a52;padding:0 14px;display:inline-flex;align-items:center;justify-content:center;gap:9px;font:800 11px var(--font-body);white-space:nowrap;cursor:pointer}.filter-button:hover,.export-button:hover{border-color:#f18b72;background:#fff7f3;color:#d84a2d}.records-toolbar{display:flex;align-items:center;justify-content:space-between;margin:2px 0 12px}.records-toolbar p{margin:0;color:#36415a;font-size:14px;font-weight:800}.export-button{height:38px}.directory-error{margin:0;padding:14px;border-radius:8px;background:#fff0eb;color:#c8452c;font-size:12px}.table-wrap{overflow:auto;border:1px solid #eee8e1;border-radius:9px}.records{width:100%;min-width:900px;border-collapse:collapse;background:#fffdfa}.records th{padding:12px;text-align:left;background:#f8f7f4;color:#6f7990;font-size:9px;font-weight:900;letter-spacing:.05em;text-transform:uppercase;white-space:nowrap}.records td{padding:10px 12px;border-top:1px solid #eee8e1;vertical-align:middle;color:#42506a;font-size:12px;white-space:nowrap}.records tr:hover td{background:#fffaf7}.child-cell{display:flex;align-items:center;gap:10px;min-width:180px}.monogram{width:36px;height:36px;display:grid;place-items:center;flex:none;border-radius:50%;background:#e7f0fb;color:#205f9f;font-size:10px;font-style:normal;font-weight:900}.child-cell b,.family-cell b{display:block;color:#1c273d;font-size:12px;white-space:nowrap}.child-cell small,.family-cell small,.guardian-block small{display:block;margin-top:3px;color:#728099;font-size:10px;white-space:nowrap}.guardian-block{min-width:160px}.guardian-block b{color:#26334a;font-size:11px}.profile-chip,.status-chip{display:inline-flex;align-items:center;gap:5px;border-radius:99px;padding:6px 9px;font-size:10px;font-weight:800}.profile-chip.complete,.status-chip{background:#e9f8ee;color:#12824e}.profile-chip.needs{background:#fff1dc;color:#c06c00}.profile-chip svg,.status-chip svg{font-size:13px}.row-action{width:34px;height:34px;border:0;border-radius:7px;background:transparent;color:#54637b;display:grid;place-items:center;cursor:pointer}.row-action:hover{background:#fff0eb;color:#e5512e}.empty{text-align:center!important;color:#738099!important;padding:30px!important}.showing{margin:15px 0 0;color:#66738b;font-size:11px}@media(max-width:1210px){.directory-tools{grid-template-columns:minmax(240px,1fr) repeat(3,minmax(115px,.6fr))}.month-filter{grid-column:2}.filter-button{grid-column:3/5}}@media(max-width:850px){.directory-metrics{grid-template-columns:repeat(2,1fr)}.directory-tools{grid-template-columns:1fr 1fr}.search{grid-column:1/-1}.month-filter{grid-column:auto}.filter-button{grid-column:auto}.directory-header h1{font-size:35px}}@media(max-width:570px){.people-directory{max-width:100%}.directory-header{display:grid}.add-child{width:100%}.directory-metrics{gap:10px}.metric{min-height:108px;padding:14px}.metric strong{font-size:28px}.metric span{font-size:11px}.directory-panel{padding:14px}.directory-tools{grid-template-columns:1fr}.search,.month-filter,.filter-button{grid-column:auto}.filter-button{width:100%}}
    `}</style>
  </section>;
}

function Metric({ icon, value, label, tone }: { icon:React.ReactNode; value:number; label:string; tone:string }) { return <article className={`metric ${tone}`}><i>{icon}</i><strong>{value}</strong><span>{label}</span></article>; }
function ChildrenTable({ rows, onView }: { rows: Child[]; onView: (child:Child) => void }) { return <div className="table-wrap"><table className="records"><thead><tr><th>#</th><th>Child</th><th>Class</th><th>Age</th><th>Guardian</th><th>Profile</th><th>Last attended</th><th>Status</th><th aria-label="Actions" /></tr></thead><tbody>{rows.map((row,index) => <tr key={row.id}><td>{index + 1}</td><td><div className="child-cell"><i className="monogram">{initials(row.firstName,row.lastName)}</i><span><b>{row.firstName} {row.lastName}</b><small>{row.gender ? pretty(row.gender) : "Gender not recorded"}</small></span></div></td><td>{row.className || "Assigned by age"}</td><td>{row.age ?? "—"}</td><td><div className="guardian-block"><b>{row.guardianNames || "Not recorded"}</b><small>{row.guardianPhones || "Phone unavailable"}</small></div></td><td><span className={`profile-chip ${profileComplete(row) ? "complete" : "needs"}`}>{profileComplete(row) ? <FiCheckCircle /> : <FiAlertTriangle />}{profileComplete(row) ? "Complete" : "Needs info"}</span></td><td>{lastAttended(row)}</td><td><span className="status-chip"><FiCheckCircle />{row.active === false ? "Inactive" : "Active"}</span></td><td><button className="row-action" aria-label={`View ${row.firstName} ${row.lastName}`} onClick={() => onView(row)}><FiChevronRight /></button></td></tr>)}{!rows.length && <tr><td colSpan={9} className="empty">No child records match these filters.</td></tr>}</tbody></table></div>; }
function GuardiansTable({ rows }: { rows: Guardian[] }) { return <div className="table-wrap"><table className="records"><thead><tr><th>#</th><th>Guardian</th><th>Relationship</th><th>Phone</th><th>Child / children</th><th>Children</th><th>Authorised pickup people</th></tr></thead><tbody>{rows.map((row,index) => <tr key={row.id}><td>{index+1}</td><td><div className="child-cell"><i className="monogram">{initials(row.firstName,row.lastName)}</i><span><b>{row.firstName} {row.lastName}</b><small>{row.familySurname || "Family record"}</small></span></div></td><td>{row.relationship || "—"}</td><td>{row.primaryPhone || "—"}</td><td className="pickup-note">{row.childrenNames || "—"}</td><td><b>{row.childrenCount || 0}</b></td><td className="pickup-note">{row.authorisedPickupNames || "No additional authorised pickup"}</td></tr>)}{!rows.length && <tr><td colSpan={7} className="empty">No guardian records match this search.</td></tr>}</tbody></table></div>; }
function FamiliesTable({ rows }: { rows: Family[] }) { return <div className="table-wrap"><table className="records"><thead><tr><th>#</th><th>Family</th><th>Children</th><th>Parents / guardians</th><th>Contact</th><th>Family code</th></tr></thead><tbody>{rows.map((row,index) => <tr key={row.id}><td>{index+1}</td><td><div className="family-cell"><b>{row.surname} family</b><small>{row.childrenCount || 0} registered children</small></div></td><td className="pickup-note">{row.childrenNames || "—"}</td><td className="pickup-note">{row.guardianNames || "—"}</td><td><b>{row.guardianPhones || row.phone || "—"}</b><small className="subtle">{row.email || ""}</small></td><td>{row.familyCode || "—"}</td></tr>)}{!rows.length && <tr><td colSpan={6} className="empty">No multi-child family households match this search yet.</td></tr>}</tbody></table></div>; }

function ChildModal({ child, detail, editing, saving, canEdit, onClose, onEdit, onCancel, onSave, onPrint }: { child:Child; detail:Record<string, unknown>|null; editing:boolean; saving:boolean; canEdit:boolean; onClose:()=>void; onEdit:()=>void; onCancel:()=>void; onSave:(event:FormEvent<HTMLFormElement>)=>void; onPrint:()=>void }) {
  const guardians = (detail?.guardians as Array<{ firstName:string; lastName:string; primaryPhone:string; relationship?:string }> | undefined) || [];
  const pickups = (detail?.authorisedPickups as Array<{ firstName:string; lastName:string; phone?:string; relationship?:string }> | undefined) || [];
  return <div className="modal-backdrop" role="presentation"><section className="child-modal" role="dialog" aria-modal="true" aria-label="Child record"><button className="close" onClick={onClose}><FiX /></button><p className="eyebrow">Child record</p><h2>{child.firstName} {child.lastName}</h2>{editing ? <form onSubmit={onSave} className="edit-form"><label>First name<input required name="firstName" defaultValue={String(detail?.firstName || child.firstName)} /></label><label>Last name<input required name="lastName" defaultValue={String(detail?.lastName || child.lastName)} /></label><label>Date of birth<input name="dateOfBirth" type="date" defaultValue={String(detail?.dateOfBirth || child.dateOfBirth || "")} /></label><label>Gender<select required name="gender" defaultValue={String(detail?.gender === "MALE" || detail?.gender === "FEMALE" ? detail.gender : child.gender === "MALE" || child.gender === "FEMALE" ? child.gender : "")}><option value="">Select gender</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select></label><div><button className="outline-button" type="button" onClick={onCancel}>Cancel</button><button className="solid-button" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div></form> : <><div className="record-grid"><p><small>Class</small><b>{String(detail?.className || child.className || "Assigned by age")}</b></p><p><small>Age</small><b>{String(detail?.age ?? child.age ?? "—")}</b></p><p><small>Gender</small><b>{pretty(String(detail?.gender || child.gender || ""))}</b></p><p><small>Visit</small><b>{child.visitType === "FIRST_TIMER" ? "First-timer" : "Returning"}</b></p></div><section><h3>Parents / guardians</h3>{guardians.length ? guardians.map(item => <p className="contact" key={`${item.firstName}${item.lastName}`}><b>{item.firstName} {item.lastName}</b><span>{item.relationship || "Guardian"} · {item.primaryPhone || "Phone unavailable"}</span></p>) : <p className="muted">Loading linked contacts…</p>}</section><section><h3>Additional authorised pickup</h3>{pickups.length ? pickups.map(item => <p className="contact" key={`${item.firstName}${item.lastName}`}><b>{item.firstName} {item.lastName}</b><span>{item.relationship || "Authorised person"}{item.phone ? ` · ${item.phone}` : ""}</span></p>) : <p className="muted">No additional authorised pickup person recorded.</p>}</section><div className="modal-actions">{canEdit && <button className="outline-button" onClick={onEdit}><FiEdit3 /> Edit details</button>}<button className="solid-button" onClick={onPrint}><FiDownload /> Print / Save PDF</button></div></>}</section><style jsx>{`.modal-backdrop{position:fixed;z-index:80;inset:0;display:grid;place-items:center;padding:20px;background:#07173080}.child-modal{position:relative;width:min(100%,620px);max-height:90vh;overflow:auto;padding:28px;border-radius:14px;background:#fffdfa;box-shadow:0 20px 70px #07173055}.child-modal h2,.child-modal h3{font-family:var(--font-display),Georgia,serif}.child-modal h2{margin:4px 0 20px;font-size:32px}.child-modal h3{margin:22px 0 8px;font-size:19px}.close{position:absolute;right:14px;top:14px;border:0;background:transparent;font-size:22px;color:#61708a;cursor:pointer}.record-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.record-grid p{margin:0;padding:10px;border-radius:8px;background:#f7f2eb}.record-grid small,.record-grid b{display:block}.record-grid small{color:var(--muted);font-size:9px;text-transform:uppercase}.record-grid b{margin-top:4px;font-size:12px}.contact{display:grid;gap:3px;margin:7px 0;padding:9px 0;border-bottom:1px solid var(--line);font-size:12px}.contact span,.muted{color:var(--muted);font-size:11px}.modal-actions,.edit-form>div{display:flex;gap:10px;margin-top:24px}.modal-actions button,.edit-form button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:40px}.edit-form{display:grid;grid-template-columns:1fr 1fr;gap:12px}.edit-form label{display:grid;gap:6px;font-size:11px;font-weight:800}.edit-form input,.edit-form select{height:40px;border:1px solid var(--line);border-radius:7px;padding:0 10px;background:#fff;font:13px var(--font-body)}.edit-form>div{grid-column:1/-1}@media(max-width:540px){.record-grid,.edit-form{grid-template-columns:1fr 1fr}.modal-actions{display:grid}.modal-actions button{width:100%}}`}</style></div>;
}

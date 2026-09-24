"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { FiCheckCircle, FiClock, FiPlus, FiShield } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";

type Teacher = { id: number; name: string };
type Duty = { id: number; name: string; code: string; requiresClass: boolean };
type Service = { id: number; name: string; serviceDate: string; serviceType: string; isOpen: boolean };
type ClassRoom = { id: number; name: string };
type Assignment = { id: number; userId: number; assignmentDate: string; serviceSessionId: number; classId?: number | null; status: string; dutyName: string; dutyCode: string; className?: string | null; teacherName: string; serviceName?: string | null };
type Management = { teachers: Teacher[]; duties: Duty[]; sessions: Service[]; classes: ClassRoom[]; assignments: Assignment[] };

const emptyManagement: Management = { teachers: [], duties: [], sessions: [], classes: [], assignments: [] };

export default function RosterPage() {
  const session = readTeacherSession();
  const superAdmin = session?.accessLevel === "TPK_SUPER_ADMIN";
  const [management, setManagement] = useState<Management>(emptyManagement);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [selection, setSelection] = useState({ userId: "", dutyTypeId: "", serviceSessionId: "", classId: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [updatingServiceId, setUpdatingServiceId] = useState<number | null>(null);
  const [sundayDate, setSundayDate] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    if (!session) return;
    setLoading(true); setError("");
    try {
      const endpoint = superAdmin ? "/api/v1/roster/management" : "/api/v1/me/roster";
      const response = await fetch(`${apiBase}${endpoint}`, { headers: authHeaders(session) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load the Sunday roster.");
      if (superAdmin) {
        const data = result.data as Management;
        setManagement(data);
        setSelection((current) => ({ ...current, serviceSessionId: current.serviceSessionId || String(data.sessions.find((item) => item.isOpen)?.id || data.sessions[0]?.id || "") }));
      } else setMyAssignments(result.data || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not load the Sunday roster."); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const today = new Date(); const days = (7 - today.getDay()) % 7; today.setDate(today.getDate() + days); setSundayDate(today.toISOString().slice(0, 10)); }, []);

  const selectedDuty = useMemo(() => management.duties.find((item) => item.id === Number(selection.dutyTypeId)), [management.duties, selection.dutyTypeId]);
  const selectedService = useMemo(() => management.sessions.find((item) => item.id === Number(selection.serviceSessionId)), [management.sessions, selection.serviceSessionId]);
  const headOfService = useMemo(() => management.assignments.filter((item) => item.dutyCode === "HEAD_OF_SERVICE" && item.status !== "CANCELLED" && item.status !== "REPLACED" && item.status !== "ABSENT"), [management.assignments]);

  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) return;
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/v1/roster/assignments`, { method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify({ userId: Number(selection.userId), dutyTypeId: Number(selection.dutyTypeId), serviceSessionId: Number(selection.serviceSessionId), classId: selection.classId ? Number(selection.classId) : null }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not save this roster assignment.");
      setMessage(`${result.data.dutyName} assigned. The teacher can now see it in My Roster.`);
      setSelection((current) => ({ ...current, dutyTypeId: "", classId: "" }));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not save this roster assignment."); }
    finally { setSaving(false); }
  }

  async function prepareSunday() {
    if (!session) return;
    setPreparing(true); setError(""); setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/v1/service-sessions/prepare-sunday`, { method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify({ serviceDate: sundayDate }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not prepare Sunday services.");
      setMessage(`First and Second Service are ready for ${result.data.serviceDate}. Assign the Head of Service below.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not prepare Sunday services."); }
    finally { setPreparing(false); }
  }

  async function setParentCheckIn(service: Service, isOpen: boolean) {
    if (!session) return;
    setUpdatingServiceId(service.id); setError(""); setMessage("");
    try {
      const response = await fetch(`${apiBase}/api/v1/service-sessions/${service.id}`, { method: "PATCH", headers: { ...authHeaders(session), "Content-Type": "application/json" }, body: JSON.stringify({ isOpen }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not update parent check-in.");
      setMessage(`${service.name} parent check-in is now ${isOpen ? "open" : "closed"}.`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We could not update parent check-in."); }
    finally { setUpdatingServiceId(null); }
  }

  if (!superAdmin) return <section className="roster-page"><header><p className="eyebrow">Sunday</p><h1>My Roster</h1><p className="intro">Your confirmed TPK Teacher assignments.</p></header>{error && <p className="roster-error">{error}</p>}<RosterTable assignments={myAssignments} loading={loading} own /></section>;

  return <section className="roster-page"><header><p className="eyebrow">Ministry management</p><h1>Team &amp; Roster</h1><p className="intro">Assign active TPK Teachers to Sunday duties. Access level remains an internal permission, managed separately in Team.</p></header>
    <section className="panel head-service-panel"><div><span><FiShield /></span><div><h2>Head of Service</h2><p>The assigned teacher approves parent check-ins and releases pickup codes for that service.</p></div></div><div className="head-service-list">{headOfService.length ? headOfService.map((item) => <p key={item.id}><b>{item.serviceName || item.assignmentDate}</b><span>{item.teacherName}</span></p>) : <p className="roster-empty">No Head of Service is assigned yet.</p>}</div></section>
    <section className="panel roster-form-panel"><div className="panel-heading"><div><h2>Prepare Sunday</h2><p>Create the First and Second Service roster slots before assigning the team. Parent check-in stays closed until you intentionally open a service.</p></div><FiClock /></div><div className="prepare-sunday"><label>Sunday date<input type="date" value={sundayDate} onChange={(event) => setSundayDate(event.target.value)} /></label><button className="outline-button" disabled={preparing || !sundayDate} onClick={prepareSunday} type="button">{preparing ? "Preparing…" : "Prepare Sunday"}</button></div>{management.sessions.length > 0 && <div className="service-controls">{management.sessions.map((service) => <div key={service.id}><span><b>{service.name}</b><small>{service.serviceDate}</small></span><button className={service.isOpen ? "outline-button" : "solid-button"} disabled={updatingServiceId === service.id} onClick={() => void setParentCheckIn(service, !service.isOpen)} type="button">{updatingServiceId === service.id ? "Updating…" : service.isOpen ? "Close parent check-in" : "Open parent check-in"}</button></div>)}</div>}</section><section className="panel roster-form-panel"><div className="panel-heading"><div><h2>Assign a Sunday Role</h2><p>Choose a teacher, service, and duty. Only one Head of Service can be assigned to a service.</p></div><FiPlus /></div><form className="roster-form" onSubmit={assign}><label>TPK Teacher<select required value={selection.userId} onChange={(event) => setSelection({ ...selection, userId: event.target.value })}><option value="">Choose teacher</option>{management.teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}</select></label><label>Service<select required value={selection.serviceSessionId} onChange={(event) => setSelection({ ...selection, serviceSessionId: event.target.value })}><option value="">Choose service</option>{management.sessions.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.serviceDate}</option>)}</select></label><label>Duty<select required value={selection.dutyTypeId} onChange={(event) => setSelection({ ...selection, dutyTypeId: event.target.value })}><option value="">Choose duty</option>{management.duties.map((duty) => <option key={duty.id} value={duty.id}>{duty.name}</option>)}</select></label>{selectedDuty?.requiresClass && <label>Class<select required value={selection.classId} onChange={(event) => setSelection({ ...selection, classId: event.target.value })}><option value="">Choose class</option>{management.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<div className="roster-date"><small>Assignment date</small><b>{selectedService?.serviceDate || "Choose a service"}</b></div><button className="solid-button" disabled={saving || !selection.userId || !selection.dutyTypeId || !selection.serviceSessionId || Boolean(selectedDuty?.requiresClass && !selection.classId)} type="submit">{saving ? "Assigning…" : "Assign role"}</button></form>{error && <p className="roster-error">{error}</p>}{message && <p className="roster-message"><FiCheckCircle />{message}</p>}</section>
    <section className="panel"><div className="panel-heading"><div><h2>Scheduled Team</h2><p>{loading ? "Loading roster…" : `${management.assignments.length} active assignment${management.assignments.length === 1 ? "" : "s"}`}</p></div><FiClock /></div><RosterTable assignments={management.assignments} loading={loading} /></section>
    <style jsx>{`.roster-page h1,.roster-page h2{font-family:var(--font-display),Georgia,serif}.roster-page header{margin-bottom:22px}.head-service-panel{display:flex;justify-content:space-between;gap:24px;margin-bottom:18px;background:#fffaf5;border-color:#f0d4c5}.head-service-panel>div:first-child{display:flex;gap:12px}.head-service-panel>div:first-child>span{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#fff0e8;color:var(--orange);font-size:19px}.head-service-panel h2{margin:0;font-size:23px}.head-service-panel p{margin:4px 0 0;color:var(--muted);font-size:12px;line-height:1.5}.head-service-list{min-width:230px;display:grid;gap:6px}.head-service-list p{display:flex;justify-content:space-between;gap:15px;border-top:1px solid #f0e4dc;padding-top:7px}.head-service-list span{font-weight:800;color:#253b60}.roster-form-panel{margin-bottom:18px}.roster-form-panel>.panel-heading>svg{font-size:21px;color:var(--orange)}.prepare-sunday{display:flex;align-items:end;gap:12px}.prepare-sunday label{display:grid;gap:6px;color:#5d574f;font-size:11px;font-weight:800}.prepare-sunday input{height:42px;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:#fffdfa;font:13px var(--font-body)}.prepare-sunday button{height:42px}.service-controls{display:grid;gap:8px;margin-top:17px;border-top:1px solid var(--line);padding-top:14px}.service-controls>div{display:flex;justify-content:space-between;align-items:center;gap:14px}.service-controls span{display:grid;gap:2px;font-size:12px}.service-controls small{color:var(--muted)}.service-controls button{height:38px;font-size:12px}.roster-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px;align-items:end}.roster-form label{display:grid;gap:6px;color:#5d574f;font-size:11px;font-weight:800}.roster-form select{height:42px;width:100%;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:#fffdfa;font:13px var(--font-body)}.roster-date{display:grid;gap:5px;height:42px;border:1px dashed #d8cec1;border-radius:8px;padding:6px 10px;background:#fbf8f2}.roster-date small{color:var(--muted);font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.roster-date b{font-size:11px}.roster-form .solid-button{height:42px;justify-content:center}.roster-error,.roster-message{display:flex;align-items:center;gap:7px;margin:13px 0 0;font-size:12px}.roster-error{color:#c8452c}.roster-message{color:#087757}.roster-empty{margin:0!important}.roster-page :global(.table-wrap){overflow:auto}.roster-page :global(table){width:100%;min-width:620px;border-collapse:collapse}.roster-page :global(th){padding:7px 6px 11px;color:#73798a;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.6px}.roster-page :global(td){padding:10px 6px;border-top:1px solid var(--line);color:#273046;font-size:12px}.status{display:inline-flex;border-radius:99px;padding:4px 7px;background:#edf5ef;color:#087757;font-size:10px;font-weight:800}.status.ASSIGNED{background:#fff2d8;color:#9a6400}.status.ABSENT,.status.CANCELLED{background:#fff0ed;color:#be4029}@media(max-width:760px){.head-service-panel{display:grid}.head-service-list{min-width:0}.prepare-sunday,.roster-form{display:grid;grid-template-columns:1fr}.prepare-sunday button,.roster-form .solid-button,.service-controls button{width:100%}.service-controls>div{align-items:stretch;display:grid;grid-template-columns:1fr}}`}</style>
  </section>;
}

function RosterTable({ assignments, loading, own = false }: { assignments: Assignment[]; loading: boolean; own?: boolean }) {
  return <div className="table-wrap"><table><thead><tr>{!own && <th>Teacher</th>}<th>Service</th><th>Date</th><th>Duty</th><th>Class</th><th>Status</th></tr></thead><tbody>{assignments.map((item) => <tr key={item.id}>{!own && <td><b>{item.teacherName}</b></td>}<td>{item.serviceName || "Sunday service"}</td><td>{item.assignmentDate}</td><td><b>{item.dutyName}</b></td><td>{item.className || "—"}</td><td><span className={`status ${item.status}`}>{item.status.replaceAll("_", " ")}</span></td></tr>)}{!assignments.length && <tr><td className="empty" colSpan={own ? 5 : 6}>{loading ? "Loading roster…" : "No roster assignments are scheduled yet."}</td></tr>}</tbody></table></div>;
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { FiCalendar, FiCheckCircle, FiShield } from "react-icons/fi";
import { AppSelect } from "./app-dropdown";
import { teacherAttendanceRequest } from "./teacher-attendance-workspace";
import { parseCampusTime } from "@/lib/campus-time";
import "./teacher-attendance.css";

type Wednesday = { id: number; startsAt: string; endsAt: string; checkedInAt: string | null; reason: string | null; canConfirm: boolean; canExplain: boolean };
type MyWednesday = { services: Wednesday[]; serverTime: string };
const label = (stamp: string) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(parseCampusTime(stamp));

export function MdwkAttendanceCard() {
  const [data, setData] = useState<MyWednesday | null>(null);
  const [selected, setSelected] = useState(0);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [offset, setOffset] = useState(0);
  const [clock, setClock] = useState(Date.now());
  const load = useCallback(async () => {
    try {
      const response: MyWednesday = await teacherAttendanceRequest("/my-mdwk");
      setData(response);setError("");
      setOffset(parseCampusTime(response.serverTime).getTime() - Date.now());
    } catch (e) { setError(e instanceof Error ? e.message : "Wednesday attendance could not be loaded."); }
  }, []);
  useEffect(() => { void load();const timer = window.setInterval(() => void load(), 30_000);const clockTimer=window.setInterval(()=>setClock(Date.now()),1000);return () => {window.clearInterval(timer);window.clearInterval(clockTimer);}; }, [load]);
  const today = data?.serverTime.slice(0, 10);
  const current = data?.services.find(s => s.startsAt.slice(0, 10) === today);
  const missed = data?.services.filter(s => s.canExplain) || [];
  const absence = missed.find(s => Number(s.id) === selected) || missed[0];
  useEffect(() => {setReason(absence?.reason || "");}, [absence?.id, absence?.reason]);
  async function save(path: string, method: string, body: unknown, message: string) {
    setBusy(true);setError("");setNotice("");
    try {await teacherAttendanceRequest(path, method, body);setNotice(message);await load();}
    catch (e) {setError(e instanceof Error ? e.message : "Your update could not be saved.");}
    finally {setBusy(false);}
  }
  if (!data) return error ? <section className="panel mdwk-attendance-card"><h2>Wednesday attendance</h2><p role="alert">{error}</p><button className="outline-button" onClick={() => void load()}>Retry</button></section> : null;
  if (!current && !missed.length) return null;
  const open = current?.canConfirm && clock + offset < parseCampusTime(current.endsAt).getTime();
  return <section className="panel mdwk-attendance-card">
    <header><span className="mdwk-calendar"><FiCalendar /></span><div><p className="eyebrow">Wednesday · MDWK</p><h2>{current?.checkedInAt ? "You’re marked present" : open ? "Did you attend MDWK today?" : "Wednesday attendance"}</h2><p>{current ? label(current.startsAt) : "Please add a reason for any missed Wednesday service."}</p></div></header>
    {current?.checkedInAt ? <p className="mdwk-success"><FiCheckCircle />Your Wednesday attendance is confirmed.</p> : open ? <div className="mdwk-confirm"><p>Confirm that you attended before 9pm Lagos time. No QR or security question is needed.</p><button className="solid-button" disabled={busy} onClick={() => void save(`/services/${current!.id}/confirm`, "POST", { attended: true }, "Your Wednesday attendance is confirmed.")}>{busy ? "Saving…" : "I attended MDWK"}</button></div> : current && <p>Wednesday confirmation has closed. If you missed service, add your private reason below.</p>}
    {absence && <form onSubmit={e => {e.preventDefault();void save(`/services/${absence.id}/absence-reason`, "PUT", { reason }, "Your private reason has been saved.");}}>
      {missed.length > 1 && <label>Missed Wednesday<AppSelect value={absence.id} onChange={e => setSelected(Number(e.target.value))}>{missed.map(s => <option key={s.id} value={s.id}>{label(s.startsAt)}</option>)}</AppSelect></label>}
      <label>Why couldn’t you attend on {label(absence.startsAt)}?<textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} minLength={2} maxLength={4000} required placeholder="Leave a short explanation for the welfare team" /></label>
      <p className="mdwk-privacy"><FiShield />Only you, Super Admins and Teachers Welfare can see your reason. It is not shown to the rest of the team.</p>
      <button className="outline-button" disabled={busy || reason.trim().length < 2}>{busy ? "Saving…" : "Save private reason"}</button>
    </form>}
    {notice && <p role="status" className="mdwk-success">{notice}</p>}{error && <p className="teacher-attendance-error" role="alert">{error}</p>}
  </section>;
}

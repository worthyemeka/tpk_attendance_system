"use client";

import { useMemo, useState } from "react";
import { FiCalendar, FiCheckCircle, FiClock, FiMessageCircle, FiUsers } from "react-icons/fi";
import { AppSelect } from "./app-dropdown";
import { MonthPicker } from "./month-picker";
import { groupFollowupHistory, historyEventLabel, type FollowupHistoryEntry } from "@/lib/followup-history";
import { parseCampusTime } from "@/lib/campus-time";
import "./followup-history.css";

const dayLabel = (value: string) => value ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "Date not recorded";
const timeLabel = (value: string) => {
  const date = parseCampusTime(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }).format(date);
};

const isoTime = (value: string) => { const date = parseCampusTime(value); return Number.isNaN(date.getTime()) ? undefined : date.toISOString(); };

export function FollowupHistory({ entries }: { entries: FollowupHistoryEntry[] }) {
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const allGroups = useMemo(() => groupFollowupHistory(entries), [entries]);
  const monthGroups = useMemo(() => groupFollowupHistory(entries, month), [entries, month]);
  const groups = useMemo(() => groupFollowupHistory(entries, month, day), [entries, month, day]);
  const selectedMonth = month || allGroups.find(group => group.date)?.date.slice(0, 7) || new Date().toISOString().slice(0, 7);
  const count = groups.reduce((total, group) => total + group.items.length, 0);
  return <section className="followup-history-view" aria-label="Follow-up history">
    <div className="followup-history-heading"><div><h3>Follow-up history</h3><p>Every conversation and next step, newest first.</p></div><span aria-live="polite">{count} {count === 1 ? "update" : "updates"}</span></div>
    <div className="followup-history-filters">
      <label><span>Month</span><MonthPicker ariaLabel="Choose follow-up history month" displayLabel={month ? undefined : "All months"} value={new Date(`${selectedMonth}-01T00:00:00Z`)} onChange={value => { setMonth(value.toISOString().slice(0, 7)); setDay(""); }} /></label>
      <label><span>Day</span><AppSelect aria-label="Filter history by day" value={day} onChange={event => setDay(event.target.value)}><option value="">All days</option>{monthGroups.filter(group => group.date).map(group => <option key={group.date} value={group.date}>{dayLabel(group.date)}</option>)}</AppSelect></label>
    </div>
    <div className="followup-history-scope"><span>{month ? `Showing ${day ? dayLabel(day) : new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`))}` : day ? `Showing ${dayLabel(day)}` : "Showing all recorded history"}</span>{(month || day) && <button type="button" onClick={() => { setMonth(""); setDay(""); }}>Show all history</button>}</div>
    {groups.length ? <div className="followup-history-groups">{groups.map(group => <div className="followup-history-day" key={group.date}><h4>{dayLabel(group.date)}</h4><ol>{group.items.map(entry => {
      const completed = ["CONTACTED", "RESOLVED"].includes(entry.eventType);
      const assignment = entry.eventType.includes("ASSIGN");
      return <li key={entry.id}><span className={`followup-history-icon ${completed ? "completed" : ""}`} aria-hidden="true">{completed ? <FiCheckCircle /> : assignment ? <FiUsers /> : entry.eventType === "CASE_CREATED" ? <FiClock /> : <FiMessageCircle />}</span><article><header><b>{historyEventLabel(entry.eventType)}</b><time dateTime={isoTime(entry.createdAt)}>{timeLabel(entry.createdAt)}</time></header><small>{entry.staffName || "TPK Team"}</small>{entry.reason && <p><strong>Reason:</strong> {entry.reason}</p>}{entry.notes && <p>{entry.notes}</p>}{entry.expectedBack && <p className="followup-history-return"><FiCalendar aria-hidden="true" />Expected back · {dayLabel(entry.expectedBack.slice(0, 10))}</p>}</article></li>;
    })}</ol></div>)}</div> : <div className="followup-history-empty"><FiClock /><b>{entries.length ? "No updates in this period" : "No follow-up history yet"}</b><p>{entries.length ? "Choose another month or show all history." : "Calls, assignments and updates will appear here."}</p></div>}
  </section>;
}

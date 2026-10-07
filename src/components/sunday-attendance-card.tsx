"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiCalendar } from "react-icons/fi";
import { teacherAttendanceRequest, SundayAttendanceButton, type TeacherService } from "./teacher-attendance-workspace";
import { parseCampusTime } from "@/lib/campus-time";
import "./teacher-attendance.css";

type MySunday = { services: (TeacherService & { checkedInAt: string | null })[]; serverTime: string };

export function SundayAttendanceCard() {
  const [data, setData] = useState<MySunday | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    try {
      const response: MySunday = await teacherAttendanceRequest("/my-sunday");
      if (current === generation.current) setData(response);
    } catch { /* The attendance page provides a retryable error. */ }
  }, []);
  useEffect(() => {
    const sequence = generation;
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    const refresh = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", refresh);
    return () => { sequence.current++; window.clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [load]);
  if (!data?.services.length) return null;
  const date = new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(parseCampusTime(data.serverTime));
  return <section className="panel sunday-overview-attendance" aria-label="Sunday teacher sign-in">
    <header><span className="sunday-overview-calendar"><FiCalendar /></span><div><p className="eyebrow">Sunday · Teacher attendance</p><h2>I’m here for Sunday service</h2><p>{date} · Sign in for each service you attend.</p></div></header>
    <div className="sunday-overview-services">{data.services.map(service => <div className="sunday-overview-service" key={service.id}>
      <div><b>{service.name}</b><small>{service.startsAt.slice(11, 16)}–{service.endsAt.slice(11, 16)} (Lagos)</small></div>
      <SundayAttendanceButton service={service} serverTime={data.serverTime} present={!!service.checkedInAt} onSaved={() => void load()} />
    </div>)}</div>
  </section>;
}

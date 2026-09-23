"use client";

import { useEffect, useState } from "react";

type Teacher = { firstName: string; title: "Aunty" | "Uncle" };
const fallbackTeacher: Teacher = { firstName: "Kemi", title: "Aunty" };
function timeGreeting(hour: number) { return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"; }

export function UserGreeting() {
  const [hour, setHour] = useState(9);
  const [teacher, setTeacher] = useState<Teacher>(fallbackTeacher);

  useEffect(() => {
    const update = () => setHour(new Date().getHours());
    update();
    const saved = localStorage.getItem("tpk-teacher");
    if (saved) {
      try { const profile = JSON.parse(saved); if (profile.firstName && profile.title) setTeacher(profile); } catch { /* keep the demo profile */ }
    }
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <h1>{timeGreeting(hour)}, {teacher.title} {teacher.firstName} <span>👋🏽</span></h1>;
}

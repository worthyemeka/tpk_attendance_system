"use client";
import { useEffect, useState } from "react";

// This mirrors the current signed-in teacher profile. It will be read from the
// authenticated teacher session once staff login is connected to PHP/MySQL.
const currentTeacher = { firstName: "Kemi", gender: "FEMALE" as const };
function timeGreeting(hour: number) { if (hour < 12) return "Morning"; if (hour < 17) return "Afternoon"; return "Evening"; }
export function UserGreeting() {
  const [hour, setHour] = useState(9);
  useEffect(() => { const update = () => setHour(new Date().getHours()); update(); const timer = window.setInterval(update, 60_000); return () => window.clearInterval(timer); }, []);
  const title = currentTeacher.gender === "FEMALE" ? "Aunty" : currentTeacher.gender === "MALE" ? "Uncle" : "";
  return <h1>{timeGreeting(hour)}, {title} {currentTeacher.firstName} <span>👋🏽</span></h1>;
}

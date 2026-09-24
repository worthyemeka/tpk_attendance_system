"use client";

import { useEffect, useState } from "react";
import { readTeacherSession } from "@/lib/session";

type Teacher = { firstName: string; title: "Auntie" | "Uncle" };
const fallbackTeacher: Teacher = { firstName: "there", title: "Auntie" };
function timeGreeting(hour: number) { return hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening"; }

export function UserGreeting() {
  const [hour, setHour] = useState(9);
  const [teacher, setTeacher] = useState<Teacher>(fallbackTeacher);

  useEffect(() => {
    const update = () => setHour(Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", hourCycle: "h23" }).format(new Date())));
    update();
    const profile = readTeacherSession(); if (profile?.firstName && profile.title) setTeacher(profile);
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return <h1>{timeGreeting(hour)}, {teacher.title} {teacher.firstName} <span>👋🏽</span></h1>;
}

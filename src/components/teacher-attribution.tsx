"use client";

import { useEffect, useState } from "react";
import { mediaUrl } from "@/lib/session";
import { parseCampusTime } from "@/lib/campus-time";
import "./classroom-social.css";

export function PostedTime({ value, label = "Posted" }: { value?: string | null; label?: string }) {
  const date = value ? parseCampusTime(value) : null;
  if (!date || Number.isNaN(date.getTime())) return <small className="posted-time">{label} date not recorded</small>;
  return <time className="posted-time" dateTime={date.toISOString()}>{label} {date.toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>;
}

export function TeacherAttribution({ name, photo, createdAt, label = "Posted", namePrefix }: { name: string; photo?: string | null; createdAt?: string | null; label?: string; namePrefix?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [photo]);
  const initials = name.replace(/^(auntie|aunty|uncle)\s+/i, "").trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "TP";
  return <div className="teacher-attribution">
    <span className="attribution-avatar" aria-hidden="true">{photo && !failed ? <img src={mediaUrl(photo)} alt="" loading="lazy" onError={() => setFailed(true)} /> : initials}</span>
    <div className="attribution-copy"><b>{namePrefix ? `${namePrefix} ${name}` : name}</b><PostedTime value={createdAt} label={label} /></div>
  </div>;
}

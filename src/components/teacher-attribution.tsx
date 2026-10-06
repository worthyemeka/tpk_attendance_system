"use client";

import { useEffect, useState } from "react";
import { apiBase, authHeaders, mediaUrl, readTeacherSession } from "@/lib/session";
import { parseCampusTime } from "@/lib/campus-time";
import "./classroom-social.css";

export function PostedTime({ value, label = "Posted" }: { value?: string | null; label?: string }) {
  const date = value ? parseCampusTime(value) : null;
  if (!date || Number.isNaN(date.getTime())) return <small className="posted-time">{label} date not recorded</small>;
  return <time className="posted-time" dateTime={date.toISOString()}>{label} {date.toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>;
}

// Older discussion payloads can omit photos. Resolve by the recorded staff ID,
// never by a display name, and share one small request between all attributions.
let photoRequest: { token: string; expires: number; result: Promise<Record<string, string>> } | null = null;
function teacherPhotos() {
  const session = readTeacherSession();
  if (!session) return Promise.resolve({} as Record<string, string>);
  if (photoRequest?.token === session.sessionToken && photoRequest.expires > Date.now()) return photoRequest.result;
  const result = fetch(`${apiBase}/api/v1/team/photos`, { headers: authHeaders(session), cache: "no-store" })
    .then(async response => {
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error("Photos unavailable");
      return Object.fromEntries((body.data as { id: number; profileImageUrl: string | null }[]).filter(person => person.profileImageUrl).map(person => [String(person.id), person.profileImageUrl!])) as Record<string, string>;
    }).catch(() => { photoRequest = null; return {}; });
  photoRequest = { token: session.sessionToken, expires: Date.now() + 300_000, result };
  return result;
}

export function TeacherAttribution({ name, photo, staffId, createdAt, label = "Posted", namePrefix }: { name: string; photo?: string | null; staffId?: number | null; createdAt?: string | null; label?: string; namePrefix?: string }) {
  const [resolvedPhoto, setResolvedPhoto] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setResolvedPhoto(null);
    if (!photo && staffId) void teacherPhotos().then(photos => { if (active) setResolvedPhoto(photos[String(staffId)] || null); });
    return () => { active = false; };
  }, [photo, staffId]);
  const image = photo || resolvedPhoto;
  useEffect(() => setFailed(false), [image]);
  const initials = name.replace(/^(auntie|aunty|uncle)\s+/i, "").trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase() || "TP";
  return <div className="teacher-attribution">
    <span className="attribution-avatar" aria-hidden="true">{image && !failed ? <img src={mediaUrl(image)} alt="" loading="lazy" onError={() => setFailed(true)} /> : initials}</span>
    <div className="attribution-copy"><b>{namePrefix ? `${namePrefix} ${name}` : name}</b><PostedTime value={createdAt} label={label} /></div>
  </div>;
}

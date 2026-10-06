"use client";

import { useEffect, useRef, useState } from "react";
import { FiHeart, FiMessageCircle, FiPlay, FiThumbsUp } from "react-icons/fi";
import { apiBase, authHeaders } from "@/lib/session";
import "./classroom-interactions.css";
import { TeacherAttribution, PostedTime } from "./teacher-attribution";

type Reaction = "LIKE" | "APPLAUSE" | "HEART";
type Thread = {
  replies: { id: number; body: string; author: string; authorId?: number; authorProfileImageUrl?: string | null; createdAt: string }[];
  reactions: Record<Reaction, number>;
  myReaction: Reaction | null;
  canInteract: boolean;
};

export function DiscussionThread({ reviewId }: { reviewId: number }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setThread(null);
    fetch(`${apiBase}/api/v1/classroom-reviews/${reviewId}/discussion`, { headers: authHeaders(), signal: controller.signal })
      .then(async (r) => { const b = await r.json(); if (!r.ok || !b.success) throw new Error(b.error?.message || "We couldn't load the replies."); return b.data as Thread; })
      .then((data) => { setThread(data); setError(""); })
      .catch((e) => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "We couldn't load the replies."); });
    return () => controller.abort();
  }, [reviewId, retry]);
  async function save(action: "reply" | "reaction", reaction?: Reaction) {
    if (busy || !thread?.canInteract) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`${apiBase}/api/v1/classroom-reviews/${reviewId}/${action === "reply" ? "replies" : "reaction"}`, {
        method: action === "reply" ? "POST" : "PUT", headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(action === "reply" ? { body: reply.trim() } : { reaction: thread.myReaction === reaction ? null : reaction }),
      });
      const b = await r.json(); if (!r.ok || !b.success) throw new Error(b.error?.message || "We couldn't save this. Please try again.");
      setThread(b.data); if (action === "reply") setReply("");
    } catch (e) { setError(e instanceof Error ? e.message : "We couldn't save this. Please try again."); }
    finally { setBusy(false); }
  }
  const choices = [
    { key: "LIKE" as const, label: "Like", icon: <FiThumbsUp /> },
    { key: "APPLAUSE" as const, label: "Well done", icon: <span aria-hidden="true">👏</span> },
    { key: "HEART" as const, label: "Love", icon: <FiHeart /> },
  ];
  return <div className="discussion-thread" aria-busy={busy}>
    {!thread && !error && <small>Loading replies…</small>}
    {thread && <>
      <div className="discussion-reactions">{choices.map(({ key, label, icon }) => <button key={key} type="button" aria-pressed={thread.myReaction === key} disabled={busy || !thread.canInteract} onClick={() => void save("reaction", key)}>{icon}{label}<span>{thread.reactions[key] || 0}</span></button>)}<small><FiMessageCircle /> {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}</small></div>
      <div className="discussion-replies">{thread.replies.map((item) => <div className="discussion-reply" key={item.id}><TeacherAttribution name={item.author} staffId={item.authorId} photo={item.authorProfileImageUrl} createdAt={item.createdAt} /><p>{item.body}</p></div>)}</div>
      {thread.canInteract && <form className="discussion-reply-form" onSubmit={(e) => { e.preventDefault(); if (reply.trim()) void save("reply"); }}><label htmlFor={`reply-${reviewId}`}>Encourage the team or leave a reply</label><textarea id={`reply-${reviewId}`} value={reply} maxLength={2000} rows={2} disabled={busy} onChange={(e) => setReply(e.target.value)} placeholder="Well done, team…" /><button type="submit" disabled={busy || !reply.trim()}>{busy ? "Saving…" : "Post reply"}</button></form>}
    </>}
    {error && <div className="interaction-error" role="alert">{error}{!thread && <button type="button" onClick={() => setRetry((v) => v + 1)}>Retry</button>}</div>}
  </div>;
}

export type AssemblyMedia = { id: number; name: string; mimeType: string; size: number; url: string; createdAt?: string | null };
export function AssemblyAttachment({ item }: { item: AssemblyMedia }) {
  const [url, setUrl] = useState(""); const [error, setError] = useState(false);
  const [poster, setPoster] = useState("");
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let objectUrl = "";
    setUrl(""); setError(false); setPoster(""); setPlaying(false); setReady(false);
    fetch(`${apiBase}${item.url}`, { headers: authHeaders(), signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw new Error("Unavailable"); return r.blob(); })
      .then((blob) => { if (controller.signal.aborted) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.url, retry]);
  const captureCover = () => {
    const element = video.current;
    if (!element?.videoWidth || element.seeking) return;
    setReady(true);
    if (poster || playing) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(960, element.videoWidth);
      canvas.height = Math.round(canvas.width * element.videoHeight / element.videoWidth);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      setPoster(canvas.toDataURL("image/jpeg", .85));
    } catch { /* The paused video frame remains visible if capture is unavailable. */ }
  };
  const play = async () => {
    if (!ready || !video.current) return;
    try { await video.current.play(); setPlaying(true); }
    catch { setPlaying(false); }
  };
  return <figure className="assembly-attachment">
    {item.mimeType.startsWith("video/") ? <div className="assembly-video-cover">
      {url && <video ref={video} controls={playing} playsInline preload="auto" src={url} poster={poster || undefined} aria-label={item.name} onLoadedData={captureCover} onLoadedMetadata={() => { if (video.current) video.current.currentTime = Math.min(.1, video.current.duration / 2 || 0); }} onSeeked={captureCover} onPlay={() => setPlaying(true)} onEnded={() => setPlaying(false)} onError={() => setError(true)} />}
      {!playing && <button type="button" className="assembly-video-play" disabled={!ready && !error} aria-label={error ? `Retry ${item.name}` : `Play ${item.name}`} onClick={() => error ? setRetry(v => v + 1) : void play()}>
        <span className="assembly-play-icon"><FiPlay /></span>
        <b>{error ? "Retry video" : ready ? "Play video" : "Preparing video…"}</b>
        <small>{error ? "The video couldn’t load. Tap to try again." : ready ? "Watch this assembly moment" : "Your video cover will appear here"}</small>
      </button>}
    </div> : url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`View ${item.name}`}><img src={url} alt={item.name} /></a> : <span>{error ? <button onClick={() => setRetry((v) => v + 1)}>Retry attachment</button> : "Loading attachment…"}</span>}
    <figcaption><b>{item.name}</b><PostedTime value={item.createdAt} label="Attached" /></figcaption>
  </figure>;
}

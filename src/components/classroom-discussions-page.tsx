"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ClassroomDetail } from "./classrooms-workspace";
import { apiBase, authHeaders } from "@/lib/session";

export function ClassroomDiscussionsPage() {
  const params = useSearchParams();
  const [classes, setClasses] = useState<{id:number;name:string}[]>([]);
  const [chosen, setChosen] = useState(Number(params.get("classId")) || 0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/api/v1/classes`, {headers:authHeaders(), signal:controller.signal})
      .then(async response => { const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load the classes."); return result.data as {id:number;name:string}[]; })
      .then(items => { setClasses(items); setChosen(current => items.some(item => Number(item.id) === current) ? current : Number(items[0]?.id || 0)); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  return <section className="classroom-discussions">
    <header><p className="eyebrow">Discussions</p><h1>Classroom discussions</h1><p>Share service reviews, pictures and replies with the team.</p></header>
    {!loading && classes.length > 0 && <nav className="discussion-class-tabs" role="tablist" aria-label="Class discussions">
      {classes.map((item, index) => <button
        key={item.id} id={`discussion-class-${item.id}`} type="button" role="tab"
        aria-selected={Number(item.id) === chosen} aria-controls="class-discussion-panel"
        tabIndex={Number(item.id) === chosen ? 0 : -1}
        onClick={() => setChosen(Number(item.id))}
        onKeyDown={event => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? 0 : event.key === "End" ? classes.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + classes.length) % classes.length;
          setChosen(Number(classes[next].id));
          document.getElementById(`discussion-class-${classes[next].id}`)?.focus();
        }}
      >{item.name}</button>)}
    </nav>}
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading classes…</p> : chosen ? <div id="class-discussion-panel" role="tabpanel" aria-labelledby={`discussion-class-${chosen}`}><ClassroomDetail key={chosen} classId={chosen} discussionOnly /></div> : !error && <p>No classes have been set up yet.</p>}
    <style jsx>{`
      h1{font-size:clamp(28px,4vw,40px);margin:8px 0}header p{line-height:1.6}
      .discussion-class-tabs{display:flex;flex-wrap:wrap;gap:4px 12px;margin:24px 0;border-bottom:1px solid var(--theme-edge,#e2e5eb)}
      .discussion-class-tabs button{min-height:48px;max-width:100%;padding:12px 16px;border:0;border-bottom:3px solid transparent;background:transparent;color:var(--theme-ink,#65728b);font:700 14px var(--font-body);cursor:pointer;overflow-wrap:anywhere}
      .discussion-class-tabs button[aria-selected="true"]{border-bottom-color:var(--theme-accent,#ee5031);color:var(--theme-accent,#c14225)}
      .discussion-class-tabs button:focus-visible{outline:2px solid var(--theme-accent,#c14225);outline-offset:-2px;border-radius:4px}
      :global(html[data-event-appearance="event"]) .discussion-class-tabs button{background:transparent!important;color:var(--theme-accent,#ffda55)!important;box-shadow:none!important;border:0!important;border-bottom:3px solid transparent!important}
      :global(html[data-event-appearance="event"]) .discussion-class-tabs button[aria-selected="true"]{border-bottom-color:var(--theme-accent,#ffda55)!important}
      :global(html[data-event-appearance="event"] .classroom-discussions .review-form-heading){background:var(--theme-panel)!important;color:var(--theme-ink,#fff)!important}
      :global(html[data-event-appearance="event"] .classroom-discussions .review-field>span),:global(html[data-event-appearance="event"] .classroom-discussions .discussion-month>span){color:var(--theme-ink,#fff)!important}
      :global(html[data-event-appearance="event"] .classroom-discussions .review-session select){background:var(--theme-body)!important;color:#fff!important;border-color:var(--theme-input-edge)!important}
      @media(max-width:600px){.discussion-class-tabs{gap:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.discussion-class-tabs button{padding:12px 8px}}
    `}</style>
  </section>;
}

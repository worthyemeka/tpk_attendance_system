"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AppSelect } from "./app-dropdown";
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
  return <section>
    <header><p className="eyebrow">Discussions</p><h1>Classroom discussions</h1><p>Share service reviews, pictures and replies with the team.</p></header>
    <label className="discussion-class-picker">Class<AppSelect aria-label="Choose a class for discussions" value={String(chosen)} onChange={event => setChosen(Number(event.target.value))} disabled={loading || !classes.length}>{classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</AppSelect></label>
    {error && <p role="alert">{error}</p>}
    {loading ? <p role="status">Loading classes…</p> : chosen ? <ClassroomDetail key={chosen} classId={chosen} discussionOnly /> : !error && <p>No classes have been set up yet.</p>}
    <style jsx>{`h1{font-size:clamp(28px,4vw,40px);margin:8px 0}.discussion-class-picker{display:grid;gap:8px;max-width:360px;margin:24px 0;font-weight:700}header p{line-height:1.6}.discussion-class-picker :global(select){min-height:44px;width:100%;border:1px solid var(--line,#e2e5eb);border-radius:9px;padding:10px;font:inherit;background:var(--paper,#fff);color:var(--ink,#203451)}`}</style>
  </section>;
}

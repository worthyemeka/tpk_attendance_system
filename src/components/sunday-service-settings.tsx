"use client";

import { AppSelect } from "@/components/app-dropdown";
import { useEffect, useMemo, useState } from "react";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { useSundayContext } from "@/lib/sunday-context";

type ServiceTime = { id?: number; startTime: string; endTime: string };
const defaults = (): ServiceTime[] => [{ startTime: "08:30", endTime: "10:15" }, { startTime: "10:30", endTime: "12:15" }];
const time = (value?: string) => value?.slice(11,16) || "";

export function SundayServiceSettings() {
  const session = useMemo(() => readTeacherSession(), []);
  const context = useSundayContext();
  const [date,setDate] = useState("");
  const [theme,setTheme] = useState("");
  const [services,setServices] = useState<ServiceTime[]>(defaults);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [message,setMessage] = useState("");
  const [error,setError] = useState("");

  useEffect(() => { if (!date && context.selectedSundayDate) setDate(context.selectedSundayDate); }, [context.selectedSundayDate,date]);
  useEffect(() => {
    if (!session || !date) return;
    let cancelled = false;
    setLoading(true);setError("");setMessage("");
    fetch(`${apiBase}/api/v1/service-sessions/sunday-schedule?serviceDate=${encodeURIComponent(date)}`, { headers:authHeaders(session),cache:"no-store" })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load this Sunday’s settings.");
        if (cancelled) return;
        setTheme(result.data.theme || "");
        setServices(result.data.sessions.length ? result.data.sessions.map((item:{id:number;startsAt:string;endsAt:string})=>({ id:Number(item.id),startTime:time(item.startsAt),endTime:time(item.endsAt) })) : defaults());
      }).catch(reason=> { if(!cancelled)setError(reason instanceof Error?reason.message:"We could not load these settings."); })
      .finally(()=> { if(!cancelled)setLoading(false); });
    return ()=> {cancelled=true;};
  },[date,session]);

  const changeCount = (count:number) => setServices(current=>Array.from({length:Math.max(1,Math.min(3,count))},(_,index)=> current[index] || { startTime:"",endTime:"" }));
  async function save(event:React.FormEvent) {
    event.preventDefault();if(!session||loading||saving)return;
    if(services.length>3){setError("This existing schedule has more than three services. Reconcile its records before reducing the schedule; no services have been removed.");return;}
    setSaving(true);setError("");setMessage("");
    try {
      const response=await fetch(`${apiBase}/api/v1/service-sessions/sunday-schedule`,{method:"PUT",headers:{...authHeaders(session),"Content-Type":"application/json"},body:JSON.stringify({serviceDate:date,theme,sessions:services})});
      const result=await response.json();
      if(!response.ok||!result.success)throw new Error(result.error?.message||"We could not save the Sunday schedule.");
      setMessage("Sunday schedule saved. The service selectors now use these services and times.");
      context.retry();
      // Refresh IDs so another save edits the same sessions rather than inserting copies.
      const refreshed=await fetch(`${apiBase}/api/v1/service-sessions/sunday-schedule?serviceDate=${date}`,{headers:authHeaders(session),cache:"no-store"}).then(response=>response.json());
      if(refreshed.success)setServices(refreshed.data.sessions.map((item:{id:number;startsAt:string;endsAt:string})=>({id:Number(item.id),startTime:time(item.startsAt),endTime:time(item.endsAt)})));
    }catch(reason){setError(reason instanceof Error?reason.message:"We could not save these settings.");}finally{setSaving(false);}
  }

  return <article id="sunday-schedule" className="panel sunday-settings"><header className="schedule-heading"><div><p className="eyebrow">Service planning</p><h2>Sunday services</h2><p>Choose a Sunday, then set its theme and service times.</p></div><span>Super Admin</span></header><form onSubmit={save}>
    <div className="schedule-controls"><label>Sunday date<input required type="date" value={date} onChange={event=>setDate(event.target.value)} disabled={saving}/></label><label>Number of services<AppSelect value={services.length} onChange={event=>changeCount(Number(event.target.value))} disabled={loading||saving}>{Array.from({length:3},(_,i)=><option value={i+1} key={i}>{i+1} service{i===0?"":"s"}</option>)}</AppSelect></label><label>Service theme <small>Optional · for example, Thanksgiving</small><input maxLength={120} placeholder="e.g. Thanksgiving" value={theme} onChange={event=>setTheme(event.target.value)} disabled={loading||saving}/></label></div>
    {loading?<p>Loading Sunday schedule…</p>:services.map((service,index)=><div className="service-times" key={service.id||`new-${index}`}><div className="service-time-name"><i>{index+1}</i><span><b>{services.length===1?(theme||"Single service"):`Service ${index+1}`}</b><small>{services.length===1?"One service this Sunday":"Scheduled service"}</small></span></div><label>Starts<input type="time" required value={service.startTime} disabled={saving} onChange={event=>setServices(current=>current.map((item,i)=>i===index?{...item,startTime:event.target.value}:item))}/></label><label>Ends<input type="time" required value={service.endTime} disabled={saving} onChange={event=>setServices(current=>current.map((item,i)=>i===index?{...item,endTime:event.target.value}:item))}/></label></div>)}
    <small className="schedule-help">With one service, the theme becomes its name in the dropdown. Existing attendance and assignments remain linked to their service.</small>
    {error&&<p className="schedule-error" role="alert">{error}</p>}{message&&<p className="schedule-success" role="status">{message}</p>}
    <button className="solid-button" type="submit" disabled={loading||saving||!date}>{saving?"Saving…":"Save Sunday schedule"}</button>
  </form><style jsx>{`.sunday-settings{scroll-margin-top:100px;margin-top:20px;max-width:980px;padding:24px}.sunday-settings h2{font:26px var(--font-display),Georgia,serif;margin:0 0 6px}.sunday-settings p{font-size:13px;color:var(--muted)}.schedule-controls{display:grid;grid-template-columns:1fr 1fr 1.4fr;gap:14px;margin:20px 0}.sunday-settings label{display:grid;gap:6px;font-size:12px;font-weight:800}.sunday-settings label small{font-size:10px;color:var(--muted);font-weight:500}.sunday-settings input,.sunday-settings select{min-width:0;width:100%;height:44px;border:1px solid var(--line);border-radius:8px;padding:0 12px;background:#fffdfa;color:var(--ink);font:600 13px var(--font-body)}.service-times{display:grid;grid-template-columns:1.2fr 1fr 1fr;align-items:center;gap:14px;padding:14px 0;border-top:1px solid var(--line)}.service-times b{overflow-wrap:anywhere;font-size:13px}.schedule-help{display:block;color:var(--muted);font-size:12px;line-height:1.5;margin:16px 0}.schedule-error{color:#b33d25!important}.schedule-success{color:#087757!important}.sunday-settings button{min-height:44px}@media(max-width:650px){.schedule-controls{grid-template-columns:1fr}.service-times{grid-template-columns:1fr 1fr}.service-times b{grid-column:1/-1}.sunday-settings{padding:18px}.sunday-settings button{width:100%;justify-content:center}}`}</style></article>;
}

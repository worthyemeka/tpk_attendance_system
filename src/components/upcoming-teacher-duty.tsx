"use client";
import {useEffect,useMemo,useState} from "react";
import {apiBase,authHeaders,readTeacherSession} from "@/lib/session";
import {campusRosterDate} from "@/lib/teacher-roster-status";
type Duty={id:number;assignmentDate:string;dutyName:string;className?:string|null;serviceName?:string|null;status:string};
export function UpcomingTeacherDuty({teacherId,fallback}:{teacherId:number;fallback?:string|null}){
  const session=useMemo(()=>readTeacherSession(),[]);
  const [result,setResult]=useState<{duties:Duty[];state:"loading"|"ready"|"error"}>({duties:[],state:"loading"});
  useEffect(()=>{
    const controller=new AbortController();const today=campusRosterDate();const date=new Date(today+"T12:00:00");
    setResult({duties:[],state:"loading"});
    if(!session){setResult({duties:[],state:"error"});return;}
    const months=[date,new Date(date.getFullYear(),date.getMonth()+1,1)];
    void Promise.all(months.map(async month=>{
      const response=await fetch(`${apiBase}/api/v1/staff/${teacherId}/roster?month=${month.getMonth()+1}&year=${month.getFullYear()}`,{headers:authHeaders(session),signal:controller.signal});
      const body=await response.json();if(!response.ok||!body.success)throw new Error("Roster unavailable");
      return (body.data?.activities||[]) as Duty[];
    })).then(groups=>{
      const duties=groups.flat().filter(duty=>duty.assignmentDate>=today&&!["CANCELLED","REPLACED"].includes(duty.status)).sort((a,b)=>a.assignmentDate.localeCompare(b.assignmentDate));
      if(!controller.signal.aborted)setResult({duties:duties.filter(duty=>duty.assignmentDate===duties[0]?.assignmentDate),state:"ready"});
    }).catch(()=>{if(!controller.signal.aborted)setResult({duties:[],state:"error"});});
    return()=>controller.abort();
  },[teacherId,session]);
  if(result.state==="loading")return <span className="upcoming-duty muted">Finding the next serving date…</span>;
  if(result.state==="error")return <span className="upcoming-duty">{fallback||"Roster unavailable"}<small>Open the roster to confirm the date.</small></span>;
  if(!result.duties.length)return <span className="upcoming-duty muted">No duty scheduled this month or next.</span>;
  return <span className="upcoming-duty"><b>{new Intl.DateTimeFormat("en-NG",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date(result.duties[0].assignmentDate+"T12:00:00"))}</b>{result.duties.map(duty=><span key={duty.id}>{duty.dutyName}{duty.className?" · "+duty.className:""}<small>{duty.serviceName||"TPK duty"}</small></span>)}</span>;
}

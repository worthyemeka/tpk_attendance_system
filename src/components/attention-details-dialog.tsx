"use client";
import { useEffect, useMemo, useState } from "react";
import { FiCalendar, FiDownload } from "react-icons/fi";
import { apiBase, authHeaders, mediaUrl, readTeacherSession } from "@/lib/session";
import { downloadMonthlyRosterPdf, downloadWeeklyRosterPdf, type WeeklyAssignment } from "@/lib/weekly-roster-pdf";
import { QuickDialog } from "./dashboard-quick-views";
import { PickupDashboard } from "./pickup-dashboard";
import { ChildDirectory } from "./child-directory";
import { FollowupWorkspace } from "./followup-workspace";
import type { AttentionItem } from "./attention-panel";
import "./attention-details-dialog.css";

export function attentionMonth(destination:string) {
  return destination.match(/(?:month=|\/)(\d{4}-(?:0[1-9]|1[0-2]))(?:\D|$)/)?.[1] || new Date().toISOString().slice(0,7);
}
export function AttentionDetailsDialog({item,close}: {item:AttentionItem;close:()=>void}) {
  if(item.type==="ROSTER_ASSIGNMENT")return <RosterAttentionDialog month={attentionMonth(item.actionDestination)} close={close}/>;
  const pickup=item.type==="UNPICKED_UP", children=item.type==="NEEDS_CLASS_ASSIGNMENT";
  return <QuickDialog wide title={pickup?"Children awaiting pickup":children?"Class assignments":"Follow-up care"} close={close}>
    <div className="attention-workspace">{pickup?<PickupDashboard/>:children?<ChildDirectory needsClassAssignment/>:<FollowupWorkspace/>}</div>
  </QuickDialog>;
}

type Assignment=WeeklyAssignment&{dutyCategory?:string};
const dateLabel=(date:string)=>new Intl.DateTimeFormat("en-NG",{weekday:"long",day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${date}T12:00:00Z`));
function RosterAttentionDialog({month,close}: {month:string;close:()=>void}) {
  const session=useMemo(readTeacherSession,[]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  const [scope,setScope]=useState<"MY"|"TEAM">("MY"),[downloading,setDownloading]=useState("");
  const title=new Intl.DateTimeFormat("en-NG",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${month}-01T12:00:00Z`))+" roster";
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");
    async function load(){
      if(!session)throw new Error("Please sign in again to view your roster.");
      const response=await fetch(`${apiBase}/api/v1/roster/management?month=${Number(month.slice(5))}&year=${month.slice(0,4)}`,{headers:authHeaders(session),signal:controller.signal,cache:"no-store"});
      const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error?.message||"We couldn’t load this month’s roster.");
      if(!controller.signal.aborted)setAssignments((body.data.assignments||[]).filter((assignment:Assignment)=>assignment.assignmentDate.startsWith(month)&&!["CANCELLED","REPLACED"].includes(assignment.status)));
    }
    void load().catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"We couldn’t load this roster.");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[month,retry,session]);
  const visible=assignments.filter(assignment=>scope==="TEAM"||Number(assignment.userId)===Number(session?.staffUserId));
  const dates=[...new Set(visible.map(assignment=>assignment.assignmentDate))].sort();
  async function download(date:string){
    setDownloading(date);setError("");
    try{await downloadWeeklyRosterPdf(visible,date);}catch{setError("We couldn’t download this roster. Please try again.");}finally{setDownloading("");}
  }
  async function downloadAll(){
    setDownloading("ALL");setError("");
    try{await downloadMonthlyRosterPdf(visible,month,scope==="MY");}catch{setError("We couldn’t download this month’s roster. Please try again.");}finally{setDownloading("");}
  }
  return <QuickDialog wide title={title} close={close}>
    <p className="quick-intro">Your serving dates and responsibilities, without leaving the overview.</p>
    <div className="attention-roster-toolbar"><div role="group" aria-label="Roster scope"><button type="button" disabled={Boolean(downloading)} aria-pressed={scope==="MY"} onClick={()=>setScope("MY")}>My responsibilities</button><button type="button" disabled={Boolean(downloading)} aria-pressed={scope==="TEAM"} onClick={()=>setScope("TEAM")}>Full team</button></div><span>{loading?"Loading…":`${visible.length} ${visible.length===1?"responsibility":"responsibilities"}`}</span><button type="button" className="attention-download-all" disabled={loading||Boolean(downloading)||!visible.length} onClick={()=>void downloadAll()}><FiDownload/>{downloading==="ALL"?"Downloading…":"Download all dates · PDF"}</button></div>
    {error&&<div className="quick-error" role="alert">{error}<button type="button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>}
    {loading?<p className="quick-empty" role="status">Loading your roster…</p>:!dates.length&&!error?<p className="quick-empty">{scope==="MY"?"You have no responsibilities assigned for this month.":"No assignments have been published for this month."}</p>:<div className="attention-roster-dates">{dates.map(date=>{
      const entries=visible.filter(assignment=>assignment.assignmentDate===date);
      const groups=new Map<string,{item:Assignment;roles:Set<string>}>();
      entries.forEach(item=>{const key=`${item.userId}:${item.serviceSessionId||item.serviceName||0}`;const group=groups.get(key)||{item,roles:new Set<string>()};group.roles.add([item.dutyName,item.className].filter(Boolean).join(" · "));groups.set(key,group);});
      return <section key={date} className="attention-roster-date"><header><h3><FiCalendar/>{dateLabel(date)}</h3><button type="button" disabled={Boolean(downloading)} aria-label={`Download roster for ${dateLabel(date)}`} onClick={()=>void download(date)}><FiDownload/>{downloading===date?"Downloading…":"PDF"}</button></header><div>{[...groups.values()].map(({item,roles},index)=><article key={`${item.userId}-${index}`}>
        {mediaUrl(item.profileImageUrl)?<img src={mediaUrl(item.profileImageUrl)!} alt=""/>:<i>{item.teacherName.split(/\s+/).filter(Boolean).slice(-2).map(part=>part[0]).join("")}</i>}<div><b>{item.teacherName}</b><small>{item.serviceName||"Ministry activity"}</small><p>{[...roles].join(" / ")}</p></div>
      </article>)}</div></section>;
    })}</div>}
  </QuickDialog>;
}

"use client";

import { useEffect, useState } from "react";
import { FiDownload, FiUsers } from "react-icons/fi";
import { apiBase, authHeaders } from "@/lib/session";
import { printBrandedDocument } from "@/lib/branded-print";
import { MonthPicker } from "./month-picker";
import { AppSelect } from "./app-dropdown";
import "./first-timers-report.css";

type Child = { childId: number; firstName: string; lastName: string; className: string; serviceName: string; firstVisitDate: string };
type Week = { week: number; serviceDate: string; count: number; upcoming: boolean; children: Child[] };
type Report = { month: string; total: number; weeks: Week[] };
const dateLabel = (date: string) => new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"Africa/Lagos"}).format(new Date(date+"T12:00:00Z"));

export function FirstTimersReport({year,month,onMonthChange}:{year:number;month:number;onMonthChange:(date:Date)=>void}) {
  const [report,setReport]=useState<Report|null>(null);
  const [selected,setSelected]=useState("all");
  const [error,setError]=useState("");
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setReport(null);setError("");setSelected("all");
    void fetch(`${apiBase}/api/v1/reports/first-timers?year=${year}&month=${month}`,{headers:authHeaders(),cache:"no-store",signal:controller.signal})
      .then(async response=>{const result=await response.json();if(!response.ok||!result.success)throw Error(result.error?.message||"The weekly reports could not load.");if(!controller.signal.aborted)setReport(result.data);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});
    return()=>controller.abort();
  },[year,month,reload]);
  const weeks=report?.weeks.filter(week=>selected==="all"||week.serviceDate===selected)||[];
  const rows=weeks.flatMap(week=>week.children.map(child=>[dateLabel(week.serviceDate),`${child.firstName} ${child.lastName}`,child.className,child.serviceName]));
  const title=new Intl.DateTimeFormat("en-GB",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)));
  function exportCsv(){
    const safe=(value:string)=>`"${(/^[=+@\-\t\r]/.test(value)?"'":"")+value.replaceAll('"','""')}"`;
    const text=[["Sunday","Child","Class","Service"],...rows].map(row=>row.map(safe).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob(["\uFEFF"+text],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`TPK-first-timers-${report?.month}-${selected}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportPdf(){printBrandedDocument({eyebrow:"Weekly first-timer report",title:`First-timers · ${title}`,subtitle:"Based on each child’s first recorded Sunday attendance. Later visits are not counted again.",stats:weeks.map(week=>({label:`Week ${week.week} · ${dateLabel(week.serviceDate)}`,value:week.count,note:week.upcoming?"Upcoming Sunday":undefined})),columns:["Sunday","Child","Class","Service"],rows});}
  return <section className="first-timers-report" aria-label="Weekly first-timer reports">
    <header><div><h2><FiUsers aria-hidden="true"/> First-timers</h2><p>A report for every Sunday in the month. Each child appears once, on their first recorded attendance.</p></div><MonthPicker value={new Date(Date.UTC(year,month-1,1))} onChange={onMonthChange} ariaLabel="First-timer report month"/></header>
    <p className="first-timers-note">Registration alone is not a visit. These reports use saved check-in records; attendance before the system’s records began may not be available.</p>
    {error?<p role="alert">{error} <button type="button" onClick={()=>setReload(value=>value+1)}>Retry</button></p>:!report?<p role="status">Loading weekly reports…</p>:<>
      <div className="first-timers-toolbar"><label>Sunday<AppSelect value={selected} onChange={event=>setSelected(event.target.value)} aria-label="First-timer Sunday"><option value="all">All Sundays in {title}</option>{report.weeks.map(week=><option key={week.serviceDate} value={week.serviceDate}>Week {week.week} · {dateLabel(week.serviceDate)}</option>)}</AppSelect></label><span>{report.total} first-timer{report.total===1?"":"s"} this month</span><button type="button" onClick={exportCsv}><FiDownload/> Download CSV</button><button type="button" onClick={exportPdf}><FiDownload/> Download PDF</button></div>
      <div className="first-timers-weeks">{weeks.map(week=><section key={week.serviceDate} className="first-timers-week" aria-label={`Week ${week.week} first-timers`}><header><div><h3>Week {week.week} · {dateLabel(week.serviceDate)}</h3><small>{week.upcoming?"Upcoming Sunday":"First recorded visits"}</small></div><strong>{week.count}</strong></header>{week.children.length?<div className="first-timers-table"><table><thead><tr><th>Child</th><th>Class</th><th>Service</th></tr></thead><tbody>{week.children.map(child=><tr key={child.childId}><td>{child.firstName} {child.lastName}</td><td>{child.className}</td><td>{child.serviceName}</td></tr>)}</tbody></table></div>:<p>{week.upcoming?"This Sunday has not happened yet.":"No first-timer check-ins recorded for this Sunday."}</p>}</section>)}</div>
    </>}
  </section>;
}

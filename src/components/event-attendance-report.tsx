"use client";
import { useMemo,useState } from "react";
import { FiDownload,FiSearch } from "react-icons/fi";
import { AppSelect } from "./app-dropdown";
import { RecordBadge } from "./record-badge";
import { DirectoryPagination } from "./directory-pagination";
import { eventDate } from "@/lib/events";
import { downloadTablePdf,loadEventReportBranding } from "@/lib/table-pdf";

export type EventAttendanceChild={id:number;name:string;homeCampus:string;groupName?:string;guardianName?:string;sessionIds?:string};
export type EventAttendanceSession={id:number;name:string;startsAt:string;endsAt:string};
export type EventAttendanceArrival={id?:number;childId:number;sessionId:number;pickedUpAt?:string};
export type EventHistoricalMark={childId:number;dayId:number;present:number|null};
export type EventAttendanceDay={id:number;label:string;date:string};
type Props={eventName:string;eventType:string;children:EventAttendanceChild[];sessions:EventAttendanceSession[];days:EventAttendanceDay[];arrivals:EventAttendanceArrival[];historical:EventHistoricalMark[];canCheckIn:boolean;canPickUp:boolean;busy:boolean;onCheckIn:(childId:number,sessionId:number)=>void;onPickup:(arrival:EventAttendanceArrival)=>void};
const isoDay=(value:string)=>value.slice(0,10);
const localToday=()=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=(key:string)=>parts.find(part=>part.type===key)?.value||"";return `${get("year")}-${get("month")}-${get("day")}`;};
const safeName=(value:string)=>value.replace(/[^a-z0-9]+/gi,"-");

export function EventAttendanceReport(props:Props){
 const {children,sessions,days,arrivals,historical}=props;
 const calendar=useMemo(()=>{
  const map=new Map<string,{date:string;label:string;dayId?:number}>();
  days.forEach(day=>map.set(day.date,{date:day.date,label:day.label,dayId:Number(day.id)}));
  sessions.forEach(session=>{const date=isoDay(session.startsAt);if(!map.has(date))map.set(date,{date,label:eventDate(date)});});
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date));
 },[days,sessions]);
 const[date,setDate]=useState("");const[sessionId,setSessionId]=useState("");const[search,setSearch]=useState("");const[page,setPage]=useState(1);const[pageSize,setPageSize]=useState(12);const[error,setError]=useState("");const[exporting,setExporting]=useState(false);
 const activeDate=date||calendar[0]?.date||"";
 const day=calendar.find(item=>item.date===activeDate);
 const onDateSessions=sessions.filter(session=>isoDay(session.startsAt)===activeDate);
 const activeSession=onDateSessions.find(session=>String(session.id)===sessionId)||onDateSessions[0];
 const imported=Boolean(day?.dayId&&historical.some(mark=>Number(mark.dayId)===day.dayId));
 const rows=children.filter(child=>{
  if(imported)return historical.some(mark=>Number(mark.dayId)===day?.dayId&&Number(mark.childId)===Number(child.id));
  if(activeSession)return (child.sessionIds||"").split(",").includes(String(activeSession.id));
  return false;
 }).filter(child=>`${child.name} ${child.homeCampus} ${child.groupName||""}`.toLowerCase().includes(search.toLowerCase()));
 const status=(child:EventAttendanceChild)=>{
  if(imported){const mark=historical.find(item=>Number(item.childId)===Number(child.id)&&Number(item.dayId)===day?.dayId);return Number(mark?.present)===1?"Present":mark?.present===0?"Unchecked in source":"Not recorded";}
  if(!activeSession)return "Not recorded";
  if(arrivals.some(item=>Number(item.childId)===Number(child.id)&&Number(item.sessionId)===Number(activeSession.id)))return "Present";
  const now=new Date();const ended=new Date(activeSession.endsAt.replace(" ","T")+"+01:00")<now;
  return activeDate<localToday()||ended?"Absent":"Awaiting check-in";
 };
 const present=rows.filter(child=>status(child)==="Present").length;
 const absent=rows.filter(child=>status(child)==="Absent").length;
 async function exportPdf(){setExporting(true);setError("");try{await downloadTablePdf(`${safeName(props.eventName)}-${activeDate}-attendance.pdf`,{branding:await loadEventReportBranding(props.eventType),title:`${props.eventName} · Daily attendance`,subtitle:`${eventDate(activeDate)}${activeSession&&!imported?` · ${activeSession.name}`:""}${imported?" · Source unchecked marks are not verified absences":""}`,columns:["Child","Group","Home campus","Attendance"],rows:rows.map(child=>[child.name,child.groupName||"Unassigned",child.homeCampus||"Not recorded",status(child)])});}catch(e){setError(e instanceof Error?e.message:"Download failed.");}finally{setExporting(false);}}
 return <section className="event-panel"><header><div><p className="eyebrow">Daily check-in</p><h2>Attendance</h2><p>Each programme day has its own present / absent list, separate from registrations.</p></div><button className="outline-button" disabled={exporting||!rows.length} onClick={()=>void exportPdf()}><FiDownload/>Export PDF</button></header>
 <div className="event-toolbar"><label>Programme day<AppSelect aria-label="Attendance day" value={activeDate} onChange={e=>{setDate(e.target.value);setSessionId("");setPage(1);}}>{calendar.map(item=><option key={item.date} value={item.date}>{item.label} · {eventDate(item.date)}</option>)}</AppSelect></label>{!imported&&onDateSessions.length>1&&<label>Session<AppSelect aria-label="Attendance session" value={String(activeSession?.id||"")} onChange={e=>{setSessionId(e.target.value);setPage(1);}}>{onDateSessions.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</AppSelect></label>}<label className="event-search"><FiSearch/><input aria-label="Search attendance" placeholder="Search child, group or campus…" value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label></div>
 {imported&&<p className="event-warning">This day was imported from source checkboxes. An unchecked box is not proof that a child was absent.</p>}
 <p className="event-result-count">{rows.length} children · {present} present{!imported?` · ${absent} absent`:""}</p>
 <div className="event-table"><table><thead><tr><th>S/N</th><th>Child</th><th>Group</th><th>Home campus</th><th>Attendance</th>{(props.canCheckIn||props.canPickUp)&&!imported&&<th>Action</th>}</tr></thead><tbody>{rows.slice((page-1)*pageSize,page*pageSize).map((child,index)=>{const arrival=arrivals.find(item=>Number(item.childId)===Number(child.id)&&Number(item.sessionId)===Number(activeSession?.id));const result=status(child);return <tr key={child.id}><td>{(page-1)*pageSize+index+1}</td><td><b>{child.name}</b></td><td>{child.groupName||"Unassigned"}</td><td>{child.homeCampus||"Not recorded"}</td><td><RecordBadge tone={result==="Present"?"green":result==="Absent"?"orange":"neutral"}>{result}</RecordBadge></td>{(props.canCheckIn||props.canPickUp)&&!imported&&<td>{!arrival&&props.canCheckIn&&activeSession?<button className="outline-button" disabled={props.busy} onClick={()=>props.onCheckIn(child.id,activeSession.id)}>Check in</button>:arrival&&props.canPickUp&&!arrival.pickedUpAt&&arrival.id?<button className="records-view-action" onClick={()=>props.onPickup(arrival)}>Verify pickup</button>:"—"}</td>}</tr>;})}</tbody></table></div>
 {!rows.length&&<div className="event-empty">No children are recorded for this day and session.</div>}<DirectoryPagination page={page} total={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} noun="children"/>{error&&<p className="event-error" role="alert">{error}</p>}</section>;
}

export function EventCampusReport({eventName,eventType,children,sessions,days,arrivals,historical}:{eventName:string;eventType:string;children:EventAttendanceChild[];sessions:EventAttendanceSession[];days:EventAttendanceDay[];arrivals:EventAttendanceArrival[];historical:EventHistoricalMark[]}){
 const[date,setDate]=useState("");const[error,setError]=useState("");const[exporting,setExporting]=useState(false);
 const dates=[...new Set([...days.map(item=>item.date),...sessions.map(item=>isoDay(item.startsAt))])].sort();const activeDate=date||dates[0]||"";
 const day=days.find(item=>item.date===activeDate);const sessionIds=sessions.filter(item=>isoDay(item.startsAt)===activeDate).map(item=>Number(item.id));const marks=historical.filter(item=>Number(item.dayId)===Number(day?.id));const imported=marks.length>0;
 const eligible=children.filter(child=>imported?marks.some(mark=>Number(mark.childId)===Number(child.id)):(child.sessionIds||"").split(",").some(id=>sessionIds.includes(Number(id))));
 const campuses=[...new Set(eligible.map(child=>child.homeCampus||"Not recorded"))].sort();
 const rows=campuses.map(campus=>{const list=eligible.filter(child=>(child.homeCampus||"Not recorded")===campus);const present=list.filter(child=>imported?marks.some(mark=>Number(mark.childId)===Number(child.id)&&Number(mark.present)===1):arrivals.some(arrival=>Number(arrival.childId)===Number(child.id)&&sessionIds.includes(Number(arrival.sessionId)))).length;return {campus,registered:list.length,present};});
 async function exportPdf(){setExporting(true);setError("");try{await downloadTablePdf(`${safeName(eventName)}-${activeDate}-campuses.pdf`,{branding:await loadEventReportBranding(eventType),title:`${eventName} · Campuses present`,subtitle:`${eventDate(activeDate)} · ${imported?"Imported source marks; unchecked is not verified absence":"Event check-ins"}`,columns:["Home campus","Children expected","Present"],rows:rows.map(row=>[row.campus,String(row.registered),String(row.present)])});}catch(e){setError(e instanceof Error?e.message:"Download failed.");}finally{setExporting(false);}}
 return <section className="event-panel"><header><div><h2>Campuses present</h2><p>Children by home campus for each event day. No family contact or care details are included.</p></div><button className="outline-button" disabled={exporting||!rows.length} onClick={()=>void exportPdf()}><FiDownload/>Export PDF</button></header><div className="event-toolbar"><label>Programme day<AppSelect aria-label="Campus report day" value={activeDate} onChange={e=>setDate(e.target.value)}>{dates.map(item=><option key={item} value={item}>{eventDate(item)}</option>)}</AppSelect></label></div><div className="event-table"><table><thead><tr><th>Home campus</th><th>Children expected</th><th>Present</th></tr></thead><tbody>{rows.map(row=><tr key={row.campus}><td><b>{row.campus}</b></td><td>{row.registered}</td><td>{row.present}</td></tr>)}</tbody></table></div>{!rows.length&&<div className="event-empty">No campuses recorded for this day.</div>}{error&&<p className="event-error" role="alert">{error}</p>}</section>;
}

"use client";
import { useState } from "react";
import { AppSelect } from "./app-dropdown";
import { DirectoryPagination } from "./directory-pagination";
import { RecordBadge } from "./record-badge";
import { eventDate } from "@/lib/events";
import type { HistoryData } from "./event-history-panels";
type Child={id:number;name:string;homeCampus:string;reportedAge?:number;ageQualifier?:string};
function Mark({value,label}:{value:number|null;label:string}){
 return <RecordBadge tone={value==null?"neutral":Number(value)===1?"green":"orange"}>{value==null?"Not recorded":Number(value)===1?label:"Unchecked in source"}</RecordBadge>;
}
export function EventHistoricalAttendance({data,children}:{data:HistoryData;children:Child[]}){
 const[day,setDay]=useState(String(data.days[0]?.id||""));const[query,setQuery]=useState("");const[page,setPage]=useState(1);const[pageSize,setPageSize]=useState(12);
 const marks=data.historicalAttendance.filter(a=>String(a.dayId)===day);
 const rows=children.filter(c=>marks.some(a=>Number(a.childId)===Number(c.id))&&(`${c.name} ${c.homeCampus}`).toLowerCase().includes(query.toLowerCase()));
 return <section className="event-panel"><header><div><h2>Historical drop-off & pickup</h2><p>Original daily marks, not live check-ins. An unchecked source box is not a verified absence or an outstanding pickup.</p></div></header><div className="event-toolbar"><AppSelect aria-label="Historical attendance day" value={day} onChange={e=>{setDay(e.target.value);setPage(1);}}>{data.days.map(d=><option key={d.id} value={d.id}>{d.label} · {eventDate(d.date)}</option>)}</AppSelect><input aria-label="Search historical children" placeholder="Search child or home campus…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></div><div className="event-table"><table><thead><tr><th>Child</th><th>Home campus</th><th>Drop-off</th><th>Pickup</th><th>Daily card</th><th>Contacts</th></tr></thead><tbody>{rows.slice((page-1)*pageSize,page*pageSize).map(c=>{const mark=marks.find(m=>Number(m.childId)===Number(c.id))!;return <tr key={c.id}><td><b>{c.name}</b><small>{c.reportedAge!=null?`Reported age ${c.reportedAge}${c.ageQualifier||""}`:"Age not recorded"}</small></td><td>{c.homeCampus}</td><td><Mark value={mark.present} label="Drop-off marked"/></td><td><Mark value={mark.pickedUp} label="Pickup marked"/></td><td>{data.cards.find(card=>Number(card.childId)===Number(c.id)&&String(card.dayId)===day)?.number||"—"}</td><td><details><summary>Source contacts</summary>{data.contacts.filter(contact=>Number(contact.childId)===Number(c.id)).map(contact=><p key={contact.id}><small>{contact.type}</small>{contact.name||"Name not recorded"}<br/>{contact.phone||"Phone not recorded"}</p>)}</details></td></tr>;})}</tbody></table></div>{!rows.length&&<p>No historical records in this view. Import reviewed source rows from Reports.</p>}<DirectoryPagination page={page} total={rows.length} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={size=>{setPageSize(size);setPage(1);}} noun="source records"/></section>;
}

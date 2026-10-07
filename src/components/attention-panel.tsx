"use client";
import { useState } from "react";
import { AttentionDetailsDialog } from "./attention-details-dialog";
import { FiCheckCircle, FiChevronRight, FiClock, FiCalendar, FiUsers } from "react-icons/fi";
export type AttentionItem={type:string;severity:string;message:string;actionLabel:string;actionDestination:string};

export function attentionItems(items:AttentionItem[]){
  const seen=new Set<string>();
  const priority=(severity:string)=>({URGENT:0,HIGH:1,MEDIUM:2}[severity]??3);
  return [...items].sort((a,b)=>priority(a.severity)-priority(b.severity)).filter(item=>{
    const key=item.type==="ROSTER_ASSIGNMENT" ? item.type+item.actionDestination : item.type+item.message+item.actionDestination;
    if(seen.has(key))return false;seen.add(key);return true;
  }).map(item=>{
    if(item.type!=="ROSTER_ASSIGNMENT")return {...item,title:item.message,detail:"",action:item.actionLabel};
    const date=item.actionDestination.match(/(?:month=|\/)(\d{4}-\d{2})/);
    const month=date?new Intl.DateTimeFormat("en-NG",{month:"long",year:"numeric"}).format(new Date(date[1]+"-01T12:00:00")):"";
    return {...item,title:month?month+" roster":"Your roster is ready",detail:"Review your serving dates, team and responsibilities.",action:"View roster"};
  });
}
export function AttentionPanel({items}:{items:AttentionItem[]}){
  const notices=attentionItems(items);
  const [selected,setSelected]=useState<AttentionItem|null>(null);
  return <><section className="panel attention-panel attention-refined">
    <div className="panel-heading"><div><h2>Needs attention</h2><p>{notices.length?notices.length+" "+(notices.length===1?"item":"items")+" to review":"You’re up to date."}</p></div></div>
    {notices.length?<div className="attention-list">{notices.map(item=><button data-theme-control="surface" type="button" aria-haspopup="dialog" key={item.type+item.actionDestination+item.title} className="attention-task" onClick={()=>setSelected(item)}>
      <i className={item.severity.toLowerCase()}>{item.type==="ROSTER_ASSIGNMENT"?<FiCalendar/>:item.type==="UNPICKED_UP"?<FiClock/>:<FiUsers/>}</i>
      <span><small>{item.type==="ROSTER_ASSIGNMENT"?"Roster update":item.severity==="URGENT"?"Urgent":"Action needed"}</small><b>{item.title}</b>{item.detail&&<p>{item.detail}</p>}<em>{item.action}</em></span><FiChevronRight/>
    </button>)}</div>:<div className="attention-clear"><FiCheckCircle/><span><b>Nothing needs attention</b><small>Updates will appear here when there’s a next step.</small></span></div>}
  </section>{selected&&<AttentionDetailsDialog item={selected} close={()=>setSelected(null)}/>}</>;
}

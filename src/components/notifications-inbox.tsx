"use client";
import Link from "next/link";
import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {FiAlertCircle,FiCalendar,FiCheck,FiChevronRight,FiClipboard,FiClock,FiUsers} from "react-icons/fi";
import {apiBase,authHeaders,readTeacherSession} from "@/lib/session";
export type Notice={id:string;kind:"PICKUP"|"FOLLOW_UP"|"CLASS"|"ROSTER"|"SERVICE"|"TEAM";severity:"URGENT"|"HIGH"|"MEDIUM";title:string;detail:string;href:string};
const storageKey="tpk-notifications-read";
const changedEvent="tpk-notifications-read-changed";
function acknowledgements(){try{return new Set<string>(JSON.parse(localStorage.getItem(storageKey)||"[]"));}catch{return new Set<string>();}}
export function useNotifications(serviceSessionId?:number){
  const session=useMemo(()=>readTeacherSession(),[]);
  const [items,setItems]=useState<Notice[]>([]);
  const [read,setRead]=useState<Set<string>>(new Set());
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const request=useRef<AbortController|null>(null);
  const load=useCallback(async()=>{
    if(!session){setLoading(false);return;}
    request.current?.abort();const controller=new AbortController();request.current=controller;
    try{
      const response=await fetch(`${apiBase}/api/v1/notifications${serviceSessionId?"?serviceSessionId="+serviceSessionId:""}`,{headers:authHeaders(session),signal:controller.signal,cache:"no-store"});
      const body=await response.json();if(!response.ok||!body.success)throw new Error("Notifications could not be refreshed.");
      if(!controller.signal.aborted){setItems(body.data?.items||[]);setError("");}
    }catch{if(!controller.signal.aborted)setError("We couldn’t refresh notifications. Please try again.");}
    finally{if(!controller.signal.aborted)setLoading(false);}
  },[session,serviceSessionId]);
  useEffect(()=>{setLoading(true);void load();const timer=window.setInterval(()=>void load(),10_000);return()=>{window.clearInterval(timer);request.current?.abort();};},[load]);
  useEffect(()=>{
    const sync=()=>setRead(acknowledgements());sync();
    window.addEventListener(changedEvent,sync);window.addEventListener("storage",sync);
    return()=>{window.removeEventListener(changedEvent,sync);window.removeEventListener("storage",sync);};
  },[]);
  const saveRead=(ids:string[])=>{
    const next=new Set([...acknowledgements(),...read,...ids]);setRead(next);
    try{localStorage.setItem(storageKey,JSON.stringify([...next].slice(-300)));window.dispatchEvent(new Event(changedEvent));}catch{/* Reading notifications still works without browser storage. */}
  };
  return {items,read,loading,error,load,unread:items.filter(item=>!read.has(item.id)).length,markRead:(id:string)=>saveRead([id]),markAllRead:()=>saveRead(items.map(item=>item.id))};
}
function NoticeIcon({kind}:{kind:Notice["kind"]}){return kind==="SERVICE"?<FiCalendar/>:kind==="PICKUP"?<FiClock/>:kind==="FOLLOW_UP"?<FiUsers/>:kind==="CLASS"?<FiClipboard/>:<FiAlertCircle/>;}
export function NotificationItems({inbox,onNavigate}:{inbox:ReturnType<typeof useNotifications>;onNavigate?:()=>void}){
  return <div className="notification-items">
    {inbox.error&&<div className="notification-error" role="status">{inbox.error}<button type="button" onClick={()=>void inbox.load()}>Try again</button></div>}
    {inbox.loading&&!inbox.items.length?<p className="notification-empty" role="status">Loading notifications…</p>:inbox.items.length?inbox.items.map(item=><Link className={`notification-item ${item.severity.toLowerCase()} ${inbox.read.has(item.id)?"read":"unread"}`} href={item.href} key={item.id} onClick={()=>{inbox.markRead(item.id);onNavigate?.();}}><i><NoticeIcon kind={item.kind}/></i><span><small className="notification-category">{item.kind==="SERVICE"?"Service reminder":item.kind==="TEAM"?"Team":item.kind==="ROSTER"?"Roster":item.kind==="FOLLOW_UP"?"Follow-up":item.kind==="PICKUP"?"Pickup":"Class placement"}{!inbox.read.has(item.id)&&<em>New</em>}</small><b>{item.title}</b><small>{item.detail}</small></span><FiChevronRight/></Link>):!inbox.error&&<div className="notification-empty"><FiCheck/><b>You’re all caught up</b><small>New service reminders, pickup, follow-up and roster updates will appear here.</small></div>}
  </div>;
}
export function NotificationsInbox({serviceSessionId}:{serviceSessionId?:number}){
  const inbox=useNotifications(serviceSessionId);
  return <section className="notifications-page"><Link href="/account/overview" className="notifications-back">← Back to overview</Link><header><div><p className="eyebrow">Your updates</p><h1>Notifications</h1><p>{inbox.unread?inbox.unread+" unread "+(inbox.unread===1?"update":"updates"):"Keep up with your team and serving responsibilities."}</p></div><button type="button" disabled={!inbox.unread} onClick={inbox.markAllRead}><FiCheck/>Mark all read</button></header><NotificationItems inbox={inbox}/></section>;
}

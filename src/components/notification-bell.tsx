"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FiAlertCircle, FiBell, FiCheck, FiChevronRight, FiClipboard, FiClock, FiUsers } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";

type Notice = { id:string; kind:"PICKUP"|"FOLLOW_UP"|"CLASS"|"ROSTER"; severity:"URGENT"|"HIGH"|"MEDIUM"; title:string; detail:string; href:string };
const storageKey="tpk-notifications-read";

function readAcknowledgements(){try{return new Set<string>(JSON.parse(window.localStorage.getItem(storageKey)||"[]"));}catch{return new Set<string>();}}
function NoticeIcon({kind}:{kind:Notice["kind"]}){return kind==="PICKUP"?<FiClock/>:kind==="FOLLOW_UP"?<FiUsers/>:kind==="CLASS"?<FiClipboard/>:<FiAlertCircle/>}

export function NotificationBell({ serviceSessionId }: { serviceSessionId?:number }) {
  const session=useMemo(()=>readTeacherSession(),[]);
  const [open,setOpen]=useState(false); const [items,setItems]=useState<Notice[]>([]); const [read,setRead]=useState<Set<string>>(new Set()); const [loading,setLoading]=useState(false);
  useEffect(()=>setRead(readAcknowledgements()),[]);
  const load=useCallback(async()=>{if(!session)return;setLoading(true);try{const query=serviceSessionId?`?serviceSessionId=${serviceSessionId}`:"";const response=await fetch(`${apiBase}/api/v1/notifications${query}`,{headers:authHeaders(session)});const result=await response.json();if(response.ok&&result.success)setItems(result.data?.items||[]);}catch{setItems([]);}finally{setLoading(false)}},[serviceSessionId,session]);
  useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),60000);return()=>window.clearInterval(timer);},[load]);
  useEffect(()=>{if(open)void load();},[load,open]);
  const unread=items.filter(item=>!read.has(item.id)).length;
  const saveRead=(next:Set<string>)=>{setRead(next);try{window.localStorage.setItem(storageKey,JSON.stringify([...next].slice(-100)));}catch{}};
  const markAllRead=()=>saveRead(new Set([...read,...items.map(item=>item.id)]));
  const markRead=(id:string)=>saveRead(new Set([...read,id]));
  return <div className="notification-wrap">
    <button className="notification-button" type="button" aria-label="Open notifications" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><FiBell/>{unread>0&&<b>{unread>99?"99+":unread}</b>}</button>
    {open&&<section className="notification-popover" aria-label="Operational notifications"><header className="notification-heading"><div><strong>Notifications</strong><span>{loading?"Refreshing…":unread?`${unread} unread`:"You’re all caught up"}</span></div>{Boolean(items.length)&&<button type="button" onClick={markAllRead}><FiCheck/>Mark all read</button>}</header><div className="notification-items">{items.length?items.map(item=><Link className={`notification-item ${item.severity.toLowerCase()} ${read.has(item.id)?"read":""}`} href={item.href} key={item.id} onClick={()=>{markRead(item.id);setOpen(false);}}><i><NoticeIcon kind={item.kind}/></i><span><b>{item.title}</b><small>{item.detail}</small></span><FiChevronRight/></Link>):<div className="notification-empty"><FiCheck/><b>No operational issues right now</b><small>Pickup, follow-up and roster items will appear here when they need attention.</small></div>}</div></section>}
    <style jsx>{`
      .notification-wrap{position:relative}.notification-button{position:relative;width:36px;height:36px;border:1px solid #ded9d1;background:#fffdfa;border-radius:9px;color:#253047;display:grid;place-items:center;cursor:pointer;box-shadow:0 3px 10px #00000008}.notification-button svg{font-size:18px}.notification-button b{position:absolute;right:-7px;top:-7px;min-width:17px;height:17px;padding:0 2px;border-radius:10px;display:grid;place-items:center;background:#f05a37;color:#fff;font:800 9px var(--font-body)}
      .notification-popover{position:absolute;z-index:75;top:46px;right:0;width:min(430px,calc(100vw - 32px));overflow:hidden;border:1px solid #e7e1d8;border-radius:14px;background:#fffdfa;color:#18243a;box-shadow:0 20px 48px rgba(20,25,35,.19)}.notification-heading{display:flex;align-items:center;justify-content:space-between;padding:18px 19px 16px;border-bottom:1px solid #eee8e0}.notification-heading strong,.notification-heading span{display:block}.notification-heading strong{font:700 24px/1.1 var(--font-display),Georgia,serif;letter-spacing:-.5px}.notification-heading span{margin-top:5px;color:#728097;font:600 11px var(--font-body)}.notification-heading button{display:flex;align-items:center;gap:6px;border:0;background:none;color:#d75333;font:800 11px var(--font-body);cursor:pointer}.notification-heading button:hover{color:#b73d20}
      .notification-items{max-height:min(490px,calc(100vh - 160px));overflow:auto}.notification-item{display:flex;align-items:flex-start;gap:11px;padding:14px 18px;border-bottom:1px solid #f0ebe4;color:#1c2b42;text-decoration:none;transition:background .14s ease}.notification-item:hover{background:#fff6f1}.notification-item>i{display:grid;place-items:center;flex:none;width:32px;height:32px;border-radius:10px;background:#fff0eb;color:#e44e2d}.notification-item.high>i{background:#fff2dc;color:#bf7400}.notification-item.medium>i{background:#edf4ff;color:#246bc4}.notification-item.read{opacity:.62}.notification-item>span{display:grid;gap:4px;min-width:0;flex:1}.notification-item b{color:#1b2940;font:800 12px/1.3 var(--font-body)}.notification-item small{color:#68758b;font:500 10.5px/1.45 var(--font-body)}.notification-item>svg{align-self:center;flex:none;color:#8a96a8;font-size:16px}.notification-empty{display:grid;justify-items:center;gap:7px;padding:34px 28px;color:#68758b;text-align:center}.notification-empty svg{width:34px;height:34px;padding:8px;box-sizing:border-box;border-radius:50%;background:#eaf8ef;color:#087a4b}.notification-empty b{color:#25354d;font:800 12px var(--font-body)}.notification-empty small{font:500 10.5px/1.45 var(--font-body)}
      @media(max-width:590px){.notification-popover{right:0;width:min(430px,calc(100vw - 24px))}.notification-heading{padding:16px}.notification-item{padding:13px 16px}}
    `}</style>
  </div>;
}

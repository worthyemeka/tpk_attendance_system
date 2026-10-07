"use client";
import { useEffect,useState } from "react";
import { apiBase,authHeaders } from "@/lib/session";
import { AppSelect } from "./app-dropdown";
import "./event-appearance.css";
import { dashboardPaletteStyle,type EventPalette } from "@/lib/event-palette";
type Theme={eventId:number;name:string;lifecycle:string;palette:EventPalette};
export function DashboardAppearance(){
 useEffect(()=>{
  let active=true;
  const clear=()=>{for(const key of Object.keys(dashboardPaletteStyle()))document.documentElement.style.removeProperty(key);};
  async function refresh(){try{
   const r=await fetch(`${apiBase}/api/v1/me/appearance`,{headers:authHeaders(),cache:"no-store"});const b=await r.json();
   if(active){const root=document.documentElement,theme=r.ok&&b.success&&b.data?.active;clear();root.dataset.eventAppearance=theme?.palette?"event":"default";
    if(theme?.palette)for(const[key,value]of Object.entries(dashboardPaletteStyle(theme.palette,theme.preset==="JUNGLE"||/^VBS\b/i.test(theme.name||""))))root.style.setProperty(key,value);
   }
  }catch{if(active){clear();document.documentElement.dataset.eventAppearance="default";}}}
  void refresh();const timer=setInterval(refresh,60000);window.addEventListener("tpk-appearance-changed",refresh);
  return()=>{active=false;clearInterval(timer);window.removeEventListener("tpk-appearance-changed",refresh);delete document.documentElement.dataset.eventAppearance;clear();};
 },[]);return null;
}
export function AppearancePreference(){const[value,setValue]=useState("DEFAULT");const[themes,setThemes]=useState<Theme[]>([]);const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);useEffect(()=>{fetch(`${apiBase}/api/v1/me/appearance`,{headers:authHeaders()}).then(r=>r.json()).then(b=>{if(b.success){setValue(b.data.preference==="DEFAULT"?"DEFAULT":b.data.selectedEventId?`event:${b.data.selectedEventId}`:"EVENT");setThemes(b.data.available||[]);}}).catch(()=>{});},[]);return <section className="event-appearance-setting"><h2>Dashboard appearance</h2><p>Keep the normal TPK design, follow enabled event appearances, or choose a preserved event such as VBS. Your choice covers your entire dashboard on every page, including navigation, cards, tables and dialogs. It does not change anyone else’s preference.</p><AppSelect aria-label="Preferred dashboard appearance" disabled={busy} value={value} onChange={async e=>{const next=e.target.value;setBusy(true);try{const r=await fetch(`${apiBase}/api/v1/me/appearance`,{method:"PATCH",headers:{...authHeaders(),"Content-Type":"application/json"},body:JSON.stringify({preference:next==="DEFAULT"?"DEFAULT":"EVENT",selectedEventId:next.startsWith("event:")?Number(next.slice(6)):null})});const b=await r.json();if(!r.ok)throw Error(b.error?.message||"Could not save preference.");setValue(next);setMessage("Appearance preference saved.");window.dispatchEvent(new Event("tpk-appearance-changed"));}catch(e){setMessage(e instanceof Error?e.message:"Could not save.");}finally{setBusy(false);}}}><option value="DEFAULT">Default TPK</option><option value="EVENT">Automatic event appearance</option>{themes.filter(t=>t.lifecycle!=="UPCOMING").map(t=><option key={t.eventId} value={`event:${t.eventId}`}>{t.name} · event mode</option>)}</AppSelect>{message&&<p role="status">{message}</p>}</section>;}

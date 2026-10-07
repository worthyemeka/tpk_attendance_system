"use client";
import {useEffect,useState} from "react";
import {FiSearch} from "react-icons/fi";
import {apiBase,authHeaders} from "@/lib/session";
import {DirectoryPagination} from "./directory-pagination";
import {RecordBadge} from "./record-badge";
import {EventDialog} from "./event-dialog";
import "./events-workspace.css";
import "./records-system.css";
type SafeChild={id:number;name:string;homeCampus:string;guardianName:string};
export function TeacherChildDirectory({childId,close}:{childId?:number;close?:()=>void}){
 const[rows,setRows]=useState<SafeChild[]>([]),[selected,setSelected]=useState<SafeChild|null>(null),[query,setQuery]=useState(""),[page,setPage]=useState(1),[size,setSize]=useState(12),[total,setTotal]=useState(0),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");const timer=setTimeout(()=>{void fetch(`${apiBase}/api/v1/children${childId?`/${childId}`:`?page=${page}&limit=${size}&search=${encodeURIComponent(query)}`}`,{headers:authHeaders(),signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok||!body.success)throw new Error(body.error?.message||"Could not load children.");if(childId)setSelected(body.data);else{setRows(body.data);setTotal(body.meta?.total||0);}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},200);return()=>{clearTimeout(timer);controller.abort();};},[childId,page,size,query]);
 const dismiss=()=>{setSelected(null);close?.();};
 const profile=selected&&<EventDialog title={selected.name} drawer onClose={dismiss}><div className="event-profile-fields">{[["Child name",selected.name],["Campus",selected.homeCampus],["Parents / guardians",selected.guardianName]].map(([label,value])=><div key={label}><small>{label}</small><b>{value||"Not recorded"}</b></div>)}</div></EventDialog>;
 if(childId)return <>{profile}{loading&&<p role="status">Loading child…</p>}{error&&<EventDialog title="Child profile" drawer onClose={dismiss}><p role="alert">{error}</p></EventDialog>}</>;
 return <section className="events-workspace"><section className="event-panel event-register"><header><div><h2>Children</h2><p>Child names, campuses and parents / guardians.</p></div></header><label className="event-search"><FiSearch/><input aria-label="Search children" placeholder="Search child or guardian…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>{error&&<p role="alert">{error}</p>}<div className="records-table event-table"><table><thead><tr><th>Child</th><th>Campus</th><th>Parents / guardians</th><th>Profile</th></tr></thead><tbody>{rows.map(c=><tr key={c.id}><td data-label="Child"><b>{c.name}</b></td><td data-label="Campus"><RecordBadge tone="green">{c.homeCampus}</RecordBadge></td><td data-label="Parents / guardians">{c.guardianName||"Not recorded"}</td><td data-label="Profile"><button className="records-view-action" onClick={()=>setSelected(c)}>View →</button></td></tr>)}</tbody></table></div>{!loading&&!rows.length&&<p>No children match this search.</p>}<DirectoryPagination page={page} total={total} pageSize={size} loading={loading} onPageChange={setPage} onPageSizeChange={s=>{setSize(s);setPage(1);}} noun="children"/></section>{profile}</section>;
}

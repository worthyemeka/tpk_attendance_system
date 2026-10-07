"use client";
import {useEffect,useState} from "react";
import {useSearchParams} from "next/navigation";
import {FiSearch,FiX} from "react-icons/fi";
import {apiBase,authHeaders} from "@/lib/session";
import {DirectoryPagination} from "./directory-pagination";
import {ChildrenGrid,ChildrenList,type ChildRecord} from "./children-records";
import {DataViewToggle,type DataView} from "./data-view-toggle";
import {AppSelect} from "./app-dropdown";
import {useProfileDialog} from "./use-profile-dialog";
import "./teacher-child-directory.css";
import "./child-directory-refinement.css";
import "./records-system.css";
type SafeChild={id:number;name:string;homeCampus:string;guardianName:string};
function record(child:SafeChild):ChildRecord{const parts=child.name.trim().split(/\s+/);return {...child,firstName:parts[0]||"",lastName:parts.length>1?parts.at(-1)!:""};}
export function TeacherChildDirectory({childId,close}:{childId?:number;close?:()=>void}){
 const params=useSearchParams(),routeId=childId||Number(params.get("childId"));
 const[rows,setRows]=useState<SafeChild[]>([]),[selected,setSelected]=useState<SafeChild|null>(null),[query,setQuery]=useState(""),[page,setPage]=useState(1),[size,setSize]=useState(12),[total,setTotal]=useState(0),[error,setError]=useState(""),[loading,setLoading]=useState(true),[profileError,setProfileError]=useState(""),[profileLoading,setProfileLoading]=useState(false),[order,setOrder]=useState("asc"),[display,setDisplay]=useState<DataView>("LIST");
 useEffect(()=>{const saved=localStorage.getItem("tpk:children-display");if(saved==="GRID"||saved==="LIST")setDisplay(saved);else if(window.matchMedia("(max-width: 900px)").matches)setDisplay("GRID");},[]);
 useEffect(()=>{
  if(childId)return;const controller=new AbortController();setLoading(true);setError("");
  const timer=setTimeout(()=>{void fetch(`${apiBase}/api/v1/children?page=${page}&limit=${size}&search=${encodeURIComponent(query)}&sort=name&order=${order}`,{headers:authHeaders(),signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok||!body.success)throw new Error(body.error?.message||"Could not load children.");if(!controller.signal.aborted){setRows(body.data||[]);setTotal(Number(body.meta?.total||0));}}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},query?180:0);
  return()=>{clearTimeout(timer);controller.abort();};
 },[childId,page,size,query,order]);
 useEffect(()=>{
  if(!routeId)return;const controller=new AbortController();setProfileLoading(true);setProfileError("");
  void fetch(`${apiBase}/api/v1/children/${routeId}`,{headers:authHeaders(),signal:controller.signal}).then(async r=>{const body=await r.json();if(!r.ok||!body.success)throw Error(body.error?.message||"Could not load this child.");if(!controller.signal.aborted)setSelected(body.data);}).catch(e=>{if(!controller.signal.aborted)setProfileError(e.message);}).finally(()=>{if(!controller.signal.aborted)setProfileLoading(false);});
  return()=>controller.abort();
 },[routeId]);
 const dismiss=()=>{setSelected(null);close?.();};
 useProfileDialog(dismiss,".teacher-child-profile",!!selected||profileLoading||!!profileError);
 const profile=(selected||profileLoading||profileError)&&<div className="teacher-child-backdrop" onMouseDown={dismiss}><aside className="profile-panel teacher-child-profile" role="dialog" aria-modal="true" aria-label={selected?`${selected.name}’s profile`:"Child profile"} onMouseDown={e=>e.stopPropagation()}><button type="button" className="profile-close" aria-label="Close child profile" onClick={dismiss}><FiX/></button><header><span className="record-child-avatar" aria-hidden="true">{selected?`${record(selected).firstName[0]||""}${record(selected).lastName[0]||""}`.toUpperCase():"…"}</span><div><p className="eyebrow">Child profile</p><h2>{selected?.name||"Child profile"}</h2></div></header>{profileLoading?<p role="status">Loading child…</p>:profileError?<p className="child-error" role="alert">{profileError}</p>:selected&&<section className="teacher-child-information"><h3>Personal information</h3><dl>{[["Child name",selected.name],["Campus",selected.homeCampus],["Parents / guardians",selected.guardianName]].map(([label,value])=><div className="profile-fact" key={label}><dt>{label}</dt><dd>{value||"Not recorded"}</dd></div>)}</dl></section>}<footer><button className="record-profile-action" type="button" onClick={dismiss}>Close profile</button></footer></aside></div>;
 if(childId)return <>{profile}</>;
 const safeRows=rows.map(record),toggleSort=()=>{setOrder(order==="asc"?"desc":"asc");setPage(1);};
 return <><section className="children-directory teacher-children-directory"><header className="child-header"><div><p className="eyebrow">People</p><h1>Children</h1><p>Find a child and view their parent or guardian.</p></div></header><section className="child-tools"><label className="child-search"><FiSearch aria-hidden="true"/><input aria-label="Search children" placeholder="Search by child or guardian…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label></section><div className="directory-results-heading"><div><p className="children-count" role="status">{loading?"Updating children…":`${total} ${total===1?"child":"children"}`}</p><p className="directory-results-note">Open a profile to see their details.</p></div><div className="directory-view-controls">{query&&<button className="directory-clear" onClick={()=>{setQuery("");setPage(1);}}>Clear search</button>}<label className="directory-sort"><span>Sort by</span><AppSelect aria-label="Sort children" value={order} onChange={e=>{setOrder(e.target.value);setPage(1);}}><option value="asc">Name: A–Z</option><option value="desc">Name: Z–A</option></AppSelect></label><DataViewToggle value={display} onChange={value=>{setDisplay(value);localStorage.setItem("tpk:children-display",value);}} gridLabel="View children as cards" listLabel="View children as a list"/></div></div>{error?<p className="child-error" role="alert">{error}</p>:<div aria-busy={loading}>{safeRows.length>0&&(display==="GRID"?<ChildrenGrid rows={safeRows} restricted onOpen={id=>setSelected(rows.find(c=>c.id===id)||null)}/>:<ChildrenList rows={safeRows} restricted onOpen={id=>setSelected(rows.find(c=>c.id===id)||null)} sort="name" order={order} onSort={toggleSort} rowOffset={(page-1)*size}/>)}{!loading&&!rows.length&&<section className="directory-empty"><i><FiSearch/></i><h2>{query?"No matching children":"No children registered yet"}</h2><p>{query?"Try another name, or clear your search to see everyone.":"Registered children will appear here."}</p>{query&&<button onClick={()=>{setQuery("");setPage(1);}}>Clear search</button>}</section>}</div>}<DirectoryPagination page={page} total={total} pageSize={size} loading={loading} onPageChange={setPage} onPageSizeChange={s=>{setSize(s);setPage(1);}} noun="children"/></section>{profile}</>;
}

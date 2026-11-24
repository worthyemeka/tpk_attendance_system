"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiMessageCircle, FiSearch, FiSend, FiUsers } from "react-icons/fi";
import { AppSelect } from "./app-dropdown";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import "./family-chat.css";

type Family = {id:number;name:string;lastMessage:string|null;lastSender:string|null;lastSentAt:number|null;unreadCount:number};
type Staff = {id:number;name:string;role:string};
type Message = {id:number;senderId:number|null;recipientId:number|null;senderName:string;recipientName:string;body:string;clientKey:string;sentAt:number};
type History = {family:{id:number;name:string};messages:Message[];hasMore:boolean};
type Draft = {body:string;recipientId:string};
const emptyDraft:Draft={body:"",recipientId:""};
async function chatRequest<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(`${apiBase}/api/v1/family-chats${path}`,{...options,cache:"no-store",headers:{...authHeaders(),...(options.body?{"Content-Type":"application/json"}:{}),...options.headers}});
  const result=await response.json();
  if(!response.ok||!result.success)throw new Error(result.error?.message||"We could not connect to family chat. Please try again.");
  return result.data as T;
}
const timeLabel=(seconds:number)=>new Date(Number(seconds)*1000).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"});

export function FamilyChat() {
  const params=useSearchParams();const router=useRouter();
  const familyId=Math.max(0,Number(params.get("familyId"))||0);
  const [query,setQuery]=useState("");const [page,setPage]=useState(1);
  const [list,setList]=useState<{families:Family[];total:number}>({families:[],total:0});
  const [staff,setStaff]=useState<Staff[]>([]);const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);const [refresh,setRefresh]=useState(0);
  const drafts=useRef(new Map<number,Draft>());
  useEffect(()=>{const controller=new AbortController();chatRequest<Staff[]>("/staff",{signal:controller.signal}).then(setStaff).catch(reason=>{if(!controller.signal.aborted)setError(reason.message);});return()=>controller.abort();},[]);
  useEffect(()=>{
    const controller=new AbortController();let running=false;
    const load=async()=>{if(running)return;running=true;try{const result=await chatRequest<{families:Family[];total:number}>(`?search=${encodeURIComponent(query)}&page=${page}`,{signal:controller.signal});setList(result);setError("");}catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Could not load conversations.");}finally{running=false;if(!controller.signal.aborted)setLoading(false);}};
    setLoading(true);const delay=window.setTimeout(()=>void load(),query?200:0);
    const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},10000);
    return()=>{controller.abort();clearTimeout(delay);clearInterval(timer);};
  },[query,page,refresh]);
  const refreshList=useCallback(()=>setRefresh(value=>value+1),[]);
  return <section className="family-chat-page">
    <header className="family-chat-title"><p className="eyebrow">Staff conversations</p><h1>Family chats</h1><p>Message a teacher and keep each family’s follow-up conversation together.</p></header>
    <p className="chat-visibility"><FiUsers aria-hidden="true"/>Shared with active TPK staff in your campus. Parents cannot access these chats.</p>
    <div className={`family-chat-layout ${familyId?"has-conversation":""}`}>
      <aside className="chat-directory" aria-label="Family conversations">
        <label className="chat-search"><FiSearch aria-hidden="true"/><span className="sr-only">Search families or children</span><input value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}} placeholder="Search family or child…"/></label>
        {error&&<p role="alert" className="chat-error">{error}<button type="button" className="chat-text-action" onClick={refreshList}>Retry</button></p>}
        {loading&&<p role="status" className="chat-hint">Loading conversations…</p>}
        <div className="chat-family-list">{list.families.map(family=><Link key={family.id} href={`/account/messages?familyId=${family.id}`} aria-current={Number(family.id)===familyId?"page":undefined} className={Number(family.id)===familyId?"selected":""}>
          <span className="chat-family-avatar" aria-hidden="true">{family.name.slice(0,1).toUpperCase()}</span><span className="chat-family-copy"><strong>{family.name} Family</strong><small>{family.lastMessage?`${family.lastSender}: ${family.lastMessage}`:"Start a staff conversation"}</small></span>
          {Number(family.unreadCount)>0&&<span className="chat-unread" aria-label={`${family.unreadCount} unread messages`}>{family.unreadCount}</span>}
        </Link>)}</div>
        {!loading&&!list.families.length&&<p className="chat-hint">No families match your search.</p>}
        {list.total>40&&<nav className="chat-pagination" aria-label="Family conversation pages"><button disabled={page===1} onClick={()=>setPage(value=>value-1)}>Previous</button><span>{page} / {Math.ceil(list.total/40)}</span><button disabled={page*40>=list.total} onClick={()=>setPage(value=>value+1)}>Next</button></nav>}
      </aside>
      {familyId?<FamilyConversation key={familyId} familyId={familyId} staff={staff} initialDraft={drafts.current.get(familyId)||emptyDraft} onDraft={draft=>drafts.current.set(familyId,draft)} onRead={refreshList} onBack={()=>router.push("/account/messages")}/>:<div className="chat-welcome"><FiMessageCircle aria-hidden="true"/><h2>A shared place to follow up</h2><p>Choose a family, select a teacher and send your first message. Your conversation will stay with the family’s record.</p></div>}
    </div>
  </section>;
}

function FamilyConversation({familyId,staff,initialDraft,onDraft,onRead,onBack}:{familyId:number;staff:Staff[];initialDraft:Draft;onDraft:(draft:Draft)=>void;onRead:()=>void;onBack:()=>void}) {
  const [history,setHistory]=useState<History|null>(null);const [draft,setDraft]=useState(initialDraft);
  const [error,setError]=useState("");const [sending,setSending]=useState(false);const [loadingOlder,setLoadingOlder]=useState(false);
  const [status,setStatus]=useState("");const [retry,setRetry]=useState(0);
  const scroll=useRef<HTMLDivElement>(null);const loaded=useRef(false);const lastRead=useRef(0);
  const pending=useRef<{fingerprint:string;key:string}|null>(null);
  const self=Number(readTeacherSession()?.staffUserId);
  const updateDraft=(next:Draft)=>{setDraft(next);onDraft(next);};
  useEffect(()=>{
    const controller=new AbortController();let running=false;
    const load=async()=>{
      if(running)return;running=true;
      try{
        const data=await chatRequest<History>(`/${familyId}`,{signal:controller.signal});
        const atBottom=!loaded.current||!scroll.current||scroll.current.scrollHeight-scroll.current.scrollTop-scroll.current.clientHeight<100;
        setHistory(previous=>{if(!previous)return data;const merged=new Map(previous.messages.map(message=>[Number(message.id),message]));data.messages.forEach(message=>merged.set(Number(message.id),message));return {...previous,family:data.family,messages:[...merged.values()].sort((a,b)=>Number(a.id)-Number(b.id))};});
        setError("");loaded.current=true;
        if(atBottom)requestAnimationFrame(()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;});
        const latest=Number(data.messages.at(-1)?.id||0);
        if(document.visibilityState==="visible"&&latest>lastRead.current){await chatRequest(`/${familyId}/read`,{method:"POST",signal:controller.signal,body:JSON.stringify({lastMessageId:latest})});lastRead.current=latest;onRead();}
      }catch(reason){if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Could not load messages.");}finally{running=false;}
    };
    void load();const timer=window.setInterval(()=>{if(document.visibilityState==="visible")void load();},8000);
    return()=>{controller.abort();clearInterval(timer);};
  },[familyId,onRead,retry]);
  async function older(){
    if(!history?.messages.length||loadingOlder)return;setLoadingOlder(true);
    try{const data=await chatRequest<History>(`/${familyId}?before=${history.messages[0].id}`);const height=scroll.current?.scrollHeight||0;setHistory(previous=>previous?{...previous,hasMore:data.hasMore,messages:[...data.messages,...previous.messages]}:data);requestAnimationFrame(()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight-height;});}catch(reason){setError(reason instanceof Error?reason.message:"Could not load earlier messages.");}finally{setLoadingOlder(false);}
  }
  async function send(event:React.FormEvent){
    event.preventDefault();if(sending||!draft.body.trim()||!draft.recipientId)return;
    const body=draft.body.trim();const recipientId=Number(draft.recipientId);const fingerprint=JSON.stringify([body,recipientId]);
    if(pending.current?.fingerprint!==fingerprint)pending.current={fingerprint,key:crypto.randomUUID()};
    setSending(true);setError("");setStatus("");
    try{await chatRequest(`/${familyId}/messages`,{method:"POST",body:JSON.stringify({body,recipientId,clientKey:pending.current.key})});updateDraft({...draft,body:""});pending.current=null;setStatus("Message sent.");setRetry(value=>value+1);onRead();}
    catch(reason){setError(reason instanceof Error?reason.message:"Message not sent. Your draft is still here; please retry.");}
    finally{setSending(false);}
  }
  const teachers=staff.filter(person=>Number(person.id)!==self);
  return <section className="chat-conversation" aria-label="Selected family conversation">
    <header className="chat-conversation-header"><button type="button" className="chat-back" onClick={onBack} aria-label="Back to families"><FiArrowLeft/></button><div><p className="eyebrow">Family conversation</p><h2>{history?`${history.family.name} Family`:"Loading family…"}</h2><small>Staff only · Messages stay in this family’s history</small></div></header>
    {error&&<p className="chat-error" role="alert">{error} <button className="chat-text-action" type="button" onClick={()=>setRetry(value=>value+1)}>Refresh conversation</button></p>}
    <div className="chat-message-list" ref={scroll} aria-label="Messages">
      {history?.hasMore&&<button className="chat-text-action chat-earlier" disabled={loadingOlder} onClick={()=>void older()}>{loadingOlder?"Loading…":"Load earlier messages"}</button>}
      {!history&&!error&&<p role="status">Loading messages…</p>}
      {history&&!history.messages.length&&<p className="chat-empty">No messages yet. Share an update or ask a teacher about this family.</p>}
      {history?.messages.map(message=><article key={message.id} className={`chat-message ${Number(message.senderId)===self?"mine":""}`}><header><strong>{Number(message.senderId)===self?"You":message.senderName}</strong><span>to {Number(message.recipientId)===self?"you":message.recipientName}</span></header><p>{message.body}</p><time dateTime={new Date(Number(message.sentAt)*1000).toISOString()}>{timeLabel(message.sentAt)}</time></article>)}
    </div>
    <form className="chat-composer" onSubmit={send}>
      <label>Message to<AppSelect aria-label="Teacher to notify" value={draft.recipientId} onChange={event=>updateDraft({...draft,recipientId:event.target.value})} disabled={sending||!history} required><option value="">Choose a teacher…</option><optgroup label="Follow-Up Leads">{teachers.filter(person=>person.role==="TPK_FOLLOW_UP_ADMIN").map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</optgroup><optgroup label="Teachers & Super Admins">{teachers.filter(person=>person.role!=="TPK_FOLLOW_UP_ADMIN").map(person=><option key={person.id} value={person.id}>{person.name}</option>)}</optgroup></AppSelect></label>
      <label><span className="sr-only">Your message</span><textarea value={draft.body} onChange={event=>updateDraft({...draft,body:event.target.value})} placeholder="Write an update or question about this family…" maxLength={4000} required disabled={sending||!history}/></label>
      <footer><small>{draft.body.length}/4,000 · Your selected teacher receives an in-app notification.</small><button className="primary" disabled={sending||!history||!draft.body.trim()||!draft.recipientId} type="submit"><FiSend aria-hidden="true"/>{sending?"Sending…":"Send message"}</button></footer>
      <p className="chat-status" role="status">{status}</p>
    </form>
  </section>;
}

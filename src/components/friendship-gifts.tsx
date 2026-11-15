"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FiCheck, FiCopy, FiGift, FiHeart, FiMessageCircle, FiRefreshCw, FiUsers } from "react-icons/fi";
import { AppSelect } from "@/components/app-dropdown";
import { FriendshipPairings } from "./friendship-pairings";
import { apiBase, authHeaders, mediaUrl, readTeacherSession } from "@/lib/session";
import "./friendship-gifts.css";

type Person={id:number;name:string;profileImageUrl?:string|null;revealedAt?:string|null};
type Recipient=Pick<Person,"name"|"profileImageUrl">&{id?:number;message?:string;whatsappUrl?:string|null};
type Round={id:number;title:string;serviceDate:string;status:"DRAFT"|"OPEN"|"CLOSED"};
type Data={rounds:Round[];round:Round|null;participants?:Person[];eligible:Person[];participating?:boolean;recipient?:Recipient|null;canManage:boolean};
const colours=["#174c71","#e5edf1","#2d7198","#f5d9aa","#3f6175","#d9e8dd"];
const initials=(name:string)=>name.split(/\s+/).filter(word=>!['Uncle','Auntie','Aunty'].includes(word)).slice(0,2).map(word=>word[0]).join("");
const dayLabel=(date:string)=>new Intl.DateTimeFormat("en-NG",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"Africa/Lagos"}).format(new Date(`${date}T12:00:00+01:00`));

export function FriendshipGifts(){
  const [data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[spinning,setSpinning]=useState(false),[result,setResult]=useState<Recipient|null>(null);
  const [rotation,setRotation]=useState(0),[title,setTitle]=useState("Friendship Sunday gift exchange"),[date,setDate]=useState("2026-10-18"),[chosen,setChosen]=useState<number[]>([]);
  const [copyStatus,setCopyStatus]=useState("");
  const [view,setView]=useState<"draw"|"pairings">("draw");
  const [session]=useState(()=>readTeacherSession());const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const round=data?.round;
  const load=useCallback(async(id?:number)=>{
    const response=await fetch(`${apiBase}/api/v1/friendship-gifts${id?`/${id}`:""}`,{headers:authHeaders(),cache:"no-store"});const json=await response.json();
    if(!response.ok||!json.success)throw new Error(json.error?.message||"We could not load the gift draw.");
    const next=json.data as Data;setData(next);setResult(next.recipient||null);
    setTitle(next.round?.title||"Friendship Sunday gift exchange");setDate(next.round?.serviceDate||"2026-10-18");setChosen((next.participants?.length?next.participants:next.eligible).map(person=>Number(person.id)));
    const wheelPeople=(next.participants||[]).filter(person=>person.id!==readTeacherSession()?.staffUserId);const index=wheelPeople.findIndex(person=>Number(person.id)===Number(next.recipient?.id));setRotation(index>=0?360-(index+.5)*360/wheelPeople.length:0);
  },[]);
  useEffect(()=>{const requested=Number(new URLSearchParams(window.location.search).get("roundId"));load(Number.isSafeInteger(requested)&&requested>0?requested:undefined).catch(reason=>setError(reason.message));return()=>{if(timer.current)clearTimeout(timer.current);};},[load]);
  async function copyMessage(){
    if(!result?.message)return;
    try{await navigator.clipboard.writeText(result.message);setCopyStatus("Message copied.");}catch{setCopyStatus("Select the message below to copy it.");}
  }
  const candidates=(data?.participants||[]).filter(person=>person.id!==session?.staffUserId);
  const gradient=candidates.length?`conic-gradient(${candidates.map((_,i)=>`${colours[i%colours.length]} ${i*360/candidates.length}deg ${(i+1)*360/candidates.length}deg`).join(",")})`:"conic-gradient(#174c71 0deg 90deg,#e5edf1 90deg 180deg,#2d7198 180deg 270deg,#f5d9aa 270deg)";
  async function request(path:string,payload:object={}){
    const response=await fetch(`${apiBase}/api/v1/friendship-gifts${path}`,{method:path===""?"POST":path.endsWith("open")||path.endsWith("spin")||path.endsWith("close")?"POST":"PUT",headers:{...authHeaders(),"Content-Type":"application/json"},body:JSON.stringify(payload)});const json=await response.json();if(!response.ok||!json.success)throw new Error(json.error?.message||"We could not save this gift draw.");return json.data;
  }
  async function spin(){
    if(!round||busy||spinning||result)return;setBusy(true);setError("");
    try{
      const saved=await request(`/${round.id}/spin`);const person=saved.recipient as Recipient;
      const index=candidates.findIndex(candidate=>Number(candidate.id)===Number(person.id));const centre=(Math.max(index,0)+.5)*360/Math.max(candidates.length,1);
      const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;setSpinning(true);setRotation(360*6+360-centre);
      timer.current=setTimeout(()=>{setResult(person);setSpinning(false);setBusy(false);timer.current=null;},reduced?20:5100);
    }catch(reason){setError(reason instanceof Error?reason.message:"Please try again.");setBusy(false);}
  }
  async function manage(action:"save"|"open"|"close"){
    if(busy||spinning)return;setBusy(true);setError("");
    try{const saved=await request(action==="save"?(round?`/${round.id}`:""):`/${round?.id}/${action}`,action==="save"?{title,serviceDate:date,participantIds:chosen}:{});await load(Number(saved.id||round?.id));}
    catch(reason){setError(reason instanceof Error?reason.message:"Please try again.");}finally{setBusy(false);}
  }
  const completed=(data?.participants||[]).filter(person=>person.revealedAt).length;
  function tabKey(event:React.KeyboardEvent<HTMLButtonElement>){
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)||spinning)return;
    event.preventDefault();const next=event.key==="Home"?"draw":event.key==="End"?"pairings":view==="draw"?"pairings":"draw";setView(next);document.getElementById(`friendship-tab-${next}`)?.focus();
  }
  return <div className="friendship-workspace">
    <header className="friendship-heading"><div><p className="eyebrow">Our TPK family</p><h1>Denim, friends &amp; a little surprise.</h1><p>A thoughtful gift. A familiar face. A little more friendship.</p></div><span className="friendship-mark" aria-hidden="true"><FiHeart/></span></header>
    {error&&<div className="friendship-error" role="alert">{error}<button type="button" className="text-action" disabled={busy} onClick={()=>{setError("");load(round?.id).catch(reason=>setError(reason.message));}}>Try again</button></div>}
    {!data&&!error?<p role="status">Getting your gift draw ready…</p>:data&&<>
      {data.rounds.length>1&&<label className="friendship-round-picker">Gift exchange<AppSelect value={round?.id||""} disabled={busy||spinning} onChange={event=>load(Number(event.target.value)).catch(reason=>setError(reason.message))}>{data.rounds.map(item=><option key={item.id} value={item.id}>{item.title} · {item.serviceDate}</option>)}</AppSelect></label>}
      {round?<>
        {data.canManage&&<div className="friendship-tabs" role="tablist" aria-label="Friendship Sunday views">{([['draw','My draw'],['pairings','All pairings']] as const).map(([key,label])=><button key={key} id={`friendship-tab-${key}`} type="button" role="tab" aria-selected={view===key} aria-controls={`friendship-panel-${key}`} tabIndex={view===key?0:-1} disabled={spinning} data-theme-control="surface" onKeyDown={tabKey} onClick={()=>setView(key)}>{label}</button>)}</div>}
        {data.canManage&&view==="pairings"?<div id="friendship-panel-pairings" role="tabpanel" aria-labelledby="friendship-tab-pairings"><FriendshipPairings key={round.id} roundId={round.id}/></div>:<div id="friendship-panel-draw" role={data.canManage?"tabpanel":undefined} aria-labelledby={data.canManage?"friendship-tab-draw":undefined}>
        <aside className="friendship-gift-grace"><FiHeart aria-hidden="true"/><div><h2>A little grace for gift-giving</h2><p>This is short notice, so no pressure to have your gift ready on Friendship Sunday. You can give it the following week or any time before the end of {new Intl.DateTimeFormat('en-NG',{month:'long',year:'numeric',timeZone:'Africa/Lagos'}).format(new Date(`${round.serviceDate}T12:00:00+01:00`))}. A thoughtful gift matters more than the timing.</p></div></aside>
        <section className="friendship-stage panel">
        <div className="friendship-wheel-area"><span className="friendship-pointer" aria-hidden="true"/><div className={`friendship-wheel ${spinning?"is-spinning":""}`} style={{background:gradient,transform:`rotate(${rotation}deg)`}} aria-hidden="true">
          {candidates.map((person,index)=>{const angle=(index+.5)*360/candidates.length;return <span key={person.id} className="friendship-wheel-name" style={{transform:`rotate(${angle}deg) translateY(calc(var(--wheel-size) * -.35)) rotate(90deg)`,color:index%colours.length===0||index%colours.length===2||index%colours.length===4?"#fff":"#17394b"}}>{candidates.length>28?initials(person.name):person.name.replace(/^(Uncle|Auntie|Aunty)\s+/i,"").split(" ").slice(0,2).join(" ")}</span>;})}
          <div className="friendship-wheel-centre"><FiGift/></div></div><p><FiUsers/> {(data.participants||[]).length} teachers · one gift each</p></div>
        <div className="friendship-draw-copy"><span className="friendship-date">{dayLabel(round.serviceDate)}</span><h2>{round.title}</h2><p>Spin the wheel to find the teammate you’ll buy a gift for. Everyone gives to one person, and everyone receives from one person.</p>
          {result?<div className="friendship-result"><span className="friendship-result-label" role="status"><FiCheck/> Your gift is for</span>{result.profileImageUrl&&<img src={mediaUrl(result.profileImageUrl)} alt="" width={64} height={64}/>}<h3>{result.name}</h3><p>Choose something thoughtful for your bestie, at a time that works for you. Your one draw is saved—this person won’t change.</p>
            {result.message&&<div className="friendship-message"><h4>Say hello to your Sunday bestie</h4><blockquote>{result.message}</blockquote><div className="friendship-message-actions">{result.whatsappUrl&&<a className="solid-button" href={result.whatsappUrl} target="_blank" rel="noopener noreferrer"><FiMessageCircle/> Message on WhatsApp</a>}<button type="button" className="text-action" onClick={copyMessage}><FiCopy/> Copy message</button></div><p className="friendship-message-help">{result.whatsappUrl?"WhatsApp opens with this message ready. Tap Send when you’re happy with it.":"No valid WhatsApp number is saved for this teacher yet. Copy the message and send it to them, or ask a Super Admin to help."}</p><span className="friendship-copy-status" role="status">{copyStatus}</span></div>}
          </div>:round.status==="OPEN"&&data.participating?<><button type="button" className="solid-button friendship-spin" onClick={spin} disabled={busy||spinning}><FiRefreshCw/>{spinning?"Finding your friendship surprise…":busy?"Getting your spin ready…":"Spin & reveal my person"}</button><small>One spin per teacher. Your person is saved, even if you refresh or sign in again.</small></>:<div className="friendship-notice">{round.status==="DRAFT"?"The team is getting this draw ready. Come back once it opens.":round.status==="CLOSED"?"This gift draw has closed.":"You’re not on this participant list. Contact a Super Admin if you’d like to take part."}</div>}
          <div className="friendship-rules"><b>A little friendship etiquette</b><p>No swapping or repeat draws. Pick with care, say hello to your bestie, and follow any gift guidance shared by the team.</p></div>
        </div>
      </section></div>}</>:<div className="panel friendship-empty"><FiGift/><h2>A little surprise is on its way</h2><p>Your next Friendship Sunday gift draw will appear here once it’s set up.</p></div>}
      {data.canManage&&view==="draw"&&<details className="panel friendship-admin"><summary>Manage gift exchange <span>{round?.status==="OPEN"||round?.status==="CLOSED"?`${completed} of ${data.participants?.length||0} revealed`:"Super Admin"}</span></summary>
        {!round||round.status==="DRAFT"?<form onSubmit={event=>{event.preventDefault();manage("save");}}><div className="friendship-admin-fields"><label>Exchange name<input required maxLength={150} value={title} onChange={event=>setTitle(event.target.value)} disabled={busy}/></label><label>Friendship Sunday<input required type="date" value={date} onChange={event=>setDate(event.target.value)} disabled={busy}/></label></div><h3>Who’s taking part?</h3><p>Choose active teachers, including Super Admins and teachers on probation. Opening the draw locks the list and creates everyone’s gift pairing.</p><div className="friendship-people">{data.eligible.map(person=><label key={person.id}><input type="checkbox" disabled={busy} checked={chosen.includes(Number(person.id))} onChange={event=>setChosen(current=>event.target.checked?[...current,Number(person.id)]:current.filter(id=>id!==Number(person.id)))}/><span>{person.name}</span></label>)}</div><div className="friendship-admin-actions"><button className="outline-button" disabled={busy||chosen.length<2} type="submit">Save {chosen.length} participants</button>{round&&<button className="solid-button" type="button" disabled={busy} onClick={()=>manage("open")}>Open saved draw</button>}</div></form>:<><p>The participant list and pairings are locked. Regular teachers can view only their own recipient. Super Admins can use the All pairings tab for the full list and contact details.</p><div className="friendship-progress-list">{(data.participants||[]).map(person=><div key={person.id}><span>{person.name}</span><span>{person.revealedAt?"Revealed":"Yet to spin"}</span></div>)}</div>{round.status==="OPEN"&&<button type="button" className="outline-button" disabled={busy} onClick={()=>manage("close")}>Close draw to new reveals</button>}</>}
      </details>}
    </>}
  </div>;
}

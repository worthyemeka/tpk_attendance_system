"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiArrowRight, FiMail, FiMessageCircle, FiPhone, FiSearch, FiX } from "react-icons/fi";
import { apiBase, authHeaders, mediaUrl } from "@/lib/session";
import { useProfileDialog } from "./use-profile-dialog";
import "./friendship-pairings.css";

type Person={id:number;name:string;profileImageUrl?:string|null};
type Pairing={teacher:Person;bestie:Person|null;revealedAt:string|null};
type Contact=Person&{phoneNumber:string|null;whatsappNumber:string|null;whatsappUrl:string|null;email:string|null};

export function FriendshipPairings({roundId}:{roundId:number}){
  const [pairings,setPairings]=useState<Pairing[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const [query,setQuery]=useState(""),[retry,setRetry]=useState(0),[selected,setSelected]=useState<Person|null>(null);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");setPairings([]);setSelected(null);
    fetch(`${apiBase}/api/v1/friendship-gifts/${roundId}/pairings`,{headers:authHeaders(),cache:"no-store",signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error?.message||"We couldn’t load the friendship pairings.");if(!controller.signal.aborted)setPairings(body.data.pairings||[]);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Please try again.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[roundId,retry]);
  const visible=pairings.filter(pair=>`${pair.teacher.name} ${pair.bestie?.name||""}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const personButton=(person:Person)=><button type="button" className="friendship-person-link" data-theme-control="surface" aria-label={`Contact ${person.name}`} onClick={()=>setSelected(person)}>{person.profileImageUrl?<img src={mediaUrl(person.profileImageUrl)} alt="" width={38} height={38}/>:<span className="friendship-person-initials" aria-hidden="true">{person.name.split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("")}</span>}<span>{person.name}</span><FiArrowRight aria-hidden="true"/></button>;
  return <section className="friendship-pairings panel">
    <header><div><p className="eyebrow">Super Admin only</p><h2>Teachers &amp; their Sunday besties</h2><p>Each teacher is shown beside the person they’re buying a gift for. Tap either name to see their contact details.</p></div><span>{loading?"Loading…":`${pairings.length} teachers`}</span></header>
    <p className="friendship-pairing-note">A teacher’s randomly assigned bestie appears here only after that teacher spins the wheel. Until then, their match stays hidden—even from Super Admins. Viewing this list never uses anyone’s spin or changes a match.</p>
    <label className="friendship-pairing-search"><FiSearch aria-hidden="true"/><input type="search" aria-label="Search teacher or bestie" placeholder="Search teacher or bestie…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    {loading?<p role="status">Loading saved pairings…</p>:error?<div className="friendship-pairing-error" role="alert"><p>{error}</p><button type="button" className="outline-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:<>
      <div className="friendship-pairing-table-wrap"><table className="friendship-pairing-table"><thead><tr><th scope="col">Teacher</th><th scope="col">Assigned bestie · gift recipient</th><th scope="col">Draw</th></tr></thead><tbody>{visible.map(pair=><tr key={pair.teacher.id}><td data-label="Teacher">{personButton(pair.teacher)}</td><td data-label="Assigned bestie">{pair.revealedAt&&pair.bestie?personButton(pair.bestie):<span className="friendship-unassigned">Yet to spin</span>}</td><td data-label="Draw"><span className="friendship-draw-status">{pair.revealedAt?"Revealed":"Yet to spin"}</span></td></tr>)}</tbody></table></div>
      {!visible.length&&<p className="friendship-pairing-empty">{query.trim()?"No teachers or besties match your search.":"No participants have been saved for this gift exchange yet."}</p>}
    </>}
    {selected&&<FriendshipContact key={`${roundId}:${selected.id}`} roundId={roundId} person={selected} close={()=>setSelected(null)}/>}
  </section>;
}

function FriendshipContact({roundId,person,close}:{roundId:number;person:Person;close:()=>void}){
  const [contact,setContact]=useState<Contact|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  useProfileDialog(close,".friendship-contact-dialog");
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError("");setContact(null);
    fetch(`${apiBase}/api/v1/friendship-gifts/${roundId}/contacts/${person.id}`,{headers:authHeaders(),cache:"no-store",signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error?.message||"We couldn’t load this teacher’s contact details.");if(!controller.signal.aborted)setContact(body.data);})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Please try again.");})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[roundId,person.id,retry]);
  const phone=contact?.phoneNumber,tel=phone?.replace(/[^+\d]/g,"");
  return createPortal(<div className="friendship-contact-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)close();}}><section className="friendship-contact-dialog panel" role="dialog" aria-modal="true" aria-labelledby="friendship-contact-name">
    <button type="button" className="friendship-contact-close" aria-label="Close teacher contact" onClick={close}><FiX/></button><p className="eyebrow">Teacher contact · Super Admin</p>
    {person.profileImageUrl&&<img className="friendship-contact-photo" src={mediaUrl(person.profileImageUrl)} alt="" width={64} height={64}/>}<h2 id="friendship-contact-name">{person.name}</h2>
    {loading?<p role="status">Loading contact details…</p>:error?<div role="alert"><p>{error}</p><button type="button" className="outline-button" onClick={()=>setRetry(value=>value+1)}>Try again</button></div>:<dl className="friendship-contact-details">
      <div><dt><FiPhone/>Phone number</dt><dd>{phone&&tel?<a href={`tel:${tel}`}>{phone}</a>:"Not recorded"}</dd></div>
      <div><dt><FiMessageCircle/>WhatsApp</dt><dd>{contact?.whatsappUrl?<a href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer">{contact.whatsappNumber}</a>:"Not recorded"}</dd></div>
      <div><dt><FiMail/>Email address</dt><dd>{contact?.email?<a href={`mailto:${contact.email}`}>{contact.email}</a>:"Not recorded"}</dd></div>
    </dl>}
  </section></div>,document.body);
}

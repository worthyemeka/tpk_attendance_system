"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FiArrowRight, FiGift, FiX } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import "./friendship-welcome.css";

type Prompt={id:number;title:string;serviceDate:string;storageKey:string};
export function FriendshipWelcome(){
  const router=useRouter();const [prompt,setPrompt]=useState<Prompt|null>(null);const dialog=useRef<HTMLElement>(null);const primary=useRef<HTMLButtonElement>(null);
  const dismiss=useCallback(()=>{if(prompt){try{sessionStorage.setItem(prompt.storageKey,"seen");}catch{}}setPrompt(null);},[prompt]);
  useEffect(()=>{
    const session=readTeacherSession();if(!session||session.accessLevel==="EVENT_VOLUNTEER"||window.location.pathname.startsWith("/account/friendship"))return;
    let active=true;
    async function check(){
      try{
        const response=await fetch(`${apiBase}/api/v1/friendship-gifts/prompt`,{headers:authHeaders(session),cache:"no-store"});if(!response.ok)return;
        const json=await response.json();const round=json.success&&json.data?.round;if(!round||!active)return;
        const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(session!.sessionToken));const loginKey=Array.from(new Uint8Array(digest)).slice(0,8).map(value=>value.toString(16).padStart(2,"0")).join("");
        const storageKey=`tpk:friendship-welcome:${session!.staffUserId}:${round.id}:${loginKey}`;
        let seen=false;try{seen=sessionStorage.getItem(storageKey)==="seen";}catch{}
        if(active&&!seen&&!window.location.pathname.startsWith("/account/friendship"))setPrompt({...round,storageKey});
      }catch{/* An optional welcome never blocks the dashboard or sign-in. */}
    }
    void check();return()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!prompt)return;
    const previous=document.activeElement as HTMLElement|null;const overflow=document.body.style.overflow;document.body.style.overflow="hidden";primary.current?.focus();
    const handle=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();dismiss();}
      if(event.key==="Tab"){
        const buttons=dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');if(!buttons?.length)return;const first=buttons[0],last=buttons[buttons.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
    };
    document.addEventListener("keydown",handle);return()=>{document.removeEventListener("keydown",handle);document.body.style.overflow=overflow;previous?.focus();};
  },[prompt,dismiss]);
  if(!prompt)return null;
  return createPortal(<div className="friendship-welcome-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)dismiss();}}><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="friendship-welcome-title" aria-describedby="friendship-welcome-description" className="friendship-welcome panel">
    <button type="button" className="friendship-welcome-close" aria-label="Close friendship invitation" onClick={dismiss}><FiX/></button>
    <div className="friendship-welcome-gift" aria-hidden="true"><FiGift/></div><p className="eyebrow">Denim &amp; Friends</p><h2 id="friendship-welcome-title">Your Sunday bestie is waiting.</h2>
    <p id="friendship-welcome-description">Spin the Friendship Sunday wheel to reveal your person, then say hello on WhatsApp with a little bestie banter.</p><p className="friendship-welcome-once">One spin per teacher. Your result stays saved.</p>
    <button ref={primary} type="button" className="solid-button friendship-welcome-primary" onClick={()=>{const id=prompt.id;dismiss();router.push(`/account/friendship?roundId=${id}`);}}>Take me to the wheel <FiArrowRight/></button>
    <button type="button" className="friendship-welcome-later" data-theme-control="surface" onClick={dismiss}>Maybe later</button>
  </section></div>,document.body);
}

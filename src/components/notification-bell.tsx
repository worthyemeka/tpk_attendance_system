"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {FiBell,FiCheck,FiX} from "react-icons/fi";
import {NotificationItems,useNotifications} from "@/components/notifications-inbox";
export function NotificationBell({serviceSessionId}:{serviceSessionId?:number}){
  const router=useRouter();const root=useRef<HTMLDivElement>(null);const [open,setOpen]=useState(false);
  const inbox=useNotifications(serviceSessionId);
  useEffect(()=>{
    if(!open)return;
    const dismiss=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    const resize=()=>{if(window.matchMedia("(max-width: 590px)").matches)setOpen(false);};
    document.addEventListener("pointerdown",dismiss);document.addEventListener("keydown",escape);window.addEventListener("resize",resize);
    return()=>{document.removeEventListener("pointerdown",dismiss);document.removeEventListener("keydown",escape);window.removeEventListener("resize",resize);};
  },[open]);
  const show=()=>{
    if(window.matchMedia("(max-width: 590px)").matches){setOpen(false);router.push("/account/notifications");}
    else setOpen(value=>!value);
  };
  return <div className="notification-wrap" ref={root}>
    <button className="notification-button" type="button" aria-label="Open notifications" aria-expanded={open} onClick={show}><FiBell/>{inbox.unread>0&&<b>{inbox.unread>99?"99+":inbox.unread}</b>}</button>
    {open&&<section className="notification-popover" aria-label="Notifications"><header className="notification-heading"><div><strong>Notifications</strong><span>{inbox.loading?"Loading…":inbox.unread?inbox.unread+" unread":"You’re up to date"}</span></div>{inbox.unread>0&&<button type="button" onClick={inbox.markAllRead}><FiCheck/>Mark all read</button>}<button type="button" className="notification-close" aria-label="Close notifications" onClick={()=>setOpen(false)}><FiX/></button></header><NotificationItems inbox={inbox} onNavigate={()=>setOpen(false)}/></section>}
  </div>;
}

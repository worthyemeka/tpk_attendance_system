"use client";
import {useEffect,useRef} from "react";
// Keep keyboard navigation and scroll inside the open profile, including on phones.
export function useProfileDialog(close:()=>void,selector:string,enabled=true){
  const closeRef=useRef(close);closeRef.current=close;
  useEffect(()=>{
    if(!enabled)return;
    const panel=document.querySelector<HTMLElement>(selector);if(!panel)return;
    const previous=document.activeElement as HTMLElement|null;
    const overflow=document.body.style.overflow;document.body.style.overflow="hidden";
    const focusable=()=>Array.from(panel.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]')).filter(el=>el.getClientRects().length&&!el.matches('[tabindex="-1"],[aria-hidden="true"]'));
    focusable()[0]?.focus({preventScroll:true});
    const keydown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();closeRef.current();return;}
      if(event.key!=="Tab")return;const elements=focusable();const first=elements[0],last=elements.at(-1);
      if(!first){event.preventDefault();return;}
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener("keydown",keydown);
    return()=>{document.removeEventListener("keydown",keydown);document.body.style.overflow=overflow;if(previous?.isConnected)previous.focus({preventScroll:true});else if(selector===".sidebar.mobile-open")document.querySelector<HTMLButtonElement>(".mobile-nav-toggle")?.focus({preventScroll:true});};
  },[selector,enabled]);
}

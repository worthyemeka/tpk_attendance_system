"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown } from "react-icons/fi";

type Choice = { label: string; value: string; disabled: boolean };

function Dropdown({ select }: { select: HTMLSelectElement }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(select.value);
  const root = useRef<HTMLDivElement>(null);
  const choices: Choice[] = Array.from(select.options).map((option) => ({ label: option.text, value: option.value, disabled: option.disabled }));

  useEffect(() => {
    const sync = () => setValue(select.value);
    const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    select.addEventListener("change", sync);
    document.addEventListener("mousedown", close);
    return () => { select.removeEventListener("change", sync); document.removeEventListener("mousedown", close); };
  }, [select]);

  const choose = (next: string) => {
    select.value = next;
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    setValue(next);
    setOpen(false);
  };
  const current = choices.find((choice) => choice.value === value)?.label || choices[0]?.label || "Select an option";

  return <div className="app-dropdown" ref={root}>
    <button aria-expanded={open} aria-haspopup="listbox" className="app-dropdown-trigger" onClick={() => setOpen((shown) => !shown)} type="button"><span>{current}</span><FiChevronDown /></button>
    {open && <div className="app-dropdown-menu" role="listbox">{choices.map((choice) => <button aria-selected={choice.value === value} className={choice.value === value ? "selected" : ""} disabled={choice.disabled} key={`${choice.value}-${choice.label}`} onClick={() => choose(choice.value)} role="option" type="button"><span>{choice.label}</span>{choice.value === value && <FiCheck />}</button>)}</div>}
  </div>;
}

/** Turns every ordinary select into the same accessible in-app menu. Add data-dropdown-native to opt out. */
export function GlobalDropdowns() {
  const [selects, setSelects] = useState<HTMLSelectElement[]>([]);
  const known = useRef(new WeakSet<HTMLSelectElement>());

  useEffect(() => {
    let observer: MutationObserver | null = null;
    const discover = () => {
      const next = Array.from(document.querySelectorAll<HTMLSelectElement>("select:not([data-dropdown-native])"))
        // Teacher registration is a streamed Suspense boundary. Do not insert a
        // portal into it while React is hydrating; native selects are reliable
        // and keep the country-code control accessible on every device.
        .filter((select) => !select.closest(".teacher-auth-page"))
        .filter((select) => select.isConnected && !known.current.has(select));
      if (!next.length) return;
      next.forEach((select) => { known.current.add(select); select.dataset.appDropdown = "true"; });
      setSelects((current) => [...current.filter((select) => select.isConnected), ...next]);
    };
    const timer = window.setTimeout(() => {
      discover();
      observer = new MutationObserver(discover);
      observer.observe(document.body, { childList: true, subtree: true });
    }, 0);
    return () => { window.clearTimeout(timer); observer?.disconnect(); };
  }, []);

  return <>{selects.map((select, index) => select.parentElement && createPortal(<Dropdown key={`${select.name}-${index}`} select={select} />, select.parentElement))}
    <style jsx global>{`
      select[data-app-dropdown="true"]{opacity:0!important;pointer-events:none!important}
      label:has(>select[data-app-dropdown="true"]),.app-dropdown-host{position:relative}
      .app-dropdown{position:absolute;inset:auto 0 0;z-index:12;height:calc(100% - 20px);min-height:42px}
      .app-dropdown-trigger{width:100%;height:100%;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #cfd7e3;border-radius:9px;padding:0 13px;background:#fff;color:#10213d;font:inherit;text-align:left;cursor:pointer}
      .app-dropdown-trigger svg{flex:0 0 auto;color:#557098;transition:transform .16s ease}
      .app-dropdown:has([aria-expanded="true"]) .app-dropdown-trigger{border-color:#ef4c29;box-shadow:0 0 0 3px rgba(239,76,41,.1)}
      .app-dropdown:has([aria-expanded="true"]) .app-dropdown-trigger svg{transform:rotate(180deg)}
      .app-dropdown-menu{position:absolute;z-index:50;top:calc(100% + 7px);right:0;left:0;display:grid;overflow:auto;max-height:230px;border:1px solid #d6deea;border-radius:10px;padding:5px;background:#fff;box-shadow:0 14px 32px rgba(12,29,58,.18)}
      .app-dropdown-menu button{display:flex;align-items:center;justify-content:space-between;gap:12px;border:0;border-radius:7px;padding:10px 11px;background:transparent;color:#132642;font:inherit;text-align:left;cursor:pointer}
      .app-dropdown-menu button:hover,.app-dropdown-menu button.selected{background:#fff1ec;color:#e54829}.app-dropdown-menu button:disabled{opacity:.48;cursor:not-allowed}
    `}</style></>;
}

export const TeacherDropdownUpgrade = GlobalDropdowns;

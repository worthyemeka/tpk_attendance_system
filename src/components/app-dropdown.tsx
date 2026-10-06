"use client";

import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import "./app-dropdown.css";

type Choice = { label: string; value: string; disabled: boolean };

/** Native select remains the form/validation authority. Explicit mounting is safe
 * in streamed pages and drawers, without inserting portals into React's DOM. */
export const AppSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function AppSelect(props, forwardedRef) {
  const { children, onChange, onInvalid, onFocus, ...attributes } = props;
  const select = useRef<HTMLSelectElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Choice[]>([]);
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [active, setActive] = useState(0);
  const [fieldStyle, setFieldStyle] = useState<CSSProperties>({});
  const [position, setPosition] = useState<CSSProperties>({});
  const typeahead = useRef({ text: "", at: 0 });

  useLayoutEffect(() => {
    const field = select.current;
    if (!field) return;
    const next = Array.from(field.options).map(option => ({ label: option.text, value: option.value, disabled: option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled) }));
    setChoices(current => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    setValue(field.value);
    setLabel(props["aria-label"] || Array.from(field.labels || []).map(item => {
      const copy = item.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("select,button,input,textarea,.app-dropdown-trigger").forEach(control => control.remove());
      return copy.textContent?.trim();
    }).filter(Boolean).join(" ") || field.name || "Select an option");
    const resize = () => {
      const css = getComputedStyle(field);
      const nextStyle = { height: field.offsetHeight, font: css.font, borderRadius: css.borderRadius, paddingLeft: css.paddingLeft, marginTop: css.marginTop, marginBottom: css.marginBottom };
      setFieldStyle(current => JSON.stringify(current) === JSON.stringify(nextStyle) ? current : nextStyle);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(field);
    return () => observer.disconnect();
  }, [props]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = trigger.current?.getBoundingClientRect();
      if (!box) return;
      const below = window.innerHeight - box.bottom - 14, above = box.top - 14;
      const upwards = below < 180 && above > below;
      const width = Math.min(Math.max(box.width, 180), window.innerWidth - 24);
      setPosition({ position: "fixed", width, left: Math.max(12, Math.min(box.left, window.innerWidth - width - 12)), maxHeight: Math.max(80, Math.min(280, upwards ? above : below)), ...(upwards ? { bottom: window.innerHeight - box.top + 6 } : { top: box.bottom + 6 }) });
    };
    const outside = (event: PointerEvent) => { if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false); };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); document.removeEventListener("pointerdown", outside); };
  }, [open]);
  useEffect(() => { if (open) optionRefs.current[active]?.focus({ preventScroll: true }); }, [open, active]);
  useEffect(() => { if (props.disabled) setOpen(false); }, [props.disabled]);

  const choose = (index: number) => {
    const choice = choices[index], field = select.current;
    if (!field || !choice || choice.disabled || field.disabled) return;
    field.value = choice.value;
    // React restores controlled selects after input events. Notify change first,
    // otherwise that restoration can discard the choice before onChange sees it.
    field.dispatchEvent(new Event("change", { bubbles: true }));
    field.dispatchEvent(new Event("input", { bubbles: true }));
    setValue(field.value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };
  const move = (direction: number) => {
    let next = active;
    for (let n = 0; n < choices.length; n++) { next = (next + direction + choices.length) % choices.length; if (!choices[next].disabled) { setActive(next); break; } }
  };
  const reveal = () => {
    setActive(Math.max(0, choices.findIndex(choice => choice.value === value && !choice.disabled)));
    setOpen(true);
  };
  const selected = choices.find(choice => choice.value === value)?.label || "Choose an option";
  return <span className={`app-select${props.disabled ? " is-disabled" : ""}`}>
    <select {...attributes} ref={node => { select.current = node; if (typeof forwardedRef === "function") forwardedRef(node); else if (forwardedRef) forwardedRef.current = node; }} data-app-dropdown="true" tabIndex={-1} aria-hidden="true"
      onChange={event => { setValue(event.currentTarget.value); onChange?.(event); }}
      onInvalid={event => { onInvalid?.(event); event.preventDefault(); trigger.current?.focus(); reveal(); }}
      onFocus={event => { onFocus?.(event); trigger.current?.focus(); }}
    >{children}</select>
    <button ref={trigger} type="button" role="combobox" className="app-dropdown-trigger" style={fieldStyle} aria-label={label} aria-labelledby={props["aria-labelledby"]} aria-describedby={props["aria-describedby"]} aria-expanded={open} aria-controls={`${id}-options`} aria-haspopup="listbox" aria-required={props.required} disabled={props.disabled}
      onClick={() => open ? setOpen(false) : reveal()}
      onKeyDown={event => { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) { event.preventDefault(); reveal(); } }}
    ><span>{selected}</span><FiChevronDown aria-hidden="true" /></button>
    {open && createPortal(<div ref={menu} id={`${id}-options`} className="app-dropdown-menu" role="listbox" aria-label={label} style={position}
      onKeyDown={event => {
        if (event.key !== "Tab") event.stopPropagation();
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
        else if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); }
        else if (event.key === "Home" || event.key === "End") { event.preventDefault(); const enabled = choices.map((choice, i) => choice.disabled ? -1 : i).filter(i => i >= 0); setActive(event.key === "Home" ? enabled[0] : enabled[enabled.length - 1]); }
        else if (event.key === "Tab") { setOpen(false); trigger.current?.focus(); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== " ") { const now = Date.now(); typeahead.current = { text: (now - typeahead.current.at < 700 ? typeahead.current.text : "") + event.key.toLowerCase(), at: now }; const next = choices.findIndex(choice => !choice.disabled && choice.label.toLowerCase().startsWith(typeahead.current.text)); if (next >= 0) setActive(next); }
      }}
    >{choices.map((choice, index) => <button ref={node => { optionRefs.current[index] = node; }} key={`${choice.value}-${index}`} type="button" role="option" aria-selected={choice.value === value} disabled={choice.disabled} tabIndex={index === active ? 0 : -1} className={choice.value === value ? "selected" : ""} onClick={() => choose(index)}><span>{choice.label}</span>{choice.value === value && <FiCheck aria-hidden="true" />}</button>)}</div>, document.body)}
  </span>;
});

// Compatibility export for older layouts. Fields now mount their own controls.
export function GlobalDropdowns() { return null; }
export const TeacherDropdownUpgrade = GlobalDropdowns;

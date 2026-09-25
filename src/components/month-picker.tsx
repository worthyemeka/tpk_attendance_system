"use client";

import { useEffect, useRef, useState } from "react";
import { FiCalendar, FiChevronDown, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import "./month-picker.css";

type MonthPickerProps = { value: Date; onChange: (value: Date) => void; className?: string; ariaLabel?: string };

const months = Array.from({ length: 12 }, (_, month) => ({
  month,
  label: new Intl.DateTimeFormat("en-NG", { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month, 1))),
}));
const startOfMonth = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
const labelFor = (value: Date) => new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric", timeZone: "UTC" }).format(value);

export function MonthPicker({ value, onChange, className = "", ariaLabel = "Choose month" }: MonthPickerProps) {
  const selected = startOfMonth(value);
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(selected.getUTCFullYear());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setViewYear(selected.getUTCFullYear()), [selected]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", onKey); };
  }, []);
  const move = (delta: number) => onChange(new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + delta, 1)));
  const selectMonth = (month: number) => { onChange(new Date(Date.UTC(viewYear, month, 1))); setOpen(false); };
  return <div className={`tpk-month-picker ${className}`} ref={ref}>
    <button type="button" className="tpk-month-picker-arrow" aria-label="Previous month" onClick={() => move(-1)}><FiChevronLeft /></button>
    <button type="button" className="tpk-month-picker-trigger" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}><FiCalendar /><strong>{labelFor(selected)}</strong><FiChevronDown className={open ? "open" : ""} /></button>
    <button type="button" className="tpk-month-picker-arrow" aria-label="Next month" onClick={() => move(1)}><FiChevronRight /></button>
    {open && <section className="tpk-month-picker-popover" role="dialog" aria-label="Choose a month"><header><button type="button" aria-label="Previous year" onClick={() => setViewYear((year) => year - 1)}><FiChevronLeft /></button><strong>{viewYear}</strong><button type="button" aria-label="Next year" onClick={() => setViewYear((year) => year + 1)}><FiChevronRight /></button></header><div>{months.map(({ month, label }) => <button type="button" key={label} className={selected.getUTCFullYear() === viewYear && selected.getUTCMonth() === month ? "active" : ""} onClick={() => selectMonth(month)}>{label}</button>)}</div></section>}
  </div>;
}

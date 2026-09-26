"use client";

import { FiCalendar, FiGrid, FiList } from "react-icons/fi";

export type DataView = "GRID" | "LIST" | "CALENDAR";

export function DataViewToggle({
  value,
  onChange,
  gridLabel = "Grid view",
  listLabel = "List view",
  calendarLabel = "Calendar view",
  showCalendar = false,
  compact = false,
}: {
  value: DataView;
  onChange: (value: DataView) => void;
  gridLabel?: string;
  listLabel?: string;
  calendarLabel?: string;
  showCalendar?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`data-view-toggle ${compact ? "compact" : ""}`} role="group" aria-label="Choose record layout">
      <button type="button" className={value === "GRID" ? "active" : ""} aria-pressed={value === "GRID"} aria-label={gridLabel} title={gridLabel} onClick={() => onChange("GRID")}>
        <FiGrid /><span>Grid</span>
      </button>
      <button type="button" className={value === "LIST" ? "active" : ""} aria-pressed={value === "LIST"} aria-label={listLabel} title={listLabel} onClick={() => onChange("LIST")}>
        <FiList /><span>List</span>
      </button>
      {showCalendar && <button type="button" className={value === "CALENDAR" ? "active" : ""} aria-pressed={value === "CALENDAR"} aria-label={calendarLabel} title={calendarLabel} onClick={() => onChange("CALENDAR")}>
        <FiCalendar /><span>Calendar</span>
      </button>}
      <style jsx>{`
        .data-view-toggle{height:44px;display:inline-flex;padding:3px;border:1px solid #d9dfe8;border-radius:8px;background:#fff;gap:2px}
        button{min-width:66px;border:0;border-radius:5px;background:transparent;color:#66758e;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 9px;font:800 11px var(--font-body);cursor:pointer}.compact button{min-width:51px;padding:0 7px}
        button:hover{background:#fff5f0;color:#d94c2c}button.active{background:#fff0e9;color:#df4c2d}button svg{font-size:15px}
        @media(max-width:600px){.data-view-toggle{height:42px}button{min-width:42px;padding:0 8px}button span{display:none}}
      `}</style>
    </div>
  );
}

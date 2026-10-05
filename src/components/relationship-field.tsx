"use client";

import { useId, useState } from "react";
import "./relationship-field.css";

export const validRelationship = (value: string) => Boolean(value.trim() && value !== "Other");

// Store the actual relationship (e.g. Sister), not the display option "Other".
export function RelationshipField({ value, onChange, label = "Relationship to child", required = true }: {
  value: string; onChange: (value: string) => void; label?: string; required?: boolean;
}) {
  const id = useId();
  const [other, setOther] = useState(Boolean(value && !["Father", "Mother"].includes(value)));
  const custom = other || Boolean(value && !["Father", "Mother"].includes(value));
  return <div className="relationship-field">
    <label htmlFor={id}>{label}{required ? " *" : ""}</label>
    <select id={id} data-dropdown-native value={custom ? "Other" : value} required={required} onChange={event => {
      const choice = event.target.value;
      setOther(choice === "Other");
      onChange(choice === "Other" ? "" : choice);
    }}>
      <option value="">Select relationship</option>
      <option>Father</option><option>Mother</option><option>Other</option>
    </select>
    {custom && <div className="relationship-custom">
      <label htmlFor={`${id}-other`}>Your relationship to the child</label>
      <input id={`${id}-other`} required={required} maxLength={60} autoComplete="off" placeholder="e.g. Sister, aunt or grandfather" value={value === "Other" ? "" : value} onChange={event => onChange(event.target.value)} />
      <small>Please tell us how you’re related so the team knows who to expect.</small>
    </div>}
  </div>;
}

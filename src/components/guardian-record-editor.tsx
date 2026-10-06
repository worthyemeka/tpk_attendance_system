"use client";
import { useState, type FormEvent } from "react";
import { FiX } from "react-icons/fi";
import { AppSelect } from "./app-dropdown";
import { useProfileDialog } from "./use-profile-dialog";
import { GUARDIAN_RELATIONSHIPS } from "@/lib/guardian-relationships";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import "./guardian-record-editor.css";

type Record = { id: number; firstName: string; lastName: string; primaryPhone: string; secondaryPhone?: string | null; email?: string | null; relationship: string; homeAddress?: string | null };
export function GuardianRecordEditor({ guardian, cancel, saved }: { guardian: Record; cancel: () => void; saved: () => Promise<void> }) {
  const [values, setValues] = useState({ firstName: guardian.firstName, lastName: guardian.lastName, primaryPhone: guardian.primaryPhone, secondaryPhone: guardian.secondaryPhone || "", email: guardian.email || "", relationship: guardian.relationship || "Guardian", homeAddress: guardian.homeAddress || "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useProfileDialog(cancel, ".guardian-record-editor");
  const change = (key: keyof typeof values, value: string) => setValues(current => ({ ...current, [key]: value }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const session = readTeacherSession();
      if (!session) throw new Error("Please sign in again before saving.");
      const response = await fetch(`${apiBase}/api/v1/guardians/${guardian.id}`, {
        method: "PATCH", headers: { ...authHeaders(session), "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim() || null]))),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message || "The guardian’s details could not be saved.");
      await saved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Please try again."); }
    finally { setBusy(false); }
  }
  const field = (key: keyof typeof values, label: string, type = "text", required = false, maxLength?: number) => <label>{label}<input value={values[key]} onChange={event => change(key, event.target.value)} type={type} required={required} maxLength={maxLength} /></label>;
  return <div className="guardian-editor-backdrop profile-backdrop" onMouseDown={() => { if (!busy) cancel(); }}>
    <form className="guardian-record-editor" role="dialog" aria-modal="true" aria-label="Edit guardian" onSubmit={submit} onMouseDown={event => event.stopPropagation()}>
      <header><small>Edit guardian</small><h2>{guardian.firstName} {guardian.lastName}</h2><p>Update this parent or guardian’s contact details.</p><button type="button" aria-label="Close guardian editor" onClick={cancel} disabled={busy}><FiX /></button></header>
      <section>
        {field("firstName", "First name *", "text", true, 100)}{field("lastName", "Last name *", "text", true, 100)}
        {field("primaryPhone", "Primary phone / WhatsApp *", "tel", true, 40)}{field("secondaryPhone", "Second phone (optional)", "tel", false, 40)}
        {field("email", "Email (optional)", "email", false, 150)}
        <label>Relationship *<AppSelect aria-label="Guardian relationship" value={values.relationship} onChange={event => change("relationship", event.target.value)} required>{!GUARDIAN_RELATIONSHIPS.some(value => value === values.relationship) && <option value={values.relationship}>{values.relationship}</option>}{GUARDIAN_RELATIONSHIPS.map(value => <option key={value} value={value}>{value}</option>)}</AppSelect></label>
        <label className="wide">Home address<textarea rows={3} value={values.homeAddress} onChange={event => change("homeAddress", event.target.value)} /><small>This updates the address shared by the household.</small></label>
        {error && <p className="guardian-editor-error wide" role="alert">{error}</p>}
      </section>
      <footer><button type="button" onClick={cancel} disabled={busy}>Cancel</button><button className="guardian-editor-save" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Changes"}</button></footer>
    </form>
  </div>;
}

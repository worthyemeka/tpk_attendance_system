"use client";

import { FormEvent, useState } from "react";
import { FiCamera, FiCheckCircle, FiHelpCircle, FiSearch } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { PickupDashboard } from "@/components/pickup-dashboard";

type Pickup = { id: number; pickupCode: string; surname: string; serviceName: string; collectedAt?: string | null; children: { attendanceId: number; firstName: string; lastName: string; className?: string; status: string }[] };
type VerificationMethod = "PICKUP_CODE" | "QR_CODE" | "ASSISTED_BIRTH_DATE";

function LegacyAccountPickupPage() {
  const session = readTeacherSession();
  const [code, setCode] = useState("");
  const [pickup, setPickup] = useState<Pickup | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [assistedOpen, setAssistedOpen] = useState(false);
  const [assisted, setAssisted] = useState({ firstName: "", lastName: "", dateOfBirth: "" });
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>("PICKUP_CODE");

  function showPickup(data: Pickup, method: VerificationMethod) {
    setPickup(data); setVerificationMethod(method); setMessage("");
  }

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session || !code.trim()) return;
    const entered = code.trim(); setBusy(true); setMessage(""); setPickup(null);
    try {
      const response = await fetch(`${apiBase}/api/v1/pickup-codes?code=${encodeURIComponent(entered)}`, { headers: authHeaders(session) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || "We could not find that pickup code.");
      showPickup(result.data, entered.startsWith("TPK-PICKUP:") || /^[a-f0-9]{64}$/i.test(entered) ? "QR_CODE" : "PICKUP_CODE");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "We could not find that pickup code."); } finally { setBusy(false); }
  }

  async function assistedLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return;
    setBusy(true); setMessage(""); setPickup(null);
    try {
      const response = await fetch(`${apiBase}/api/v1/pickup-codes/assisted-lookup`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(session) }, body: JSON.stringify(assisted) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error?.message || "We could not verify this child.");
      showPickup(result.data, "ASSISTED_BIRTH_DATE");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "We could not verify this child."); } finally { setBusy(false); }
  }

  async function complete() {
    if (!session || !pickup) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/api/v1/pickup-codes/${pickup.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders(session) }, body: JSON.stringify({ verificationMethod }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || "We could not complete pickup.");
      setPickup({ ...pickup, collectedAt: new Date().toISOString(), children: [] });
      setMessage(`${result.data.childrenReleased} child${result.data.childrenReleased === 1 ? "" : "ren"} safely checked out.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "We could not complete pickup."); } finally { setBusy(false); }
  }

  return <section className="pickup-page">
    <header><p className="eyebrow">Sunday</p><h1>Pick-Up</h1><p className="intro">Scan the QR with a connected scanner or enter the family pickup code.</p></header>
    <section className="panel pickup-panel">
      <form onSubmit={lookup}><label><FiCamera /><input autoFocus value={code} onChange={event => setCode(event.target.value)} placeholder="Scan QR or enter TPK-A-001" /><FiSearch /></label><button className="solid-button" disabled={busy || !code.trim()}>{busy ? "Checking…" : "Find Pickup"}</button></form>
      <button type="button" className="assisted-toggle" onClick={() => { setAssistedOpen(value => !value); setMessage(""); }}><FiHelpCircle />Code unavailable? Verify with the child’s date of birth</button>
      {assistedOpen && <form className="assisted-form" onSubmit={assistedLookup}><p>Use this only when the collecting adult cannot show the family code or QR. Ask for the child’s details privately.</p><div><label>Child’s first name<input required value={assisted.firstName} onChange={event => setAssisted({ ...assisted, firstName: event.target.value })} /></label><label>Child’s last name<input required value={assisted.lastName} onChange={event => setAssisted({ ...assisted, lastName: event.target.value })} /></label><label>Date of birth<input required type="date" value={assisted.dateOfBirth} onChange={event => setAssisted({ ...assisted, dateOfBirth: event.target.value })} /></label></div><button className="outline-button" disabled={busy}>Verify and find pickup</button></form>}
      {message && <p className="pickup-message" role="status">{message}</p>}
      {pickup && <section className="pickup-result"><div><p className="eyebrow">{pickup.pickupCode}</p><h2>{pickup.surname} Family</h2><p>{pickup.serviceName}</p></div>{pickup.collectedAt ? <p className="completed"><FiCheckCircle />Pickup complete</p> : <><div className="verification-note">Verified by {verificationMethod === "ASSISTED_BIRTH_DATE" ? "child date of birth" : verificationMethod === "QR_CODE" ? "pickup QR" : "pickup code"}.</div><div className="pickup-children">{pickup.children.map(child => <span key={child.attendanceId}><b>{child.firstName} {child.lastName}</b><small>{child.className}</small></span>)}</div><button className="solid-button" disabled={busy || !pickup.children.length} onClick={complete}>{busy ? "Completing…" : "Complete Pickup"}</button></>}</section>}
    </section>
    <style jsx>{`.pickup-page h1,.pickup-page h2{font-family:var(--font-display),Georgia,serif}.pickup-page header{margin-bottom:22px}.pickup-panel{max-width:760px}.pickup-panel>form:first-child{display:flex;gap:10px}.pickup-panel>form:first-child label{height:46px;display:flex;align-items:center;gap:10px;flex:1;padding:0 12px;border:1px solid var(--line);border-radius:8px}.pickup-panel input{width:100%;border:0;background:transparent;outline:0;font:14px var(--font-body)}.pickup-message{font-size:12px;color:#a63c27}.pickup-result{margin-top:20px;padding-top:20px;border-top:1px solid var(--line)}.pickup-result h2{margin:5px 0}.pickup-result p:not(.eyebrow){color:var(--muted);font-size:12px}.pickup-children{display:grid;gap:8px;margin:16px 0}.pickup-children span{display:flex;justify-content:space-between;padding:10px;border:1px solid var(--line);border-radius:7px;font-size:12px}.pickup-children small{color:var(--muted)}.completed{display:flex;gap:8px;align-items:center;color:var(--green)!important;font-weight:800}.assisted-toggle{display:inline-flex;align-items:center;gap:7px;margin-top:13px;padding:0;border:0;background:transparent;color:#a44b28;font:800 11px var(--font-body);cursor:pointer}.assisted-form{margin-top:13px;padding:14px;border:1px solid #ead9c5;border-radius:9px;background:#fff9f1}.assisted-form p{margin:0 0 12px;color:var(--muted);font-size:11px;line-height:1.5}.assisted-form>div{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}.assisted-form label{display:grid;gap:6px;color:#5d574f;font-size:10px;font-weight:800}.assisted-form input{height:39px;padding:0 10px;border:1px solid var(--line);border-radius:7px;background:#fff}.assisted-form button{margin-top:12px}.verification-note{margin-top:14px;color:#626962;font-size:11px;font-weight:700}@media(max-width:590px){.pickup-panel>form:first-child{display:grid}.pickup-panel>form:first-child button{width:100%}.assisted-form>div{grid-template-columns:1fr}}`}</style>
  </section>;
}

export default function AccountPickupPage() { return <PickupDashboard />; }

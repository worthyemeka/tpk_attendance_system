"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiMinus, FiPlus } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";

type Child = { firstName: string; lastName: string; dateOfBirth: string; gender: "" | "MALE" | "FEMALE"; careInformation: string };
type Service = { id: number; name: string; serviceDate: string; serviceType: "FIRST_SERVICE" | "SECOND_SERVICE"; isOpen: boolean };
type Guardian = { firstName: string; lastName: string; phone: string; secondaryPhone: string; relationship: string; email: string; address: string };
type Pickup = { mode: "SELF" | "OTHER"; fullName: string; relationship: string; phone: string };

const blankChild = (): Child => ({ firstName: "", lastName: "", dateOfBirth: "", gender: "", careInformation: "" });

export default function AssistedCheckInPage() {
  const session = readTeacherSession();
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [guardian, setGuardian] = useState<Guardian>({ firstName: "", lastName: "", phone: "", secondaryPhone: "", relationship: "", email: "", address: "" });
  const [children, setChildren] = useState<Child[]>([blankChild()]);
  const [pickup, setPickup] = useState<Pickup>({ mode: "SELF", fullName: "", relationship: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [canOperate, setCanOperate] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ pickupCode: string; pickupTicketUrl: string } | null>(null);

  useEffect(() => {
    if (!session) return;
    fetch(`${apiBase}/api/v1/service-sessions`, { headers: authHeaders(session) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load services.");
        const items = (result.data || []).filter((service: Service) => service.serviceType === "FIRST_SERVICE" || service.serviceType === "SECOND_SERVICE");
        setServices(items);
        setServiceId(String(items.find((service: Service) => service.isOpen)?.id || items[0]?.id || ""));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "We could not load services."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!session || !serviceId) { setCanOperate(false); return; }
    fetch(`${apiBase}/api/v1/check-ins?serviceSessionId=${serviceId}`, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((result) => setCanOperate(Boolean(result.success && result.data?.canOperate)))
      .catch(() => setCanOperate(false));
  }, [serviceId, session]);

  const updateChild = (index: number, key: keyof Child, value: string) => setChildren((current) => current.map((child, childIndex) => childIndex === index ? { ...child, [key]: value } : child));
  const phoneIsValid = (phone: string) => phone.replace(/\D/g, "").length >= 10;
  const ready = Boolean(
    serviceId && canOperate && guardian.firstName.trim() && guardian.lastName.trim() && phoneIsValid(guardian.phone) && guardian.relationship && guardian.address.trim() &&
    children.every((child) => child.firstName.trim() && child.lastName.trim() && child.dateOfBirth && child.gender) &&
    (pickup.mode === "SELF" || (pickup.fullName.trim() && pickup.relationship && phoneIsValid(pickup.phone)))
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session || !ready || !canOperate) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/assisted-check-ins`, {
        method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" },
        body: JSON.stringify({ serviceSessionId: Number(serviceId), guardian, children, pickup })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not save this desk check-in.");
      setReceipt(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not save this desk check-in.");
    } finally { setBusy(false); }
  }

  if (receipt) return <section className="assisted-page"><div className="receipt panel"><FiCheckCircle /><p className="eyebrow">Desk check-in complete</p><h1>Pickup ticket ready</h1><p>The family and child records have been saved. They are now in the live pickup list for this service.</p><b>{receipt.pickupCode}</b><a className="solid-button" href={receipt.pickupTicketUrl} target="_blank" rel="noreferrer">Open pickup ticket / PDF</a><Link className="outline-button" href="/account/check-in">Return to check-in</Link></div><style jsx>{receiptStyles}</style></section>;

  return <section className="assisted-page">
    <header><Link href="/account/check-in"><FiArrowLeft /> Back to check-in</Link><p className="eyebrow">TPK staff tool</p><h1>Desk check-in</h1><p className="intro">Use the same registration details as the parent form when a family needs help at the desk. Saving checks the children in immediately and creates this Sunday’s pickup ticket.</p></header>
    <form className="panel assisted-form" onSubmit={submit}>
      {error && <p className="error">{error}</p>}
      <label>Service<select required value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Choose service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.serviceDate}{service.isOpen ? " · Open" : ""}</option>)}</select></label>
      {serviceId && !canOperate && <p className="readonly-notice">Read-only today — only the teacher assigned to Assembly can save a desk check-in for this service.</p>}
      <h2>Parent or guardian</h2>
      <div className="grid guardian-grid">
        <label>First name<input required autoComplete="given-name" value={guardian.firstName} onChange={(event) => setGuardian({ ...guardian, firstName: event.target.value })} /></label>
        <label>Last name<input required autoComplete="family-name" value={guardian.lastName} onChange={(event) => setGuardian({ ...guardian, lastName: event.target.value })} /></label>
        <label>Phone number<input required inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={guardian.phone} onChange={(event) => setGuardian({ ...guardian, phone: event.target.value })} /></label>
        <label>Relationship<select required value={guardian.relationship} onChange={(event) => setGuardian({ ...guardian, relationship: event.target.value })}><option value="">Choose relationship</option><option>Mother</option><option>Father</option><option>Guardian</option><option>Other</option></select></label>
        <label>Second phone <small>Optional</small><input inputMode="tel" value={guardian.secondaryPhone} onChange={(event) => setGuardian({ ...guardian, secondaryPhone: event.target.value })} /></label>
        <label>Email <small>Optional</small><input type="email" autoComplete="email" value={guardian.email} onChange={(event) => setGuardian({ ...guardian, email: event.target.value })} /></label>
        <label className="wide">Home address<textarea required value={guardian.address} onChange={(event) => setGuardian({ ...guardian, address: event.target.value })} /></label>
      </div>
      <div className="children-heading"><div><h2>Child or children</h2><p>Add every child arriving with this family.</p></div><button type="button" className="outline-button" onClick={() => setChildren([...children, blankChild()])}><FiPlus /> Add child</button></div>
      {children.map((child, index) => <div className="child-card" key={index}><div className="child-label"><b>Child {index + 1}</b>{children.length > 1 && <button className="remove" type="button" onClick={() => setChildren(children.filter((_, childIndex) => childIndex !== index))}><FiMinus /> Remove</button>}</div><div className="grid child-grid">
        <label>First name<input required value={child.firstName} onChange={(event) => updateChild(index, "firstName", event.target.value)} /></label>
        <label>Last name<input required value={child.lastName} onChange={(event) => updateChild(index, "lastName", event.target.value)} /></label>
        <label>Date of birth<input required type="date" value={child.dateOfBirth} onChange={(event) => updateChild(index, "dateOfBirth", event.target.value)} /></label>
        <label>Gender<select required value={child.gender} onChange={(event) => updateChild(index, "gender", event.target.value)}><option value="">Choose gender</option><option value="FEMALE">Female</option><option value="MALE">Male</option></select></label>
        <label className="wide">Care information <small>Optional — allergies, medical needs or anything the team should know</small><textarea value={child.careInformation} onChange={(event) => updateChild(index, "careInformation", event.target.value)} /></label>
      </div></div>)}
      <section className="pickup-section"><h2>Pickup arrangement</h2><p>Who is expected to collect these children today?</p><div className="pickup-options"><button type="button" className={pickup.mode === "SELF" ? "selected" : ""} onClick={() => setPickup({ ...pickup, mode: "SELF" })}>Parent / guardian</button><button type="button" className={pickup.mode === "OTHER" ? "selected" : ""} onClick={() => setPickup({ ...pickup, mode: "OTHER" })}>Authorised pickup person</button></div>{pickup.mode === "OTHER" && <div className="grid"><label>Full name<input required value={pickup.fullName} onChange={(event) => setPickup({ ...pickup, fullName: event.target.value })} /></label><label>Relationship<select required value={pickup.relationship} onChange={(event) => setPickup({ ...pickup, relationship: event.target.value })}><option value="">Choose relationship</option><option>Family member</option><option>Friend</option><option>Other</option></select></label><label>Phone number<input required inputMode="tel" value={pickup.phone} onChange={(event) => setPickup({ ...pickup, phone: event.target.value })} /></label></div>}</section>
      <button className="solid-button submit" disabled={!ready || busy}>{busy ? "Saving check-in…" : "Save check-in and create pickup ticket"}</button>
    </form><style jsx>{styles}</style>
  </section>;
}

const receiptStyles = `.assisted-page{max-width:760px}.receipt{display:grid;justify-items:center;gap:13px;padding:40px;text-align:center}.receipt>svg{font-size:52px;color:#12965f}.receipt h1{margin:0;font-family:var(--font-display),Georgia,serif;font-size:40px}.receipt p{max-width:480px;margin:0;color:var(--muted);line-height:1.55}.receipt>b{margin:10px 0;padding:16px 24px;border:1px dashed var(--orange);border-radius:10px;color:var(--orange);font:700 36px var(--font-display),Georgia,serif}.receipt a{width:min(100%,360px);justify-content:center}`;
const styles = `.assisted-page{max-width:1100px}.assisted-page header{margin-bottom:22px}.assisted-page header>a{display:inline-flex;align-items:center;gap:6px;margin-bottom:17px;color:#546b93;font-size:12px;font-weight:800;text-decoration:none}.assisted-page h1,.assisted-page h2{font-family:var(--font-display),Georgia,serif}.assisted-page h1{margin:0}.assisted-page h2{margin:22px 0 7px;font-size:23px}.assisted-form{display:grid;gap:14px}.assisted-form label{display:grid;gap:6px;color:#5d574f;font-size:11px;font-weight:800}.assisted-form small{font-weight:500;color:var(--muted)}.assisted-form input,.assisted-form select,.assisted-form textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:#fffdfa;color:var(--ink);font:13px var(--font-body)}.assisted-form input,.assisted-form select{height:42px}.assisted-form textarea{min-height:76px;padding-top:10px;resize:vertical}.readonly-notice{margin:0;padding:11px 13px;border:1px solid #f0dfb6;border-radius:10px;background:#fff9e9;color:#896515;font-size:12px;line-height:1.45}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.guardian-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.wide{grid-column:span 2}.children-heading{display:flex;justify-content:space-between;align-items:end;margin-top:4px}.children-heading h2{margin-bottom:2px}.children-heading p,.pickup-section>p{margin:0;color:var(--muted);font-size:12px}.children-heading button{display:inline-flex;align-items:center;gap:5px;height:36px}.child-card{padding:15px;border:1px solid var(--line);border-radius:10px;background:#fff}.child-label{display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px}.remove{border:0;background:transparent;color:#bd472f;font:800 11px var(--font-body);cursor:pointer;display:inline-flex;gap:4px;align-items:center}.pickup-section{border-top:1px solid var(--line);padding-top:4px}.pickup-section h2{margin-bottom:3px}.pickup-options{display:flex;gap:10px;margin:14px 0}.pickup-options button{min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:#fff;font:700 12px var(--font-body);color:var(--ink);cursor:pointer}.pickup-options .selected{border-color:var(--orange);background:#fff4ef;color:var(--orange)}.submit{min-height:48px;justify-content:center;margin-top:4px}.error{margin:0;color:#bf422a;font-size:12px}@media(max-width:860px){.grid,.guardian-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wide{grid-column:span 2}}@media(max-width:500px){.grid,.guardian-grid{grid-template-columns:1fr}.wide{grid-column:auto}.children-heading{align-items:start;gap:12px}.children-heading button{white-space:nowrap}.pickup-options{display:grid}.pickup-options button{width:100%}}`;

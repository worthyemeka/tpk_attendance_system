"use client";

import Link from "next/link";
import { RelationshipField, validRelationship } from "@/components/relationship-field";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiMinus, FiPlus } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { readActiveService, subscribeToActiveService, type ActiveService } from "@/lib/active-service";

type Child = { firstName: string; lastName: string; dateOfBirth: string; gender: "" | "MALE" | "FEMALE"; classId: string; careInformation: string };
type ClassOption = { id: number; name: string; ageLabel?: string };
type Service = { id: number; name: string; serviceDate: string; serviceType: string; isOpen: boolean };
type Guardian = { firstName: string; lastName: string; phone: string; secondaryPhone: string; relationship: string; email: string; address: string };
type Pickup = { mode: "SELF" | "OTHER"; fullName: string; relationship: string; phone: string };
type RegisteredFamily = { id: number; familyName: string; familyCode: string; phone: string; email?: string; homeAddress?: string; children: Array<{ id: number; firstName: string; lastName: string; dateOfBirth: string; gender?: "MALE" | "FEMALE"; classId?: number | null }>; guardians: Array<{ firstName: string; lastName: string; primaryPhone: string; secondaryPhone?: string; email?: string; relationship?: string; primaryGuardian?: boolean }> };

const blankChild = (): Child => ({ firstName: "", lastName: "", dateOfBirth: "", gender: "", classId: "", careInformation: "" });

export default function AssistedCheckInPage() {
  const session = useMemo(() => readTeacherSession(), []);
  const [services, setServices] = useState<Service[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [activeService, setActiveService] = useState<ActiveService | null | undefined>();
  const [serviceId, setServiceId] = useState("");
  const [guardian, setGuardian] = useState<Guardian>({ firstName: "", lastName: "", phone: "", secondaryPhone: "", relationship: "", email: "", address: "" });
  const [children, setChildren] = useState<Child[]>([blankChild()]);
  const [pickup, setPickup] = useState<Pickup>({ mode: "SELF", fullName: "", relationship: "", phone: "" });
  const [registeredPhone, setRegisteredPhone] = useState("");
  const [registeredFamily, setRegisteredFamily] = useState<RegisteredFamily | null>(null);
  const [registeredBusy, setRegisteredBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canOperate, setCanOperate] = useState(false);
  const [permissionLoaded, setPermissionLoaded] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ pickupCode: string; pickupTicketUrl: string } | null>(null);

  async function loadRegisteredFamily() {
    if (!session || !registeredPhone.trim()) return;
    setRegisteredBusy(true); setError(""); setRegisteredFamily(null);
    try {
      const phoneDigits = registeredPhone.replace(/\D/g, "");
      if (phoneDigits.length < 10) throw new Error("Enter the guardian’s full phone number.");
      const search = new URLSearchParams({ search: phoneDigits.slice(-10), limit: "10" });
      const matchesResponse = await fetch(`${apiBase}/api/v1/families?${search}`, { headers: authHeaders(session) });
      const matches = await matchesResponse.json();
      if (!matchesResponse.ok || !matches.success || !matches.data?.length) throw new Error("No registered family was found with that phone number.");
      if (matches.data.length > 1) throw new Error("More than one family uses that phone number. Please open the correct family in the Families directory before checking in.");
      const familyResponse = await fetch(`${apiBase}/api/v1/families/${matches.data[0].id}`, { headers: authHeaders(session) });
      const familyResult = await familyResponse.json();
      if (!familyResponse.ok || !familyResult.success) throw new Error(familyResult.error?.message || "We could not load that family.");
      const family = familyResult.data as RegisteredFamily;
      const primary = family.guardians.find((item) => item.primaryGuardian) || family.guardians[0];
      if (!primary || !family.children.length) throw new Error("That family does not have a linked guardian and child yet.");
      setRegisteredFamily(family);
      setGuardian({ firstName: primary.firstName, lastName: primary.lastName, phone: primary.primaryPhone || family.phone, secondaryPhone: primary.secondaryPhone || "", relationship: primary.relationship || "Guardian", email: primary.email || family.email || "", address: family.homeAddress || "" });
      setChildren(family.children.map((child) => ({ firstName: child.firstName, lastName: child.lastName, dateOfBirth: child.dateOfBirth, gender: child.gender || "", classId: child.classId ? String(child.classId) : "", careInformation: "" })));
      setPickup({ mode: "SELF", fullName: "", relationship: "", phone: "" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not find that registered family.");
    } finally { setRegisteredBusy(false); }
  }

  useEffect(() => {
    if (!session) return;
    fetch(`${apiBase}/api/v1/service-sessions`, { headers: authHeaders(session) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load services.");
        const items = result.data || [];
        setServices(items);
        const selected = readActiveService();
        const matching = selected?.id ? items.find((service: Service) => service.id === selected.id) : undefined;
        if (matching) {
          setServiceId(String(matching.id));
          return;
        }
        /* Never guess from the first open row: the API returns future Sundays
           too, which made the desk form jump away from the top-bar service.
           The current endpoint is only a fallback for direct page visits. */
        const currentResponse = await fetch(`${apiBase}/api/v1/service-sessions/current`, { headers: authHeaders(session), cache: "no-store" });
        const currentResult = await currentResponse.json();
        if (currentResponse.ok && currentResult.success && currentResult.data?.id) setServiceId(String(currentResult.data.id));
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "We could not load services."));
    fetch(`${apiBase}/api/v1/classes`, { headers: authHeaders(session) })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error?.message || "We could not load classes.");
        setClasses(result.data || []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "We could not load classes."));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => subscribeToActiveService((service) => {
    setActiveService(service);
    setCanOperate(false);
    setPermissionLoaded(false);
    setServiceId(service?.id ? String(service.id) : "");
  }), []);

  useEffect(() => {
    if (!activeService?.id) return;
    const matching = services.find((service) => service.id === activeService.id);
    if (matching) setServiceId(String(matching.id));
  }, [activeService, services]);

  const serviceOptions = useMemo(() => {
    if (!activeService?.id || services.some((service) => service.id === activeService.id)) return services;
    const fallbackType = activeService.serviceType === "FIRST_SERVICE" ? "FIRST_SERVICE" : "SECOND_SERVICE";
    return [{
      id: activeService.id,
      name: activeService.label,
      serviceDate: activeService.serviceDate || "",
      serviceType: fallbackType,
      isOpen: false,
    }, ...services];
  }, [activeService, services]);

  useEffect(() => {
    if (!session || !serviceId) { setCanOperate(false); setPermissionLoaded(false); return; }
    setPermissionLoaded(false);
    let cancelled = false;
    fetch(`${apiBase}/api/v1/check-ins?serviceSessionId=${serviceId}`, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((result) => { if (!cancelled) setCanOperate(Boolean(result.success && result.data?.canAssistedCheckin)); })
      .catch(() => { if (!cancelled) setCanOperate(false); })
      .finally(() => { if (!cancelled) setPermissionLoaded(true); });
    return () => { cancelled = true; };
  }, [serviceId, session]);

  const updateChild = (index: number, key: keyof Child, value: string) => setChildren((current) => current.map((child, childIndex) => childIndex === index ? { ...child, [key]: value } : child));
  const phoneIsValid = (phone: string) => phone.replace(/\D/g, "").length >= 10;
  const ready = Boolean(
    serviceId && canOperate && guardian.firstName.trim() && guardian.lastName.trim() && phoneIsValid(guardian.phone) && validRelationship(guardian.relationship) && guardian.address.trim() &&
    children.every((child) => child.firstName.trim() && child.lastName.trim() && child.dateOfBirth && child.gender) &&
    (pickup.mode === "SELF" || (pickup.fullName.trim() && validRelationship(pickup.relationship) && phoneIsValid(pickup.phone)))
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

  if (receipt) return <section className="assisted-page"><div className="receipt panel"><FiCheckCircle /><p className="eyebrow">Desk check-in complete</p><h1>Pickup ticket ready</h1><p>The family and child records have been saved and are visible in this service’s live check-in table.</p><b>{receipt.pickupCode}</b><a className="solid-button" href={receipt.pickupTicketUrl} target="_blank" rel="noreferrer">Open ticket / save PDF</a><Link className="outline-button" href={`/account/check-in?serviceSessionId=${serviceId}`}>Return to live check-in</Link></div><style jsx>{receiptStyles}</style></section>;

  if (permissionLoaded && !canOperate) return <section className="assisted-page"><div className="panel access-denied"><p className="eyebrow">Desk check-in</p><h1>Access not available</h1><p>Only the Super Admin or the Head/Assistant assigned to the selected service can use assisted check-in.</p><Link className="outline-button" href="/account/overview">Return to overview</Link></div><style jsx>{receiptStyles}</style></section>;

  return <section className="assisted-page">
    <header><Link href="/account/check-in"><FiArrowLeft /> Back to check-in</Link><p className="eyebrow">TPK staff tool</p><h1>Desk check-in</h1><p className="intro">Use this any day to register a family, place each child in a class, and record an assisted arrival for the selected service.</p></header>
    <form className="panel assisted-form" onSubmit={submit}>
      {error && <p className="error">{error}</p>}
      <label>Service<select required value={serviceId} onChange={(event) => { setCanOperate(false); setPermissionLoaded(false); setServiceId(event.target.value); }}><option value="">Choose service</option>{serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.name}{service.serviceDate ? ` · ${service.serviceDate}` : ""}{service.isOpen ? " · Open" : " · Closed"}</option>)}</select></label>
      {serviceId && !canOperate && <p className="readonly-notice">Only the Super Admin or the Head/Assistant assigned to this service can save a desk check-in.</p>}
      <section className="registered-lookup"><div><h2>Returning family</h2><p>Already registered? Find the family by guardian phone and load its children into this check-in.</p></div><div className="registered-lookup-form"><input inputMode="tel" placeholder="Guardian phone number" value={registeredPhone} onChange={(event) => setRegisteredPhone(event.target.value)} /><button type="button" className="outline-button" onClick={() => void loadRegisteredFamily()} disabled={registeredBusy || !registeredPhone.trim()}>{registeredBusy ? "Finding…" : "Find registered family"}</button></div>{registeredFamily && <p className="registered-result">Loaded {registeredFamily.familyName} family · {registeredFamily.children.length} child{registeredFamily.children.length === 1 ? "" : "ren"}. Review the details below before saving.</p>}</section>
      <h2>Parent or guardian</h2>
      <div className="grid guardian-grid">
        <label>First name<input required autoComplete="given-name" value={guardian.firstName} onChange={(event) => setGuardian({ ...guardian, firstName: event.target.value })} /></label>
        <label>Last name<input required autoComplete="family-name" value={guardian.lastName} onChange={(event) => setGuardian({ ...guardian, lastName: event.target.value })} /></label>
        <label>Phone number<input required inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={guardian.phone} onChange={(event) => setGuardian({ ...guardian, phone: event.target.value })} /></label>
        <RelationshipField value={guardian.relationship} onChange={value=>setGuardian({...guardian,relationship:value})} />
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
        <label>Class<select value={child.classId} onChange={(event) => updateChild(index, "classId", event.target.value)}><option value="">Auto-assign by age</option>{classes.map((classOption) => <option key={classOption.id} value={classOption.id}>{classOption.name}{classOption.ageLabel ? ` · ${classOption.ageLabel}` : ""}</option>)}</select><small>Choose a class when the age-based suggestion is not suitable.</small></label>
        <label className="wide">Care information <small>Optional — allergies, medical needs or anything the team should know</small><textarea value={child.careInformation} onChange={(event) => updateChild(index, "careInformation", event.target.value)} /></label>
      </div></div>)}
      <section className="pickup-section"><h2>Pickup arrangement</h2><p>Who is expected to collect these children today?</p><div className="pickup-options"><button type="button" className={pickup.mode === "SELF" ? "selected" : ""} onClick={() => setPickup({ ...pickup, mode: "SELF" })}>Parent / guardian</button><button type="button" className={pickup.mode === "OTHER" ? "selected" : ""} onClick={() => setPickup({ ...pickup, mode: "OTHER" })}>Authorised pickup person</button></div>{pickup.mode === "OTHER" && <div className="grid"><label>Full name<input required value={pickup.fullName} onChange={(event) => setPickup({ ...pickup, fullName: event.target.value })} /></label><RelationshipField value={pickup.relationship} onChange={value=>setPickup({...pickup,relationship:value})} /><label>Phone number<input required inputMode="tel" value={pickup.phone} onChange={(event) => setPickup({ ...pickup, phone: event.target.value })} /></label></div>}</section>
      <button className="solid-button submit" disabled={!ready || busy}>{busy ? "Saving check-in…" : "Save check-in and create pickup ticket"}</button>
    </form><style jsx>{styles}</style>
  </section>;
}

const receiptStyles = `.assisted-page{max-width:760px}.receipt,.access-denied{display:grid;justify-items:center;gap:13px;padding:40px;text-align:center}.receipt>svg{font-size:52px;color:#12965f}.receipt h1,.access-denied h1{margin:0;font-family:var(--font-display),Georgia,serif;font-size:40px}.receipt p,.access-denied p{max-width:480px;margin:0;color:var(--muted);line-height:1.55}.receipt>b{margin:10px 0;padding:16px 24px;border:1px dashed var(--orange);border-radius:10px;color:var(--orange);font:700 36px var(--font-display),Georgia,serif}.receipt a,.access-denied a{width:min(100%,360px);justify-content:center}`;
const styles = `.assisted-page{max-width:1100px}.assisted-page header{margin-bottom:22px}.assisted-page header>a{display:inline-flex;align-items:center;gap:6px;margin-bottom:17px;color:#546b93;font-size:12px;font-weight:800;text-decoration:none}.assisted-page h1,.assisted-page h2{font-family:var(--font-display),Georgia,serif}.assisted-page h1{margin:0}.assisted-page h2{margin:22px 0 7px;font-size:23px}.assisted-form{display:grid;gap:14px}.assisted-form label{display:grid;gap:6px;color:#5d574f;font-size:11px;font-weight:800}.assisted-form small{font-weight:500;color:var(--muted)}.assisted-form input,.assisted-form select,.assisted-form textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:#fffdfa;color:var(--ink);font:13px var(--font-body)}.assisted-form input,.assisted-form select{height:42px}.assisted-form textarea{min-height:76px;padding-top:10px;resize:vertical}.readonly-notice{margin:0;padding:11px 13px;border:1px solid #f0dfb6;border-radius:10px;background:#fff9e9;color:#896515;font-size:12px;line-height:1.45}.registered-lookup{display:grid;gap:10px;padding:15px;border:1px solid #f1d8c8;border-radius:10px;background:#fff8f3}.registered-lookup h2{margin:0;font-size:19px}.registered-lookup p{margin:3px 0 0;color:var(--muted);font-size:12px;line-height:1.45}.registered-lookup-form{display:flex;gap:9px}.registered-lookup input{height:40px;min-width:0;flex:1;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:#fff;font:12px var(--font-body)}.registered-lookup button{white-space:nowrap}.registered-result{color:#087a4b!important;font-weight:800}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.guardian-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.wide{grid-column:span 2}.children-heading{display:flex;justify-content:space-between;align-items:end;margin-top:4px}.children-heading h2{margin-bottom:2px}.children-heading p,.pickup-section>p{margin:0;color:var(--muted);font-size:12px}.children-heading button{display:inline-flex;align-items:center;gap:5px;height:36px}.child-card{padding:15px;border:1px solid var(--line);border-radius:10px;background:#fff}.child-label{display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px}.remove{border:0;background:transparent;color:#bd472f;font:800 11px var(--font-body);cursor:pointer;display:inline-flex;gap:4px;align-items:center}.pickup-section{border-top:1px solid var(--line);padding-top:4px}.pickup-section h2{margin-bottom:3px}.pickup-options{display:flex;gap:10px;margin:14px 0}.pickup-options button{min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:#fff;font:700 12px var(--font-body);color:var(--ink);cursor:pointer}.pickup-options .selected{border-color:var(--orange);background:#fff4ef;color:var(--orange)}.submit{min-height:48px;justify-content:center;margin-top:4px}.error{margin:0;color:#bf422a;font-size:12px}@media(max-width:860px){.grid,.guardian-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wide{grid-column:span 2}}@media(max-width:500px){.grid,.guardian-grid{grid-template-columns:1fr}.wide{grid-column:auto}.children-heading{align-items:start;gap:12px}.children-heading button{white-space:nowrap}.pickup-options{display:grid}.pickup-options button{width:100%}.registered-lookup-form{display:grid}.registered-lookup button{width:100%;justify-content:center}}`;

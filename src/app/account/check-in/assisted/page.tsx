"use client";

import { AppSelect } from "@/components/app-dropdown";
import Link from "next/link";
import { RelationshipField, validRelationship } from "@/components/relationship-field";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiArrowLeft, FiCheckCircle, FiMinus, FiPlus, FiPhone, FiUsers, FiLock } from "react-icons/fi";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { readActiveService, subscribeToActiveService, type ActiveService } from "@/lib/active-service";

type Child = { id?:number; firstName: string; lastName: string; dateOfBirth: string; gender: "" | "MALE" | "FEMALE"; classId: string; careInformation: string };
type ClassOption = { id: number; name: string; ageLabel?: string };
type Service = { id: number; name: string; serviceDate: string; serviceType: string; isOpen: boolean };
type Guardian = { firstName: string; lastName: string; phone: string; secondaryPhone: string; relationship: string; email: string; address: string };
type Pickup = { mode: "SELF" | "OTHER"; fullName: string; relationship: string; phone: string };
type RegisteredFamily = { id: number; familyName: string; familyCode: string; phone: string; email?: string; homeAddress?: string; children: Array<{ id: number; firstName: string; lastName: string; dateOfBirth: string; gender?: "MALE" | "FEMALE"; active?:boolean; className?:string; classId?: number | null }>; guardians: Array<{ id:number; firstName: string; lastName: string; primaryPhone: string; secondaryPhone?: string; email?: string; relationship?: string; primaryGuardian?: boolean }> };

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
  const [registeredGuardianId, setRegisteredGuardianId] = useState<number | null>(null);
  const [selectedChildIds, setSelectedChildIds] = useState<number[]>([]);
  const [familyMatches, setFamilyMatches] = useState<Array<{familyId:number;guardianId:number;familyName:string;firstName:string;lastName:string}>>([]);
  const [lookupMessage, setLookupMessage] = useState("");
  const lookupController = useRef<AbortController | null>(null);
  const [registeredBusy, setRegisteredBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canOperate, setCanOperate] = useState(false);
  const [permissionLoaded, setPermissionLoaded] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ pickupCode: string; pickupTicketUrl: string } | null>(null);

  const chooseFamily = useCallback(async (familyId:number, guardianId:number, signal?:AbortSignal) => {
    if(!session)return;
    const response=await fetch(`${apiBase}/api/v1/families/${familyId}`,{headers:authHeaders(session),signal});
    const result=await response.json();
    if(!response.ok||!result.success)throw new Error(result.error?.message||"We could not load this family.");
    if(signal?.aborted)return;
    const family=result.data as RegisteredFamily;
    const contact=family.guardians.find(item=>Number(item.id)===guardianId);
    if(!contact)throw new Error("This guardian is no longer linked to the family.");
    const activeChildren=family.children.filter(child=>child.active!==false && Number(child.active)!==0);
    setRegisteredFamily({...family,children:activeChildren});setRegisteredGuardianId(guardianId);
    setSelectedChildIds(activeChildren.filter(child=>child.classId).map(child=>Number(child.id)));
    setGuardian({firstName:contact.firstName,lastName:contact.lastName,phone:contact.primaryPhone||family.phone,secondaryPhone:contact.secondaryPhone||"",relationship:contact.relationship||"",email:contact.email||family.email||"",address:family.homeAddress||""});
    setPickup({mode:"SELF",fullName:"",relationship:"",phone:""});setLookupMessage("");setFamilyMatches([]);
  },[session]);
  const loadRegisteredFamily = useCallback(async (signal?:AbortSignal) => {
    if(!session||!serviceId||!canOperate)return;
    setRegisteredBusy(true);setLookupMessage("");setFamilyMatches([]);
    try {
      const params=new URLSearchParams({phone:registeredPhone,serviceSessionId:serviceId});
      const response=await fetch(`${apiBase}/api/v1/assisted-check-ins/family?${params}`,{headers:authHeaders(session),signal});
      const result=await response.json();
      if(signal?.aborted)return;
      if(!response.ok||!result.success)throw new Error(result.error?.message||"We could not find this family.");
      const matches=result.data||[];
      if(!matches.length){setLookupMessage("No registered family found. Choose New family below to register them.");return;}
      if(matches.length>1){setFamilyMatches(matches);setLookupMessage("This number is linked to more than one family. Choose the correct household.");return;}
      await chooseFamily(Number(matches[0].familyId),Number(matches[0].guardianId),signal);
    } catch(caught) {
      if(!signal?.aborted)setLookupMessage(caught instanceof Error?caught.message:"We could not find this family.");
    } finally {if(!signal?.aborted)setRegisteredBusy(false);}
  },[session,serviceId,canOperate,registeredPhone,chooseFamily]);
  useEffect(()=>{
    lookupController.current?.abort();
    const controller=new AbortController();lookupController.current=controller;
    const digits=registeredPhone.replace(/\D/g,"");
    if(digits.length!==11 && !(digits.startsWith("234")&&digits.length===13)){setRegisteredBusy(false);return;}
    if(!session||!serviceId||!canOperate){setRegisteredBusy(false);return;}
    setRegisteredBusy(true);
    const timer=window.setTimeout(()=>void loadRegisteredFamily(controller.signal),450);
    return ()=>{window.clearTimeout(timer);controller.abort();};
  },[registeredPhone,loadRegisteredFamily,session,serviceId,canOperate]);
  function clearFamily(){
    lookupController.current?.abort();setRegisteredPhone("");setRegisteredFamily(null);setRegisteredGuardianId(null);
    setSelectedChildIds([]);setFamilyMatches([]);setRegisteredBusy(false);setLookupMessage("");
    setGuardian({firstName:"",lastName:"",phone:"",secondaryPhone:"",relationship:"",email:"",address:""});setChildren([blankChild()]);
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
    serviceId && canOperate && !registeredBusy && (registeredFamily ? selectedChildIds.length > 0 && registeredGuardianId : guardian.firstName.trim() && guardian.lastName.trim() && phoneIsValid(guardian.phone) && validRelationship(guardian.relationship) && guardian.address.trim() &&
    children.every((child) => child.firstName.trim() && child.lastName.trim() && child.dateOfBirth && child.gender)) &&
    (pickup.mode === "SELF" || (pickup.fullName.trim() && validRelationship(pickup.relationship) && phoneIsValid(pickup.phone)))
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!session || !ready || !canOperate) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiBase}/api/v1/assisted-check-ins`, {
        method: "POST", headers: { ...authHeaders(session), "Content-Type": "application/json" },
        body: JSON.stringify(registeredFamily ? { serviceSessionId:Number(serviceId), registeredFamilyId:registeredFamily.id, registeredGuardianId, children:selectedChildIds.map(id=>({id})), pickup } : { serviceSessionId: Number(serviceId), guardian, children, pickup })
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
    <header><Link href="/account/check-in"><FiArrowLeft /> Back to check-in</Link><p className="eyebrow">TPK staff tool</p><h1>Desk check-in</h1><p className="intro">Find a registered family or welcome a new one, select the children arriving, and prepare their pickup ticket.</p></header>
    <form className="panel assisted-form" onSubmit={submit}>
      {error && <p className="error">{error}</p>}
      <label>Service<AppSelect required value={serviceId} onChange={(event) => { setCanOperate(false); setPermissionLoaded(false); setServiceId(event.target.value); }}><option value="">Choose service</option>{serviceOptions.map((service) => <option key={service.id} value={service.id}>{service.name}{service.serviceDate ? ` · ${service.serviceDate}` : ""}{service.isOpen ? " · Open" : " · Closed"}</option>)}</AppSelect></label>
      {serviceId && !canOperate && <p className="readonly-notice">Only the Super Admin or the Head/Assistant assigned to this service can save a desk check-in.</p>}
      <section className="registered-lookup"><div className="lookup-heading"><i><FiPhone /></i><div><h2>Find a returning family</h2><p>Enter the parent’s number. We’ll load their saved details automatically.</p></div><button type="button" className="outline-button" onClick={clearFamily}><FiPlus /> New family</button></div><div className="registered-lookup-form"><label className="lookup-phone"><span>Parent or guardian phone number</span><input aria-label="Find family by phone number" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={registeredPhone} onChange={event=>{lookupController.current?.abort();setRegisteredFamily(null);setRegisteredGuardianId(null);setSelectedChildIds([]);setRegisteredPhone(event.target.value);}} /></label><button type="button" className="outline-button" onClick={()=>{lookupController.current?.abort();const controller=new AbortController();lookupController.current=controller;void loadRegisteredFamily(controller.signal);}} disabled={registeredBusy || !registeredPhone.trim() || !canOperate}>{registeredBusy ? "Finding family…" : "Find family"}</button></div><p className="lookup-message" role="status">{lookupMessage || (registeredBusy ? "Looking up saved family records…" : registeredFamily ? "Family found. Saved profiles remain unchanged." : "Use the same number the parent registered with.")}</p>{familyMatches.map(match=><button type="button" className="family-match" key={match.familyId} onClick={()=>void chooseFamily(Number(match.familyId),Number(match.guardianId)).catch(caught=>setLookupMessage(caught.message))}><FiUsers /><span><b>{match.familyName} Family</b><small>{match.firstName} {match.lastName}</small></span>Choose family</button>)}</section>
      {registeredFamily ? <section className="returning-records"><header><i><FiCheckCircle /></i><div><h2>{registeredFamily.familyName} Family</h2><p>{guardian.firstName} {guardian.lastName} · {guardian.phone}</p></div><span><FiLock /> Saved records</span></header><div className="saved-family-contact"><span><small>Parent or guardian</small><b>{guardian.firstName} {guardian.lastName}</b></span><span><small>Relationship</small><b>{guardian.relationship || "Not recorded"}</b></span></div><h3>Who is arriving today?</h3><p>Select the children who are here. No profile editing is needed.</p><div className="saved-children">{registeredFamily.children.map(child=><label className={selectedChildIds.includes(Number(child.id)) ? "saved-child selected" : "saved-child"} key={child.id}><input type="checkbox" checked={selectedChildIds.includes(Number(child.id))} disabled={!child.classId} onChange={event=>setSelectedChildIds(ids=>event.target.checked?[...ids,Number(child.id)]:ids.filter(id=>id!==Number(child.id)))} /><span className="saved-child-avatar">{child.firstName[0]}{child.lastName[0]}</span><span><b>{child.firstName} {child.lastName}</b><small>{child.className || classes.find(item=>item.id===Number(child.classId))?.name || "Class not assigned"} · {child.dateOfBirth ? new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(child.dateOfBirth.slice(0,10)+"T12:00:00Z")) : "Birth date not recorded"}</small>{!child.classId&&<small>Assign a class in the child’s profile before check-in.</small>}</span></label>)}</div>{!registeredFamily.children.length&&<p>No active children are linked to this family.</p>}<div className="saved-record-notice"><FiLock /><span>Names, birth dates, classes and care information are kept exactly as saved.</span></div></section> : <>

      <h2>Parent or guardian</h2>
      <div className="grid guardian-grid">
        <label>First name<input required autoComplete="given-name" value={guardian.firstName} onChange={(event) => setGuardian({ ...guardian, firstName: event.target.value })} /></label>
        <label>Last name<input required autoComplete="family-name" value={guardian.lastName} onChange={(event) => setGuardian({ ...guardian, lastName: event.target.value })} /></label>
        <label>Phone number<input required inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={guardian.phone} onChange={(event) => { setGuardian({ ...guardian, phone: event.target.value }); setRegisteredPhone(event.target.value); }} /></label>
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
        <label>Gender<AppSelect required value={child.gender} onChange={(event) => updateChild(index, "gender", event.target.value)}><option value="">Choose gender</option><option value="FEMALE">Female</option><option value="MALE">Male</option></AppSelect></label>
        <label>Class<AppSelect value={child.classId} onChange={(event) => updateChild(index, "classId", event.target.value)}><option value="">Auto-assign by age</option>{classes.map((classOption) => <option key={classOption.id} value={classOption.id}>{classOption.name}{classOption.ageLabel ? ` · ${classOption.ageLabel}` : ""}</option>)}</AppSelect><small>Choose a class when the age-based suggestion is not suitable.</small></label>
        <label className="wide">Care information <small>Optional — allergies, medical needs or anything the team should know</small><textarea value={child.careInformation} onChange={(event) => updateChild(index, "careInformation", event.target.value)} /></label>
      </div></div>)}
      </>}
      <section className="pickup-section"><h2>Pickup arrangement</h2><p>Who is expected to collect these children today?</p><div className="pickup-options"><button type="button" className={pickup.mode === "SELF" ? "selected" : ""} onClick={() => setPickup({ ...pickup, mode: "SELF" })}>Parent / guardian</button><button type="button" className={pickup.mode === "OTHER" ? "selected" : ""} onClick={() => setPickup({ ...pickup, mode: "OTHER" })}>Authorised pickup person</button></div>{pickup.mode === "OTHER" && <div className="grid"><label>Full name<input required value={pickup.fullName} onChange={(event) => setPickup({ ...pickup, fullName: event.target.value })} /></label><RelationshipField value={pickup.relationship} onChange={value=>setPickup({...pickup,relationship:value})} /><label>Phone number<input required inputMode="tel" value={pickup.phone} onChange={(event) => setPickup({ ...pickup, phone: event.target.value })} /></label></div>}</section>
      <button className="solid-button submit" disabled={!ready || busy}>{busy ? "Saving check-in…" : "Save check-in and create pickup ticket"}</button>
    </form><style jsx>{styles}</style>
  </section>;
}

const receiptStyles = `.assisted-page{max-width:760px}.receipt,.access-denied{display:grid;justify-items:center;gap:13px;padding:40px;text-align:center}.receipt>svg{font-size:52px;color:#12965f}.receipt h1,.access-denied h1{margin:0;font-family:var(--font-body),sans-serif;font-size:40px}.receipt p,.access-denied p{max-width:480px;margin:0;color:var(--muted);line-height:1.55}.receipt>b{margin:10px 0;padding:16px 24px;border:1px dashed var(--orange);border-radius:10px;color:var(--orange);font:700 36px var(--font-body),sans-serif}.receipt a,.access-denied a{width:min(100%,360px);justify-content:center}`;
const styles = `
.assisted-page{max-width:1200px!important;color:#203451}
.assisted-page h1{font-size:36px!important;font-weight:800;letter-spacing:-.035em}
.assisted-page .intro{font-size:15px;line-height:1.65;color:#71809a;max-width:860px}
.assisted-page .assisted-form{padding:28px;border:1px solid #e6e0d8;border-radius:18px;background:#fffdfa;gap:22px;box-shadow:none}
.assisted-page .assisted-form h2{font-weight:800;font-size:22px;color:#203451}
.assisted-page .assisted-form label{font-size:12px;color:#3b5270;gap:9px}
.assisted-page .assisted-form input,.assisted-page .assisted-form textarea{border-color:#dce2eb;border-radius:10px;background:#fff;font-size:14px}
.assisted-page .assisted-form input{height:46px}
.assisted-page .assisted-form :is(input,textarea):focus-visible{outline:3px solid #fbdacc;border-color:#df9f82}
.assisted-page .registered-lookup{padding:22px;border:1px solid #eeded0;border-radius:14px;background:#fff8f1;gap:16px}
.lookup-heading{display:flex;align-items:center;gap:13px}
.lookup-heading>i,.returning-records header>i{display:grid;place-items:center;width:44px;height:44px;flex:none;border-radius:12px;background:#ffe9dd;color:#de5732;font-style:normal;font-size:22px}
.lookup-heading>div{flex:1;min-width:0}
.assisted-page .registered-lookup h2{margin:0;font-size:20px}
.assisted-page .registered-lookup p{font-size:12px;line-height:1.6}
.assisted-page .registered-lookup-form{align-items:end}
.assisted-page .lookup-phone{flex:1;min-width:0}
.assisted-page .registered-lookup-form button{min-height:46px}
.family-match{display:flex;gap:12px;align-items:center;border:1px solid #eeded0;border-radius:10px;background:#fff;padding:14px;color:#3b5270;cursor:pointer;font:700 12px var(--font-body),sans-serif}
.family-match span{display:grid;flex:1;text-align:left}
.family-match small{display:block;margin-top:4px}
.returning-records{padding:24px;border:1px solid #dce9df;border-radius:14px;background:#fff}
.returning-records header{display:flex;align-items:center;gap:12px;margin:0}
.returning-records header>i{background:#e5f6ed;color:#138454}
.returning-records header>div{flex:1}
.assisted-page .returning-records h2{margin:0;font-size:22px}
.returning-records p{margin:5px 0 0;color:#71809a;font-size:12px;line-height:1.6}
.returning-records header>span{display:inline-flex;gap:5px;align-items:center;background:#edf8f1;border-radius:99px;padding:7px 10px;color:#138454;font-size:10px;font-weight:700}
.saved-family-contact{display:grid;grid-template-columns:1fr 1fr;gap:18px;border-top:1px solid #edf0f3;border-bottom:1px solid #edf0f3;padding:18px 0;margin:20px 0}
.saved-family-contact span{display:grid;gap:6px}
.saved-family-contact b{font-size:13px}
.returning-records h3{font:800 17px var(--font-body),sans-serif;margin:0}
.saved-children{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}
.assisted-page .saved-child{display:flex;align-items:center;gap:12px;border:1px solid #e2e7ed;border-radius:12px;padding:16px;background:#fff;cursor:pointer}
.assisted-page .saved-child.selected{border-color:#add9bf;background:#f4fbf6}
.assisted-page .saved-child input{width:18px;height:18px;flex:none;accent-color:#138454}
.saved-child-avatar{display:grid;place-items:center;flex:none;width:40px;height:40px;border:1px solid #e8dccb;border-radius:50%;background:#f5efe5;color:#795b38;font-size:11px;font-weight:800}
.saved-child>span:last-child{display:grid;gap:5px;min-width:0}
.saved-child b{font-size:13px;overflow-wrap:anywhere}
.saved-child small{font-size:11px;font-weight:500}
.saved-record-notice{display:flex;align-items:center;gap:8px;color:#6c7f73;font-size:11px;line-height:1.6}
.assisted-page .child-card{padding:22px;border-radius:14px;border-color:#e6e0d8}
.assisted-page .child-label{padding-bottom:14px;border-bottom:1px solid #edf0f3;margin-bottom:18px;font-size:14px}
.assisted-page .submit{min-height:50px;font-size:13px}
@media(max-width:650px){.assisted-page .assisted-form{padding:18px;gap:20px}.assisted-page .registered-lookup,.returning-records{padding:18px}.lookup-heading{flex-wrap:wrap}.lookup-heading>button{width:100%}.saved-children{grid-template-columns:1fr}.returning-records header{flex-wrap:wrap}.returning-records header>span{margin-left:56px}.assisted-page h1{font-size:30px!important}.saved-family-contact{grid-template-columns:1fr}.assisted-page .child-card{padding:18px}.assisted-page .registered-lookup-form{display:grid}.assisted-page .registered-lookup-form button{width:100%}}
.assisted-page{max-width:1100px}.assisted-page header{margin-bottom:22px}.assisted-page header>a{display:inline-flex;align-items:center;gap:6px;margin-bottom:17px;color:#546b93;font-size:12px;font-weight:800;text-decoration:none}.assisted-page h1,.assisted-page h2{font-family:var(--font-body),sans-serif}.assisted-page h1{margin:0}.assisted-page h2{margin:22px 0 7px;font-size:23px}.assisted-form{display:grid;gap:14px}.assisted-form label{display:grid;gap:6px;color:#5d574f;font-size:11px;font-weight:800}.assisted-form small{font-weight:500;color:var(--muted)}.assisted-form input,.assisted-form select,.assisted-form textarea{width:100%;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:#fffdfa;color:var(--ink);font:13px var(--font-body)}.assisted-form input,.assisted-form select{height:42px}.assisted-form textarea{min-height:76px;padding-top:10px;resize:vertical}.readonly-notice{margin:0;padding:11px 13px;border:1px solid #f0dfb6;border-radius:10px;background:#fff9e9;color:#896515;font-size:12px;line-height:1.45}.registered-lookup{display:grid;gap:10px;padding:15px;border:1px solid #f1d8c8;border-radius:10px;background:#fff8f3}.registered-lookup h2{margin:0;font-size:19px}.registered-lookup p{margin:3px 0 0;color:var(--muted);font-size:12px;line-height:1.45}.registered-lookup-form{display:flex;gap:9px}.registered-lookup input{height:40px;min-width:0;flex:1;border:1px solid var(--line);border-radius:8px;padding:0 10px;background:#fff;font:12px var(--font-body)}.registered-lookup button{white-space:nowrap}.registered-result{color:#087a4b!important;font-weight:800}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.guardian-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.wide{grid-column:span 2}.children-heading{display:flex;justify-content:space-between;align-items:end;margin-top:4px}.children-heading h2{margin-bottom:2px}.children-heading p,.pickup-section>p{margin:0;color:var(--muted);font-size:12px}.children-heading button{display:inline-flex;align-items:center;gap:5px;height:36px}.child-card{padding:15px;border:1px solid var(--line);border-radius:10px;background:#fff}.child-label{display:flex;justify-content:space-between;margin-bottom:12px;font-size:12px}.remove{border:0;background:transparent;color:#bd472f;font:800 11px var(--font-body);cursor:pointer;display:inline-flex;gap:4px;align-items:center}.pickup-section{border-top:1px solid var(--line);padding-top:4px}.pickup-section h2{margin-bottom:3px}.pickup-options{display:flex;gap:10px;margin:14px 0}.pickup-options button{min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:8px;background:#fff;font:700 12px var(--font-body);color:var(--ink);cursor:pointer}.pickup-options .selected{border-color:var(--orange);background:#fff4ef;color:var(--orange)}.submit{min-height:48px;justify-content:center;margin-top:4px}.error{margin:0;color:#bf422a;font-size:12px}@media(max-width:860px){.grid,.guardian-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wide{grid-column:span 2}}@media(max-width:500px){.grid,.guardian-grid{grid-template-columns:1fr}.wide{grid-column:auto}.children-heading{align-items:start;gap:12px}.children-heading button{white-space:nowrap}.pickup-options{display:grid}.pickup-options button{width:100%}.registered-lookup-form{display:grid}.registered-lookup button{width:100%;justify-content:center}}`;

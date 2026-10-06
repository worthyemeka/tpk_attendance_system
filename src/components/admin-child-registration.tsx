"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiInfo, FiPlus, FiTrash2, FiUserPlus, FiUsers } from "react-icons/fi";
import { AppSelect } from "./app-dropdown";
import { RelationshipField, validRelationship } from "./relationship-field";
import { apiBase, authHeaders, readTeacherSession, type TeacherSession } from "@/lib/session";
import { classForBirthDate } from "@/lib/automatic-class";
import { campusToday, registrationEligibility, underThreeMessage } from "@/lib/registration-eligibility";
import "./admin-child-registration.css";

type Child = { key:number;firstName:string;lastName:string;dateOfBirth:string;gender:string;classId:string;careInformation:string };
type Guardian = { firstName:string;lastName:string;phone:string;secondaryPhone:string;email:string;relationship:string;address:string };
type ClassOption = { id:number;name:string;ageLabel?:string;minAge:number;maxAge:number;displayOrder?:number };
type Saved = { familyId:number;children:Array<{id:number;firstName:string;lastName:string;classId:number}> };
const blankChild = (key:number):Child => ({key,firstName:"",lastName:"",dateOfBirth:"",gender:"",classId:"",careInformation:""});
const blankGuardian:Guardian = {firstName:"",lastName:"",phone:"",secondaryPhone:"",email:"",relationship:"",address:""};

export function AdminChildRegistration() {
  const [session,setSession] = useState<TeacherSession|null>(null);
  const [sessionReady,setSessionReady] = useState(false);
  const isSuper = session?.accessLevel === "TPK_SUPER_ADMIN";
  const [guardian,setGuardian] = useState<Guardian>(blankGuardian);
  const [children,setChildren] = useState<Child[]>([blankChild(1)]);
  const nextKey = useRef(2);
  const [classes,setClasses] = useState<ClassOption[]>([]);
  const [classesReady,setClassesReady] = useState(false);
  const [review,setReview] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState("");
  const [saved,setSaved] = useState<Saved|null>(null);
  const today = campusToday();

  useEffect(()=>{setSession(readTeacherSession());setSessionReady(true);},[]);

  useEffect(() => {
    if (!isSuper || !session) return;
    const controller = new AbortController();
    fetch(`${apiBase}/api/v1/classes`,{headers:authHeaders(session),signal:controller.signal})
      .then(async response=>{const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error?.message||"We couldn’t load the classes.");return body.data;})
      .then(data=>{if(!controller.signal.aborted){setClasses(data||[]);setClassesReady(true);}})
      .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:"Classes unavailable. Please reload this page.");});
    return()=>controller.abort();
  },[isSuper,session]);
  const updateGuardian=(field:keyof Guardian,value:string)=>setGuardian(current=>({...current,[field]:value}));
  const updateChild=(key:number,field:keyof Child,value:string)=>setChildren(current=>current.map(child=>child.key===key?{...child,[field]:value}:child));
  const completeChildren = children.every(child=>child.firstName.trim()&&child.lastName.trim()&&child.gender&&registrationEligibility(child.dateOfBirth,today)==="ELIGIBLE");
  const completeGuardian = Boolean(guardian.firstName.trim()&&guardian.lastName.trim()&&guardian.phone.trim()&&guardian.address.trim()&&validRelationship(guardian.relationship));
  const ready=classesReady&&completeChildren&&completeGuardian&&children.every(child=>classForBirthDate(classes,child.dateOfBirth,today));
  async function submit() {
    if(!session||!isSuper||!ready||saving)return;
    setSaving(true);setError("");
    try {
      const payload={guardian,children:children.map(({key,...child})=>({...child,classId:null}))};
      const response=await fetch(`${apiBase}/api/v1/children/registrations`,{method:"POST",headers:{...authHeaders(session),"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const body=await response.json();if(!response.ok||!body.success)throw new Error(body.error?.message||"We couldn’t save this registration.");
      setSaved(body.data);setReview(false);
    } catch(reason){setError(reason instanceof Error?reason.message:"Registration could not be saved.");}
    finally{setSaving(false);}
  }
  function restart(){setSaved(null);setReview(false);setChildren([blankChild(nextKey.current++)]);setGuardian(blankGuardian);setError("");}

  if(!sessionReady)return <section className="admin-registration" aria-busy="true"><h1>Child registration</h1><p role="status">Loading your registration workspace…</p></section>;
  if(!isSuper)return <section className="admin-registration"><h1>Child registration</h1><p>Only TPK Super Admins can register children here.</p><Link href="/account/children">Back to children</Link></section>;
  return <section className="admin-registration">
    <Link className="registration-back" href="/account/children"><FiArrowLeft/>Back to children</Link>
    <header><p className="eyebrow">Super admin · People</p><h1>Register children</h1><p>Add children to the TPK directory any day of the week, including records from your existing database.</p></header>
    <div className="registration-notice"><FiInfo/><p><b>Registration only — not a check-in</b><span>This saves child, guardian and family profiles. No attendance, pickup code or check-in PDF will be created.</span></p></div>
    {error&&<p className="registration-error" role="alert">{error}</p>}
    {saved?<section className="registration-success" role="status"><FiCheckCircle/><h2>{saved.children.length===1?"Child registered":"Children registered"}</h2><p>Their profiles are ready for a future Sunday check-in.</p><ul>{saved.children.map(child=><li key={child.id}><b>{child.firstName} {child.lastName}</b><span>{classes.find(item=>Number(item.id)===Number(child.classId))?.name||"Class assigned"}</span><Link href={`/account/children?childId=${child.id}`}>View profile <FiArrowRight/></Link></li>)}</ul><div className="registration-actions"><button type="button" onClick={restart}>Register more children</button><Link href="/account/children">Go to children <FiArrowRight/></Link></div></section>:review?<section className="registration-review"><h2>Review registration</h2><p>Check these records before adding them to the directory.</p><div className="registration-review-contact"><FiUsers/><div><small>New family · guardian</small><b>{guardian.firstName} {guardian.lastName}</b><span>{guardian.relationship} · {guardian.phone}</span></div></div><div className="registration-review-children">{children.map(child=><article key={child.key}><h3>{child.firstName} {child.lastName}</h3><p>Born {new Intl.DateTimeFormat("en-NG",{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"}).format(new Date(`${child.dateOfBirth}T12:00:00Z`))} · {child.gender==="MALE"?"Male":"Female"}</p><b>{classForBirthDate(classes,child.dateOfBirth,today)?.name || "No matching class"}</b>{child.careInformation&&<p>Care information added</p>}</article>)}</div><div className="registration-actions"><button type="button" disabled={saving} onClick={()=>{setReview(false);setError("");}}>Edit details</button><button type="button" className="solid-button" disabled={saving||!ready} onClick={()=>void submit()}>{saving?"Saving…":"Save registration"}<FiCheckCircle/></button></div></section>:<form onSubmit={event=>{event.preventDefault();if(ready){setError("");setReview(true);}}}>
      <section className="registration-section"><header><i>1</i><div><h2>Parent or guardian</h2><p>These details link the children to their family and help the team contact them.</p></div></header>
        <div className="registration-fields"><label>First name<input required maxLength={100} autoComplete="given-name" value={guardian.firstName} onChange={event=>updateGuardian("firstName",event.target.value)}/></label><label>Last name<input required maxLength={100} autoComplete="family-name" value={guardian.lastName} onChange={event=>updateGuardian("lastName",event.target.value)}/></label><label>Phone number<input required type="tel" autoComplete="tel" placeholder="0803 123 4567" value={guardian.phone} onChange={event=>updateGuardian("phone",event.target.value)}/></label><RelationshipField value={guardian.relationship} onChange={value=>updateGuardian("relationship",value)}/><label>Second phone <small>Optional</small><input type="tel" value={guardian.secondaryPhone} onChange={event=>updateGuardian("secondaryPhone",event.target.value)}/></label><label>Email <small>Optional</small><input type="email" value={guardian.email} onChange={event=>updateGuardian("email",event.target.value)}/></label><label className="registration-wide">Home address<textarea required rows={2} maxLength={1000} value={guardian.address} onChange={event=>updateGuardian("address",event.target.value)}/></label></div>
      </section>
      <section className="registration-section"><header><i>2</i><div><h2>Children to register</h2><p>Only add children who are not already in the directory. Children must be at least 3 years old.</p></div><button type="button" disabled={children.length>=20} onClick={()=>setChildren(current=>[...current,blankChild(nextKey.current++)])}><FiPlus/>Add child</button></header>
        {children.map((child,index)=><article className="registration-child" key={child.key}><header><h3>Child {index+1}</h3>{children.length>1&&<button type="button" aria-label={`Remove child ${index+1}`} onClick={()=>setChildren(current=>current.filter(item=>item.key!==child.key))}><FiTrash2/>Remove</button>}</header><div className="registration-fields"><label>First name<input required maxLength={100} value={child.firstName} onChange={event=>updateChild(child.key,"firstName",event.target.value)}/></label><label>Last name<input required maxLength={100} value={child.lastName} onChange={event=>updateChild(child.key,"lastName",event.target.value)}/></label><label>Date of birth<input required type="date" max={today} value={child.dateOfBirth} onChange={event=>updateChild(child.key,"dateOfBirth",event.target.value)}/></label><label>Gender<AppSelect aria-label={`Child ${index+1} gender`} value={child.gender} required onChange={event=>updateChild(child.key,"gender",event.target.value)}><option value="">Choose gender</option><option value="MALE">Male</option><option value="FEMALE">Female</option></AppSelect></label><div className="registration-auto-class"><small>Automatically assigned class</small><b>{!classesReady?"Loading classes…":!child.dateOfBirth?"Enter a birth date to see the class":classForBirthDate(classes,child.dateOfBirth,today)?.name || "No class matches this age"}</b><span>Based on their age today. No manual selection needed.</span></div><label className="registration-wide">Care information <small>Optional — allergies or needs the team should know</small><textarea rows={2} maxLength={4000} value={child.careInformation} onChange={event=>updateChild(child.key,"careInformation",event.target.value)}/></label></div>{child.dateOfBirth&&registrationEligibility(child.dateOfBirth,today)!=="ELIGIBLE"&&<p role="alert" className="registration-error">{registrationEligibility(child.dateOfBirth,today)==="UNDER_THREE"?underThreeMessage:"Enter a valid date of birth that is not in the future."}</p>}</article>)}
      </section><div className="registration-actions"><Link href="/account/children">Cancel</Link><button className="solid-button" type="submit" disabled={!ready}>Review registration <FiArrowRight/></button></div>
    </form>}
  </section>;
}

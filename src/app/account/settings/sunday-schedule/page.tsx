"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { readTeacherSession } from "@/lib/session";
import { SundayServiceSettings } from "@/components/sunday-service-settings";
export default function SundaySchedulePage() {
  const [access,setAccess]=useState<boolean|null>(null);
  useEffect(()=>setAccess(readTeacherSession()?.accessLevel==="TPK_SUPER_ADMIN"),[]);
  return <section><Link href="/account/settings"><FiArrowLeft/> Back to settings</Link><p className="eyebrow">Service planning</p><h1>Sunday schedule</h1><p className="intro">Choose a Sunday and plan its services. Roster assignments are managed in Team &amp; Roster.</p>{access===null?<p>Checking access…</p>:access?<SundayServiceSettings/>:<p>Only Super Admins can change the Sunday schedule.</p>}</section>;
}

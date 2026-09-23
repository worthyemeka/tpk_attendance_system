"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { apiBase } from "@/lib/session";

export default function TeacherVerifyPage() {
  const params = useSearchParams(); const [state, setState] = useState<"loading" | "success" | "error">("loading"); const [message, setMessage] = useState("");
  useEffect(() => { const token = params.get("token"); if (!token) { setState("error"); setMessage("This verification link is incomplete."); return; } fetch(`${apiBase}/api/teachers/verify?token=${encodeURIComponent(token)}`).then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "We could not verify this account."); setMessage(data.message); setState("success"); }).catch((reason) => { setMessage(reason instanceof Error ? reason.message : "We could not verify this account."); setState("error"); }); }, [params]);
  return <main className="verify-page"><section><p className="eyebrow">TribePetra Kids · Petra Wuse</p>{state === "loading" ? <><h1>Verifying your account…</h1><p>One moment while we confirm your WhatsApp number.</p></> : <>{state === "success" && <FiCheckCircle className="verify-icon" />}<h1>{state === "success" ? "Account Verified" : "Verification unavailable"}</h1><p>{message}</p>{state === "success" && <Link className="solid-button" href="/teacher/login">Continue to Sign In</Link>}</>}</section><style jsx>{`.verify-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--cream)}.verify-page section{width:min(100%,520px);padding:42px;background:var(--paper);border:1px solid var(--line);border-radius:14px;text-align:center}.verify-page h1{font:700 37px/1.05 Georgia,serif;margin:12px 0}.verify-page p:not(.eyebrow){color:#647084;line-height:1.6}.verify-icon{color:var(--green);font-size:44px}.solid-button{display:inline-flex;margin-top:16px;text-decoration:none}`}</style></main>;
}

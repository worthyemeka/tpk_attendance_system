"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { FiArrowLeft, FiCheckCircle } from "react-icons/fi";
import { apiBase } from "@/lib/session";

export default function TeacherVerifyPage() {
  const params = useSearchParams();
  const [whatsappNumber, setWhatsappNumber] = useState(params.get("whatsappNumber") || "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/teachers/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ whatsappNumber, code }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "We could not verify this account.");
      setVerified(true);
      window.setTimeout(() => window.location.assign("/teacher/login"), 900);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not verify this account.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="teacher-verify-page"><section className="teacher-verify-card"><Link className="teacher-verify-back" href="/teacher/sign-up"><FiArrowLeft /> Back to registration</Link>{verified ? <><FiCheckCircle className="teacher-verify-icon" /><p className="teacher-verify-eyebrow">Verified</p><h1>Account verified</h1><p>Your WhatsApp number is confirmed. Taking you to teacher sign in...</p></> : <><p className="teacher-verify-eyebrow">WhatsApp verification</p><h1>Enter your verification code</h1><p>We sent a six-digit code to your WhatsApp number. Enter it below to activate your account.</p><form onSubmit={submit}><label>WhatsApp number<input autoComplete="tel" onChange={(event) => setWhatsappNumber(event.target.value)} required type="tel" value={whatsappNumber} /></label><label>Verification code<input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} pattern="[0-9]{6}" placeholder="000000" required value={code} /></label>{error && <p className="teacher-verify-error" role="alert">{error}</p>}<button className="teacher-verify-submit" disabled={busy} type="submit">{busy ? "Verifying..." : "Verify account"}</button></form></>}</section><style jsx>{`.teacher-verify-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:#fdf9f2;color:#091936}.teacher-verify-card{width:min(100%,520px);padding:38px;background:#fff;border:1px solid #e9e3da;border-radius:14px;box-shadow:0 14px 45px #16253c0d}.teacher-verify-back{display:inline-flex;align-items:center;gap:7px;color:#566b91;font-size:12px;font-weight:800;text-decoration:none}.teacher-verify-eyebrow{margin:30px 0 8px;color:#e54829;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:1.4px}.teacher-verify-card h1{margin:0;font:700 34px/1.08 Georgia,serif}.teacher-verify-card p:not(.teacher-verify-eyebrow):not(.teacher-verify-error){color:#697083;line-height:1.6}.teacher-verify-card form{display:grid;gap:15px;margin-top:25px}.teacher-verify-card label{display:grid;gap:7px;color:#4c5361;font-size:11px;font-weight:800}.teacher-verify-card input{height:44px;border:1px solid #cfd7e3;border-radius:9px;padding:0 12px;color:#10213d;font:14px var(--font-body)}.teacher-verify-card label:nth-of-type(2) input{text-align:center;letter-spacing:.35em;font-size:21px;font-weight:800}.teacher-verify-submit{height:44px;border:0;border-radius:8px;background:#ff5d34;color:#fff;font:800 12px var(--font-body);cursor:pointer}.teacher-verify-submit:disabled{opacity:.6}.teacher-verify-error{margin:0;padding:11px 12px;border-radius:8px;background:#fff0ed;color:#c53d24;font-size:12px}.teacher-verify-icon{display:block;margin:30px auto 0;color:#078d61;font-size:48px}`}</style></main>;
}

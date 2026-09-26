"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { FiAlertCircle, FiArrowLeft, FiArrowRight, FiCheck, FiChevronDown, FiEye, FiEyeOff } from "react-icons/fi";
import { ParentPhotoSlider } from "@/components/parent-photo-slider";
import { ProfilePhotoEditor } from "@/components/profile-photo-editor";
import { apiBase, saveTeacherSession, type TeacherSession } from "@/lib/session";

const steps = ["Your details", "Contact", "Security"];
const NIGERIA_COUNTRY_CODE = "+234";
type Props = { mode: "login" | "signup" };
type Values = { gender: "" | "FEMALE" | "MALE"; firstName: string; lastName: string; birthDate: string; whatsappNumber: string; mobileNumber: string; email: string; residentialAddress: string; password: string; confirmPassword: string; profilePhoto: File | null };
const initial: Values = { gender: "", firstName: "", lastName: "", birthDate: "", whatsappNumber: "", mobileNumber: "", email: "", residentialAddress: "", password: "", confirmPassword: "", profilePhoto: null };

/** Accept 080…, 809… and pasted +234… input, while retaining only the local 10 digits in the form. */
function normaliseNigerianSubscriber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits.slice(3, 13);
  if (digits.startsWith("0")) return digits.slice(1, 11);
  return digits.slice(0, 10);
}

function toNigerianE164(value: string): string {
  const subscriber = normaliseNigerianSubscriber(value);
  return subscriber.length === 10 ? `${NIGERIA_COUNTRY_CODE}${subscriber}` : "";
}

function passwordStrength(password: string) {
  const score = [password.length >= 8, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  if (!password) return { score: 0, label: "Choose a password", hint: "Use 8+ characters with a mix of letters, numbers and symbols." };
  if (score <= 2) return { score, label: "Weak", hint: "Add upper-case letters, numbers or a symbol." };
  if (score === 3) return { score, label: "Fair", hint: "A little more variety will make this stronger." };
  if (score === 4) return { score, label: "Good", hint: "Add a symbol for the strongest password." };
  return { score, label: "Strong", hint: "This is a strong password." };
}

function BirthDateField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const initial = value ? value.split("-") : ["", "", ""];
  const [day, setDay] = useState(initial[2] || ""); const [month, setMonth] = useState(initial[1] || ""); const [year, setYear] = useState(initial[0] || "");
  const dayInput = useRef<HTMLInputElement>(null); const monthInput = useRef<HTMLInputElement>(null); const yearInput = useRef<HTMLInputElement>(null);
  const publish = (nextDay: string, nextMonth: string, nextYear: string) => {
    if (nextDay.length !== 2 || nextMonth.length !== 2 || nextYear.length !== 4) return onChange("");
    const candidate = `${nextYear}-${nextMonth}-${nextDay}`; const date = new Date(`${candidate}T00:00:00Z`);
    onChange(!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate && candidate <= new Date().toISOString().slice(0, 10) ? candidate : "");
  };
  const digits = (input: string, length: number) => input.replace(/\D/g, "").slice(0, length);
  const publishFromInputs = (overrides: { day?: string; month?: string; year?: string } = {}) => {
    const nextDay = overrides.day ?? digits(dayInput.current?.value || "", 2);
    const nextMonth = overrides.month ?? digits(monthInput.current?.value || "", 2);
    const nextYear = overrides.year ?? digits(yearInput.current?.value || "", 4);
    publish(nextDay, nextMonth, nextYear);
  };
  useEffect(() => {
    // Safari can fill date fragments without emitting React input events. Read
    // those values once the browser has completed autofill so Continue reflects
    // what the teacher can actually see on screen.
    const syncAutofill = () => {
      const nextDay = digits(dayInput.current?.value || "", 2);
      const nextMonth = digits(monthInput.current?.value || "", 2);
      const nextYear = digits(yearInput.current?.value || "", 4);
      if (!nextDay && !nextMonth && !nextYear) return;
      setDay(nextDay); setMonth(nextMonth); setYear(nextYear); publish(nextDay, nextMonth, nextYear);
    };
    const early = window.setTimeout(syncAutofill, 100);
    const settled = window.setTimeout(syncAutofill, 700);
    return () => { window.clearTimeout(early); window.clearTimeout(settled); };
  // This needs to run only after the three native inputs have mounted.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // Commit after React has accepted each date fragment. This also covers
    // browser autofill, which can populate the fields between input events.
    publish(day, month, year);
  }, [day, month, year]);
  return <div className="teacher-birth-date"><span>Date of birth</span><span className="teacher-date-fields"><input aria-label="Day of birth" autoComplete="bday-day" inputMode="numeric" maxLength={2} name="birthDay" onChange={(event) => { const next = digits(event.currentTarget.value, 2); setDay(next); publishFromInputs({ day: next }); if (next.length === 2) monthInput.current?.focus(); }} placeholder="DD" ref={dayInput} value={day} /><input aria-label="Month of birth" autoComplete="bday-month" inputMode="numeric" maxLength={2} name="birthMonth" onChange={(event) => { const next = digits(event.currentTarget.value, 2); setMonth(next); publishFromInputs({ month: next }); if (next.length === 2) yearInput.current?.focus(); }} placeholder="MM" ref={monthInput} value={month} /><input aria-label="Year of birth" autoComplete="bday-year" inputMode="numeric" maxLength={4} name="birthYear" onChange={(event) => { const next = digits(event.currentTarget.value, 4); setYear(next); publishFromInputs({ year: next }); }} placeholder="YYYY" ref={yearInput} value={year} /></span><small>Enter day, month, then year.</small><style jsx>{`.teacher-birth-date{display:grid;gap:7px;color:#4c5361;font-size:11px;font-weight:800}.teacher-date-fields{display:grid;grid-template-columns:1fr 1fr 1.45fr;gap:8px}.teacher-date-fields input{width:100%;min-width:0;height:44px;border:1px solid #cfd7e3;border-radius:9px;padding:0 12px;background:#fff;color:#10213d;text-align:center;font:800 13px var(--font-body);letter-spacing:.4px;outline-color:#ff5d34}.teacher-date-fields input::placeholder{color:#9aa7ba;font-weight:700;letter-spacing:0}.teacher-birth-date small{color:#687184;font-size:10px;font-weight:600}`}</style></div>;
}

export function TeacherAuth({ mode }: Props) {
  const signup = mode === "signup";
  const [step, setStep] = useState(0); const [values, setValues] = useState<Values>(initial);
  const signupFormRef = useRef<HTMLFormElement>(null);
  const [login, setLogin] = useState({ identifier: "", password: "" }); const [showPassword, setShowPassword] = useState(false);
  const [genderOpen, setGenderOpen] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const update = <K extends keyof Values>(key: K, value: Values[K]) => setValues((current) => ({ ...current, [key]: value }));
  const required = [["gender", "firstName", "lastName", "birthDate"], ["whatsappNumber", "email", "residentialAddress"], ["password", "confirmPassword"]] as const;
  const contactNumbersAreValid = Boolean(toNigerianE164(values.whatsappNumber)) && (!values.mobileNumber || Boolean(toNigerianE164(values.mobileNumber)));
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim());
  const matchingPassword = values.password.length >= 8 && values.password === values.confirmPassword;
  const canContinue = signup && required[step].every((key) => Boolean(typeof values[key] === "string" ? values[key].trim() : values[key])) && (step !== 1 || (contactNumbersAreValid && validEmail)) && (step !== 2 || matchingPassword);
  const strength = passwordStrength(values.password);
  const loginReady = Boolean(login.identifier.trim() && login.password);
  const genderLabel = values.gender === "FEMALE" ? "Female" : values.gender === "MALE" ? "Male" : "Select gender";

  useEffect(() => {
    if (!signup) return;
    // Browser password/address managers can fill native inputs after hydration
    // without dispatching input/change. Keep React state in sync so validation,
    // disabled buttons and the submitted record agree with the visible form.
    const syncAutofill = () => {
      const form = signupFormRef.current;
      if (!form) return;
      const read = (name: string) => String(new FormData(form).get(name) || "").trim();
      const filled = {
        firstName: read("firstName"), lastName: read("lastName"),
        whatsappNumber: normaliseNigerianSubscriber(read("whatsappNumber")),
        mobileNumber: normaliseNigerianSubscriber(read("mobileNumber")),
        email: read("email"), residentialAddress: read("street-address"),
        password: read("password"), confirmPassword: read("confirmPassword"),
      };
      if (!Object.values(filled).some(Boolean)) return;
      setValues((current) => ({ ...current, ...Object.fromEntries(Object.entries(filled).filter(([, value]) => value)) }));
    };
    const early = window.setTimeout(syncAutofill, 100);
    const settled = window.setTimeout(syncAutofill, 700);
    return () => { window.clearTimeout(early); window.clearTimeout(settled); };
  }, [signup]);

  function continueSignup() {
    const form = signupFormRef.current;
    if (!form) return;
    setError("");
    const formData = new FormData(form);
    const read = (name: string) => String(formData.get(name) || "").trim();
    if (step === 0) {
      const day = read("birthDay").replace(/\D/g, "").slice(0, 2);
      const month = read("birthMonth").replace(/\D/g, "").slice(0, 2);
      const year = read("birthYear").replace(/\D/g, "").slice(0, 4);
      const candidate = `${year}-${month}-${day}`;
      const date = new Date(`${candidate}T00:00:00Z`);
      const birthDate = day.length === 2 && month.length === 2 && year.length === 4 && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === candidate && candidate <= new Date().toISOString().slice(0, 10) ? candidate : "";
      const gender = read("gender").toUpperCase() as Values["gender"];
      const next = { ...values, gender, firstName: read("firstName"), lastName: read("lastName"), birthDate };
      setValues(next);
      if (!next.gender || !next.firstName || !next.lastName || !birthDate) { setError("Choose a gender and complete your name and date of birth to continue."); return; }
    }
    if (step === 1) {
      const next = { ...values, whatsappNumber: normaliseNigerianSubscriber(read("whatsappNumber")), mobileNumber: normaliseNigerianSubscriber(read("mobileNumber")), email: read("email"), residentialAddress: read("street-address") };
      setValues(next);
      if (!toNigerianE164(next.whatsappNumber) || (next.mobileNumber && !toNigerianE164(next.mobileNumber)) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.email) || !next.residentialAddress) { setError("Complete your contact details with a valid email and Nigerian phone number to continue."); return; }
    }
    setStep((current) => Math.min(2, current + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      let response: Response;
      if (signup) {
        const whatsappNumber = toNigerianE164(values.whatsappNumber);
        const mobileNumber = values.mobileNumber ? toNigerianE164(values.mobileNumber) : "";
        if (!whatsappNumber || (values.mobileNumber && !mobileNumber)) throw new Error("Enter a valid Nigerian phone number with 10 digits after +234.");
        const registrationValues = { ...values, whatsappNumber, mobileNumber };
        const form = new FormData();
        Object.entries(registrationValues).forEach(([key, value]) => { if (key !== "profilePhoto" && value) form.append(key, value); });
        if (values.profilePhoto) form.append("profilePhoto", values.profilePhoto);
        response = await fetch(`${apiBase}/api/teachers/register`, { method: "POST", body: form });
        const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "The TPK service could not complete that request.");
        window.location.assign("/teacher/login?registered=1");
        return;
      } else response = await fetch(`${apiBase}/api/teachers/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(login) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "The TPK sign-in service is temporarily unavailable.");
      saveTeacherSession({ ...data.teacher, sessionToken: data.sessionToken } as TeacherSession); window.location.assign("/account/overview");
    } catch (reason) { const message = reason instanceof Error ? reason.message : ""; setError(/failed to fetch|load failed|networkerror/i.test(message) ? "The TPK sign-in service cannot be reached right now. Please try again shortly or contact a Super Admin." : (message || "Please try again.")); } finally { setBusy(false); }
  }
  const field = (key: keyof Values, label: string, type = "text", autoComplete?: string) => <label htmlFor={`teacher-${key}`}>{label}<input autoComplete={autoComplete} id={`teacher-${key}`} name={key} type={type} value={typeof values[key] === "string" ? values[key] : ""} onChange={(event) => update(key, event.currentTarget.value as never)} onInput={(event) => update(key, event.currentTarget.value as never)} required /></label>;
  const phoneField = (key: "whatsappNumber" | "mobileNumber", label: string, helper?: string) => <label htmlFor={`teacher-${key}`}>{label}<span className="teacher-phone-control"><select aria-label="Country code" className="teacher-country-select" defaultValue="NG"><option value="NG">NG +234</option></select><input autoComplete="tel-national" id={`teacher-${key}`} inputMode="numeric" maxLength={10} name={key} placeholder="809 866 6128" required={key === "whatsappNumber"} type="tel" value={normaliseNigerianSubscriber(values[key])} onChange={(event) => update(key, normaliseNigerianSubscriber(event.currentTarget.value))} onInput={(event) => update(key, normaliseNigerianSubscriber(event.currentTarget.value))} /></span>{helper && <small>{helper}</small>}</label>;

  return <main className="teacher-auth-page"><ParentPhotoSlider audience="teacher" /><section className="teacher-auth-main">
    <header className="teacher-auth-top"><Link href="/"><FiArrowLeft /> Back</Link><span>Teacher access</span></header>
    {signup && <nav className="teacher-auth-progress" aria-label="Teacher registration progress">{steps.map((label, index) => <span className={index < step ? "done" : index === step ? "active" : ""} key={label}><i>{index < step ? <FiCheck /> : index + 1}</i>{label}</span>)}</nav>}
    <section className="teacher-auth-card"><p className="teacher-auth-eyebrow">TribePetra Kids</p><h1>{signup ? "Join the TPK Team Portal" : "Welcome back"}</h1><p className="teacher-auth-intro">{signup ? "Create your account to access your TribePetra Kids assignments and tools." : "Sign in with your email address or WhatsApp number."}</p>
      <form className="teacher-auth-form" onSubmit={submit} ref={signup ? signupFormRef : undefined}>{signup ? <>
        {step === 0 && <><input name="gender" type="hidden" value={values.gender} /><div className="teacher-photo-row"><ProfilePhotoEditor value={values.profilePhoto} onChange={(profilePhoto) => update("profilePhoto", profilePhoto)} /></div><div className="teacher-field-label"><span>Gender</span><span className={`teacher-dropdown${genderOpen ? " open" : ""}`}><button aria-expanded={genderOpen} aria-haspopup="listbox" className="teacher-dropdown-trigger" onClick={() => setGenderOpen((open) => !open)} type="button"><span>{genderLabel}</span><FiChevronDown aria-hidden="true" /></button>{genderOpen && <span className="teacher-dropdown-menu" role="listbox" aria-label="Gender">{([['FEMALE', 'Female'], ['MALE', 'Male']] as const).map(([value, label]) => <button aria-selected={values.gender === value} key={value} onClick={() => { update("gender", value); setGenderOpen(false); }} role="option" type="button"><span>{label}</span></button>)}</span>}</span></div><div className="teacher-auth-grid">{field("firstName", "First name", "text", "given-name")}{field("lastName", "Last name", "text", "family-name")}</div><div className="teacher-birth-date-row"><BirthDateField value={values.birthDate} onChange={(birthDate) => update("birthDate", birthDate)} /></div></>}
        {step === 1 && <>{phoneField("whatsappNumber", "WhatsApp Number", "Enter the 10 Nigerian digits after +234.")}{phoneField("mobileNumber", "Mobile Number", "Leave blank if same as WhatsApp number.")}{field("email", "Email Address", "email", "email")}<label htmlFor="teacher-residentialAddress">House Address<textarea autoComplete="street-address" id="teacher-residentialAddress" name="street-address" required value={values.residentialAddress} onChange={(event) => update("residentialAddress", event.currentTarget.value)} onInput={(event) => update("residentialAddress", event.currentTarget.value)} placeholder="House number, street, area, city" /><small>Your saved browser address can be autofilled here.</small></label></>}
        {step === 2 && <><label htmlFor="teacher-password">Password<span className="teacher-password-field"><input autoComplete="new-password" id="teacher-password" minLength={8} name="password" type={showPassword ? "text" : "password"} required value={values.password} onChange={(event) => update("password", event.currentTarget.value)} onInput={(event) => update("password", event.currentTarget.value)} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)} type="button">{showPassword ? <FiEyeOff /> : <FiEye />}</button></span><span aria-live="polite" className={`password-strength strength-${strength.score}`}><span className="password-strength-track"><i style={{ width: `${strength.score * 20}%` }} /></span><b>{strength.label}</b><small>{strength.hint}</small></span></label><label htmlFor="teacher-confirmPassword">Confirm Password<input autoComplete="new-password" id="teacher-confirmPassword" minLength={8} name="confirmPassword" type={showPassword ? "text" : "password"} required value={values.confirmPassword} onChange={(event) => update("confirmPassword", event.currentTarget.value)} onInput={(event) => update("confirmPassword", event.currentTarget.value)} />{values.confirmPassword && <small className={values.confirmPassword === values.password ? "password-match" : "password-mismatch"}>{values.confirmPassword === values.password ? "Passwords match." : "Passwords do not match yet."}</small>}</label></>}
        <div className={`teacher-auth-actions${step > 0 ? " has-back" : ""}`}>{step > 0 && <button className="teacher-auth-secondary" type="button" onClick={() => setStep((current) => current - 1)}><FiArrowLeft /> Back</button>}{step < 2 ? <button className="teacher-auth-submit" disabled={busy} type="button" onClick={continueSignup}>Continue <FiArrowRight /></button> : <button className="teacher-auth-submit" disabled={busy || !canContinue} type="submit">{busy ? "Creating account..." : "Create account"}</button>}</div>
        </> : <><label htmlFor="teacher-identifier">Email or WhatsApp Number<input autoComplete="username" id="teacher-identifier" name="identifier" required value={login.identifier} onChange={(event) => setLogin({ ...login, identifier: event.currentTarget.value })} onInput={(event) => setLogin({ ...login, identifier: event.currentTarget.value })} /></label><label htmlFor="teacher-login-password">Password<span className="teacher-password-field"><input autoComplete="current-password" id="teacher-login-password" name="password" type={showPassword ? "text" : "password"} required value={login.password} onChange={(event) => setLogin({ ...login, password: event.currentTarget.value })} onInput={(event) => setLogin({ ...login, password: event.currentTarget.value })} /><button aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((shown) => !shown)} type="button">{showPassword ? <FiEyeOff /> : <FiEye />}</button></span></label><Link className="forgot-password" href="mailto:admin@petrachurch.ng?subject=TPK%20password%20reset">Forgot Password?</Link><button className="teacher-auth-submit teacher-login-submit" disabled={busy || !loginReady} type="submit">{busy ? "Signing in..." : "Sign in"}</button></>}
        {error && <p className="teacher-auth-error" role="alert"><FiAlertCircle /><span>{error}</span></p>}{message && <p className="teacher-auth-message" role="status"><FiCheck /><span>{message}</span></p>}
      </form><p className="teacher-auth-switch">{signup ? "Already registered?" : "Need an account?"} <Link href={signup ? "/teacher/login" : "/teacher/sign-up"}>{signup ? "Sign in" : "Register"}</Link></p>
    </section>
    <style jsx>{`.teacher-auth-page{min-height:100vh;display:grid;grid-template-columns:minmax(360px,44vw) 1fr;background:#fffdf9;color:#091936}.teacher-auth-page :global(.parent-photo-slider){position:fixed;inset:0 auto 0 0;width:min(44vw,710px);overflow:hidden;background:#11241c;color:#fff}.teacher-auth-main{grid-column:2;padding:33px clamp(28px,7vw,106px) 46px}.teacher-auth-top{display:flex;justify-content:space-between;color:#566b91;font-size:13px}.teacher-auth-top a{display:flex;align-items:center;gap:7px;color:inherit;text-decoration:none;font-weight:700}.teacher-auth-progress{width:min(100%,650px);display:grid;grid-template-columns:repeat(3,1fr);margin:36px auto 0}.teacher-auth-progress span{display:grid;justify-items:center;gap:7px;color:#a0aabd;font-size:11px;text-align:center}.teacher-auth-progress i{display:grid;place-items:center;width:31px;height:31px;border:1px solid #d8deea;border-radius:50%;font-style:normal}.teacher-auth-progress .active{color:#ef4b28;font-weight:800}.teacher-auth-progress .active i{border-color:#ef4b28;background:#fff0eb}.teacher-auth-progress .done{color:#078d61}.teacher-auth-progress .done i{border-color:#078d61;background:#e7f8ef}.teacher-auth-card{width:min(100%,650px);margin:35px auto 0;padding:34px 40px;background:#fff;border:1px solid #e9e3da;border-radius:14px;box-shadow:0 14px 45px #16253c0d}.teacher-auth-eyebrow{margin:0 0 8px;color:#e54829;text-transform:uppercase;font-size:10px;font-weight:900;letter-spacing:1.4px}.teacher-auth-card h1{margin:0;font:700 34px/1.08 Georgia,serif;letter-spacing:-.8px}.teacher-auth-intro{margin:10px 0 24px;color:#697083;font-size:13px;line-height:1.5}.teacher-auth-form{display:grid;gap:15px}.teacher-auth-form label{display:grid;gap:7px;color:#4c5361;font-size:11px;font-weight:800}.teacher-auth-form small{color:#687184;font-size:10px;font-weight:600}.teacher-auth-form input,.teacher-auth-form select,.teacher-auth-form textarea{width:100%;border:1px solid #cfd7e3;border-radius:9px;background:#fff;color:#10213d;font:13px var(--font-body);outline-color:#ff5d34}.teacher-auth-form input,.teacher-auth-form select{height:44px;padding:0 12px}.teacher-auth-form textarea{min-height:72px;padding:11px 12px;resize:vertical}.teacher-select-wrap{position:relative;display:block}.teacher-select-wrap select{appearance:none;padding-right:42px;background:#f9fbff;border-color:#c9d5e4;font-weight:800;cursor:pointer}.teacher-select-wrap svg{position:absolute;right:14px;top:50%;pointer-events:none;color:#e54d2a;font-size:17px;transform:translateY(-50%)}.teacher-phone-control{display:flex;height:46px;overflow:hidden;border:1px solid #c9d5e4;border-radius:10px;background:#fff;box-shadow:0 1px 0 #1b2d4d05}.teacher-country-code{display:inline-flex;align-items:center;gap:6px;min-width:150px;padding:0 13px;border-right:1px solid #dbe3ee;background:#f3f7fc;color:#314766;font-size:11px;white-space:nowrap}.teacher-country-code b{font-weight:800}.teacher-country-code em{color:#e54d2a;font-style:normal;font-weight:900}.teacher-phone-control input{height:44px!important;min-width:0;border:0!important;border-radius:0!important;flex:1}.teacher-phone-control:focus-within{border-color:#ff5d34;box-shadow:0 0 0 3px #ff5d3420}.teacher-auth-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.teacher-password-field{position:relative;display:block}.teacher-password-field input{padding-right:42px}.teacher-password-field button{position:absolute;right:8px;top:50%;display:grid;place-items:center;border:0;background:transparent;color:#60708a;transform:translateY(-50%);cursor:pointer}.password-strength{display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:8px;row-gap:4px;margin-top:1px}.password-strength-track{display:block;grid-column:1/-1;height:5px;overflow:hidden;border-radius:999px;background:#e7ebf1}.password-strength-track i{display:block;height:100%;border-radius:inherit;background:#c8ced8;transition:width .18s ease,background .18s ease}.password-strength b{font-size:10px}.password-strength small{grid-column:1/-1!important}.strength-1 .password-strength-track i,.strength-2 .password-strength-track i{background:#db573b}.strength-3 .password-strength-track i{background:#db9a32}.strength-4 .password-strength-track i,.strength-5 .password-strength-track i{background:#078d61}.strength-4 b,.strength-5 b,.password-match{color:#078d61!important}.password-mismatch{color:#ca422b!important}.teacher-auth-actions{display:flex;justify-content:space-between;gap:12px;margin-top:4px}.teacher-auth-submit,.teacher-auth-secondary{height:44px;border:0;border-radius:8px;padding:0 17px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font:800 12px var(--font-body);cursor:pointer}.teacher-auth-submit{margin-left:auto;background:#ff5d34;color:#fff;box-shadow:0 5px 12px #ff5d3422}.teacher-auth-secondary{background:#fff;color:#566b91;border:1px solid #d8deea}.teacher-auth-submit:disabled{background:#d9dfe7;color:#8b96a5;box-shadow:none;cursor:not-allowed}.teacher-auth-error,.teacher-auth-message{margin:0;padding:11px 12px;border-radius:8px;font-size:12px}.teacher-auth-error{background:#fff0ed;color:#c53d24}.teacher-auth-message{background:#e7f8ef;color:#08734e}.teacher-auth-switch{margin:20px 0 0;color:#697083;font-size:12px;text-align:center}.teacher-auth-switch a,.forgot-password,.development-link{color:#e54829;font-weight:800}.forgot-password{font-size:11px;text-decoration:none}.development-link{font-size:11px}.teacher-auth-page :global(.parent-photo-slider-copy h2){font-family:Georgia,serif}.teacher-auth-page :global(.profile-photo-editor){display:grid;gap:11px;padding:16px;border:1px solid #dfe5ef;border-radius:13px;background:#fbfcff}.teacher-auth-page :global(.profile-photo-editor-heading){display:flex;align-items:start;justify-content:space-between;gap:12px}.teacher-auth-page :global(.profile-photo-editor-heading span){display:block;color:#13254a;font-size:12px;font-weight:900}.teacher-auth-page :global(.profile-photo-editor-content){display:flex;align-items:center;gap:17px}.teacher-auth-page :global(.profile-photo-preview){display:grid;flex:0 0 auto;place-items:center;width:104px;height:104px;overflow:hidden;border:3px solid #fff;border-radius:50%;background:#e8f4ed;box-shadow:0 0 0 1px #cfd9e8;color:#0a8d64;font-size:20px;font-weight:900}.teacher-auth-page :global(.profile-photo-preview img){width:100%;height:100%;object-fit:cover;transform-origin:center}.teacher-auth-page :global(.profile-photo-controls){display:grid;flex:1;gap:9px}.teacher-auth-page :global(.profile-photo-file-input){position:absolute;width:1px!important;height:1px!important;padding:0!important;border:0!important;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.teacher-auth-page :global(.profile-photo-choose),.teacher-auth-page :global(.profile-photo-remove),.teacher-auth-page :global(.profile-photo-apply){width:max-content;border-radius:8px;font:800 11px var(--font-body);cursor:pointer}.teacher-auth-page :global(.profile-photo-choose){height:36px;padding:0 13px;border:1px solid #e95b39;background:#fff;color:#e54829}.teacher-auth-page :global(.profile-photo-remove){border:0;background:transparent;color:#d8472a;text-decoration:underline}.teacher-auth-page :global(.profile-photo-adjustments){display:grid;gap:7px}.teacher-auth-page :global(.profile-photo-adjustments label){grid-template-columns:100px 1fr;align-items:center;color:#62708a;font-size:10px}.teacher-auth-page :global(.profile-photo-adjustments input[type=range]){height:auto;padding:0;accent-color:#ed5733}.teacher-auth-page :global(.profile-photo-apply){height:33px;padding:0 12px;border:0;background:#edf6f1;color:#078d61}.teacher-auth-page :global(.profile-photo-error){margin:0;color:#c53d24;font-size:10px;font-weight:700}@media(max-width:980px){.teacher-auth-page{display:block;padding:0 9px}.teacher-auth-page :global(.parent-photo-slider){position:relative;width:100%;min-height:225px;border-radius:0 0 22px 22px}.teacher-auth-main{padding:20px 10px 35px}.teacher-auth-card{margin-top:24px;padding:25px 20px}}@media(max-width:560px){.teacher-auth-grid{grid-template-columns:1fr}.teacher-auth-card h1{font-size:29px}.teacher-country-code{min-width:132px;padding:0 9px}.teacher-auth-page :global(.profile-photo-editor-content){align-items:flex-start}.teacher-auth-page :global(.profile-photo-preview){width:88px;height:88px}.teacher-auth-page :global(.profile-photo-adjustments label){grid-template-columns:1fr;gap:3px}}`}</style>
    <style jsx>{`
      .teacher-dropdown{position:relative;display:block}
      .teacher-dropdown-trigger{display:flex;align-items:center;justify-content:space-between;width:100%;height:44px;padding:0 13px;border:1px solid #c9d5e4;border-radius:9px;background:#f9fbff;color:#10213d;font:800 13px var(--font-body);cursor:pointer}
      .teacher-dropdown-trigger svg{color:#e54d2a;font-size:17px;transition:transform .16s ease}
      .teacher-dropdown.open .teacher-dropdown-trigger{border-color:#ff5d34;box-shadow:0 0 0 3px #ff5d3420}
      .teacher-dropdown.open .teacher-dropdown-trigger svg{transform:rotate(180deg)}
      .teacher-dropdown-menu{position:absolute;z-index:20;top:calc(100% + 6px);left:0;right:0;display:grid;overflow:hidden;border:1px solid #d7deea;border-radius:10px;background:#fffdf9;box-shadow:0 14px 30px #1425442b}
      .teacher-dropdown-menu button{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px;border:0;border-bottom:1px solid #edf0f5;background:transparent;color:#10213d;text-align:left;font:800 12px var(--font-body);cursor:pointer}
      .teacher-dropdown-menu button:last-child{border-bottom:0}.teacher-dropdown-menu button:hover,.teacher-dropdown-menu button[aria-selected=true]{background:#fff0eb;color:#d94a29}.teacher-dropdown-menu small{color:inherit!important;font-size:10px!important;font-weight:700!important}
      .teacher-auth-form{grid-template-columns:minmax(0,1fr)!important}.teacher-photo-row,.teacher-field-label,.teacher-auth-grid,.teacher-birth-date-row{grid-column:1/-1;min-width:0}.teacher-photo-row{width:100%}.teacher-field-label{display:grid;gap:7px;color:#4c5361;font-size:11px;font-weight:800}.teacher-country-select{width:136px!important;min-width:136px;height:44px!important;padding:0 31px 0 13px!important;border:0!important;border-right:1px solid #dbe3ee!important;border-radius:0!important;appearance:none;background:#f3f7fc url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23e54d2a' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 11px center!important;color:#314766!important;font:800 12px var(--font-body)!important;cursor:pointer}.teacher-country-select:focus{outline:0;background-color:#edf5ff!important}
      .teacher-auth-actions{display:grid;grid-template-columns:1fr;gap:12px}.teacher-auth-actions.has-back{grid-template-columns:1fr 1fr}.teacher-auth-actions .teacher-auth-submit,.teacher-auth-actions .teacher-auth-secondary,.teacher-login-submit{width:100%;margin-left:0}
      .teacher-auth-page :global(.avatar-picker){width:100%;box-sizing:border-box;grid-column:1/-1}.teacher-auth-page :global(.avatar-picker-copy){min-width:0}.teacher-auth-page :global(.avatar-picker-copy b){font-size:13px}.teacher-auth-page :global(.avatar-picker-circle){width:96px;height:96px}
      @media(max-width:560px){.teacher-auth-actions.has-back{grid-template-columns:1fr}.teacher-country-select{width:112px!important;min-width:112px;padding-left:10px!important}.teacher-auth-page :global(.avatar-picker){grid-template-columns:76px minmax(0,1fr)}.teacher-auth-page :global(.avatar-picker-circle){width:76px;height:76px}}
    `}</style>
    <style jsx>{" .teacher-auth-error,.teacher-auth-message{display:grid;grid-template-columns:20px minmax(0,1fr);align-items:start;gap:9px;margin:0;padding:12px 13px;border:1px solid transparent;border-radius:10px;font-size:11px;font-weight:700;line-height:1.45}.teacher-auth-error svg,.teacher-auth-message svg{margin-top:1px;font-size:17px}.teacher-auth-error{border-color:#ffd4cb;background:linear-gradient(135deg,#fff0ed,#fff8f6);color:#bd3d27}.teacher-auth-message{border-color:#cbead8;background:linear-gradient(135deg,#e8f8ef,#f6fffa);color:#08734e}"}</style>
  </section></main>;
}

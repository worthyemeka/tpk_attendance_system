"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FiCheck, FiChevronDown, FiClock, FiCopy, FiGrid, FiX } from "react-icons/fi";
import { NotificationBell } from "@/components/notification-bell";

const services = ["First Service · 8:30 AM", "Second Service · 10:30 AM"];

function lagosParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos", weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(now);
  return {
    day: parts.find((part) => part.type === "weekday")?.value,
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24,
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? 0),
  };
}

function scheduledService(now: Date) {
  const { day, hour, minute } = lagosParts(now);
  const isFirstServiceWindow = day === "Sun" && (hour < 10 || (hour === 10 && minute < 30));
  return isFirstServiceWindow ? services[0] : services[1];
}

function dateTime(now: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
  }).format(now);
}

export function AdminTopbar() {
  const [now, setNow] = useState<Date | null>(null);
  const [service, setService] = useState(services[1]);
  const [menu, setMenu] = useState(false);
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const scheduledServiceRef = useRef(services[1]);

  useEffect(() => {
    const updateClockAndSchedule = () => {
      const currentTime = new Date();
      const nextScheduledService = scheduledService(currentTime);
      setNow(currentTime);
      if (nextScheduledService !== scheduledServiceRef.current) {
        scheduledServiceRef.current = nextScheduledService;
        setService(nextScheduledService);
      }
    };
    updateClockAndSchedule();
    const id = window.setInterval(updateClockAndSchedule, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("tpk:selected-service", service);
    window.dispatchEvent(new CustomEvent("tpk:service", { detail: service }));
  }, [service]);

  const serviceOpen = now ? lagosParts(now).day === "Sun" && lagosParts(now).hour >= 6 : false;
  const link = typeof window === "undefined" ? "/check-in/parent" : `${window.location.origin}/check-in/parent`;

  return <section className="universal-service-bar">
    <div className="universal-meta">
      <time dateTime={now?.toISOString()}><FiClock />{now ? dateTime(now) : "Loading current time…"}</time>
      <NotificationBell />
    </div>
    <div className="universal-actions">
      <div className="service-menu">
        <button className="service-menu-trigger" onClick={() => setMenu(!menu)} aria-expanded={menu}>
          {service}<FiChevronDown />
        </button>
        {menu && <div className="service-menu-options">
          {services.map((item) => <button key={item} onClick={() => { setService(item); setMenu(false); }}>
            {item === service && <FiCheck />}<span>{item}</span>
          </button>)}
        </div>}
      </div>
      <span className={`universal-open ${serviceOpen ? "" : "closed"}`}><i />{serviceOpen ? "Check-in open" : "Check-in closed · Opens Sunday 6:00 AM"}</span>
      <button className="universal-qr" onClick={() => setQr(true)}><FiGrid />View Check-In QR</button>
      <Link className="universal-assist" href="/check-in/parent?assisted=1">Assisted Check-In</Link>
    </div>
    {qr && <div className="modal-backdrop"><div className="qr-modal">
      <button className="close-modal" onClick={() => setQr(false)}><FiX /></button>
      <p className="eyebrow">Parent Check-In</p><h2>Scan to check in</h2>
      <p>Place this QR on the entrance poster. It opens the public, password-free form.</p>
      <div className="qr-sim"><span>TPK</span></div><code>{link}</code>
      <div className="modal-actions">
        <button className="quiet-button" onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); }}><FiCopy />{copied ? "Link copied" : "Copy link"}</button>
        <Link className="solid-button" href="/check-in/parent">Open parent form</Link>
      </div>
    </div></div>}
    <style jsx global>{`
      .content{position:relative}.universal-service-bar{height:0}.universal-meta{position:absolute;right:32px;top:16px;display:flex;align-items:center;gap:10px}.universal-meta time{height:32px;display:flex;align-items:center;gap:7px;color:#626a79;font-size:10px;font-weight:700}.universal-meta time svg{color:#e25130;font-size:14px}.universal-meta .notification-button{height:36px;width:36px;color:#272727;border-color:#ded9d1;background:#fffdfa;box-shadow:0 3px 10px #00000008}.universal-meta .notification-popover{left:auto;right:0}.universal-actions{position:absolute;right:32px;top:62px;display:flex;gap:10px;align-items:center}.service-menu{position:relative}.universal-actions button,.universal-assist{height:41px;border:1px solid #dedbd5;border-radius:9px;padding:0 13px;background:#fffdfa;color:#171717;font:800 11px var(--font-body);display:flex;align-items:center;gap:8px;text-decoration:none;cursor:pointer;white-space:nowrap}.service-menu-trigger{min-width:205px;justify-content:space-between}.service-menu-trigger svg{font-size:15px}.service-menu-options{position:absolute;z-index:24;left:0;top:47px;width:100%;padding:5px;background:#fffdfa;border:1px solid #dedbd5;border-radius:9px;box-shadow:0 12px 24px #2a1b101c}.service-menu-options button{height:36px;width:100%;border:0;background:transparent;padding:0 7px;text-align:left;font:700 11px var(--font-body);display:flex;gap:8px;align-items:center;border-radius:6px}.service-menu-options button:hover{background:#fff2eb}.service-menu-options svg{color:#e9512e;font-size:16px}.service-menu-options span{margin-left:24px}.service-menu-options svg+span{margin-left:0}.universal-open{height:41px;padding:0 13px;background:#f0f8f3;color:#087757;border-radius:9px;display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;white-space:nowrap}.universal-open i{width:10px;height:10px;border-radius:50%;background:#079161;box-shadow:0 0 0 3px #d7f0e2}.universal-open.closed{background:#f7f3eb;color:#74624a}.universal-open.closed i{background:#d79a26;box-shadow:0 0 0 3px #f6e7c6}.universal-qr{border-color:#ff5d34!important;background:#ff5d34!important;color:#fff!important}.overview .service-controls,.checkin-page .checkin-actions{display:none}.overview-header{padding-top:0;margin-bottom:20px}.checkin-page{padding-top:0}.overview h1{font-size:32px;letter-spacing:-.8px}.overview h1 span{font-size:25px}.overview .intro{font-size:15px;margin-top:5px}.checkin-page h1{font-size:34px}.checkin-header>div>p:last-child{font-size:15px;margin-top:5px}.followup-detail td{white-space:normal!important;background:#fff8f3;padding:14px!important}.followup-detail b{display:block;color:#262626;margin-bottom:7px;font-size:11px}.followup-detail textarea{width:100%;min-height:64px;border:1px solid #e3d8ce;border-radius:7px;background:#fffdfa;padding:9px;font:12px var(--font-body);resize:vertical;margin-bottom:9px}.followup-detail .solid-button{height:35px;padding:0 11px}.followup-detail small{display:block;color:#687184;font-size:11px;margin-top:9px}@media(max-width:1220px){.universal-actions{right:24px;gap:7px}.universal-open{padding:0 10px}.service-menu-trigger{min-width:180px}.universal-actions button,.universal-assist{padding:0 10px;font-size:10px}}@media(max-width:1040px){.universal-actions{flex-wrap:wrap;justify-content:flex-end}.overview-header,.checkin-page{padding-top:110px}}@media(max-width:590px){.universal-service-bar{height:auto;display:grid;gap:10px;margin-bottom:18px}.universal-meta,.universal-actions{position:static}.universal-meta{justify-content:flex-end}.universal-meta time{font-size:10px}.universal-actions{display:grid;grid-template-columns:1fr 1fr}.service-menu{grid-column:span 2}.service-menu-trigger{min-width:0;width:100%}.universal-actions>*{width:100%;justify-content:center}.overview-header,.checkin-page{padding-top:0}.overview h1{font-size:29px}.overview .intro{font-size:14px}}
    `}</style>
  </section>;
}

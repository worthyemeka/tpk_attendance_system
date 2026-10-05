"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { FiCheck, FiChevronDown, FiClock, FiCopy, FiGrid, FiX } from "react-icons/fi";
import { NotificationBell } from "@/components/notification-bell";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { useSundayContext, serviceDisplayLabel, type ServiceSessionContext } from "@/lib/sunday-context";

type ContextMenu = "month" | "sunday" | "service" | null;

function serviceState(service: ServiceSessionContext | null): "UPCOMING" | "LIVE" | "COMPLETED" | "NONE" {
  if (!service) return "NONE";
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const time=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Lagos",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
  if(service.serviceDate>today || (service.serviceDate===today&&time<"06:00"))return "UPCOMING";
  if(service.serviceDate<today || time>="14:00")return "COMPLETED";
  return service.isOpen === false ? "COMPLETED" : "LIVE";
}

function dateTime(now: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
  }).format(now);
}

export function AdminTopbar() {
  const pathname = usePathname();
  const context = useSundayContext();
  const [now, setNow] = useState<Date | null>(null);
  const [menu, setMenu] = useState<ContextMenu>(null);
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canViewCheckIn, setCanViewCheckIn] = useState(false);
  const [canAssistedCheckIn, setCanAssistedCheckIn] = useState(false);
  const session = readTeacherSession();

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!session) { setCanViewCheckIn(false); setCanAssistedCheckIn(false); return; }
    let cancelled = false;
    const checkInUrl = context.selectedServiceSessionId
      ? `${apiBase}/api/v1/check-ins?serviceSessionId=${context.selectedServiceSessionId}`
      : `${apiBase}/api/v1/check-ins`;
    fetch(checkInUrl, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((result) => {
        if (cancelled) return;
        /* A successful check-in read already proves the server authorised this
           viewer. The fallback keeps older API deployments usable while they
           roll out the explicit permission field. */
        setCanViewCheckIn(Boolean(result.success && (result.data?.canViewCheckin ?? true)));
        setCanAssistedCheckIn(Boolean(result.success && result.data?.canAssistedCheckin));
      })
      .catch(() => {
        if (cancelled) return;
        setCanViewCheckIn(false);
        setCanAssistedCheckIn(false);
      });
    return () => { cancelled = true; };
  }, [context.selectedServiceSessionId, session?.staffUserId, session?.sessionToken]);

  const state = serviceState(context.selectedService);
  const stateLabel = state === "LIVE" ? "Check-in open" : state === "COMPLETED" ? "Service completed" : state === "UPCOMING" ? "Check-in opens Sunday · 6:00 AM" : "No service configured";
  const link = typeof window === "undefined" ? "/check-in/parent" : `${window.location.origin}/check-in/parent`;
  const isPickupPage = pathname === "/account/pick-up";
  const selectedMonthKey = context.selectedYear && context.selectedMonth ? `${context.selectedYear}-${String(context.selectedMonth).padStart(2, "0")}` : "";
  const selectedSunday = context.sundays.find((item) => item.date === context.selectedSundayDate);

  return <section className="universal-service-bar">
    <div className="universal-meta">
      <time dateTime={now?.toISOString()}><FiClock />{now ? dateTime(now) : "Loading current time…"}</time>
      <NotificationBell serviceSessionId={context.selectedServiceSessionId || undefined} />
    </div>
    <div className="universal-actions">
      <div className="service-menu context-select">
        <button className="service-menu-trigger" onClick={() => setMenu(menu === "month" ? null : "month")} aria-expanded={menu === "month"} disabled={context.loading || !context.months.length}>
          {context.loading ? "Loading month…" : context.months.find((item) => item.key === selectedMonthKey)?.label || "Choose month"}<FiChevronDown />
        </button>
        {menu === "month" && <div className="service-menu-options">
          {context.months.map((item) => <button key={item.key} onClick={() => { context.selectMonth(item.key); setMenu(null); }}>
            {item.key === selectedMonthKey && <FiCheck />}<span>{item.label}</span>
          </button>)}
        </div>}
      </div>
      <div className="service-menu context-select">
        <button className="service-menu-trigger" onClick={() => setMenu(menu === "sunday" ? null : "sunday")} aria-expanded={menu === "sunday"} disabled={context.loading || !context.sundays.length}>
          {selectedSunday?.label || "Choose Sunday"}<FiChevronDown />
        </button>
        {menu === "sunday" && <div className="service-menu-options">
          {context.sundays.map((item) => <button key={item.date} onClick={() => { context.selectSunday(item.date); setMenu(null); }}>
            {item.date === context.selectedSundayDate && <FiCheck />}<span>{item.label}</span>
          </button>)}
        </div>}
      </div>
      <div className="service-menu context-select context-service-select">
        <button className="service-menu-trigger" onClick={() => { if (context.error) { context.retry(); return; } setMenu(menu === "service" ? null : "service"); }} aria-expanded={menu === "service"} disabled={!context.services.length && !context.error} title={context.error || undefined}>
          {context.loading ? "Loading service…" : context.error ? "Retry service context" : context.selectedService ? serviceDisplayLabel(context.selectedService) : "No service configured"}<FiChevronDown />
        </button>
        {menu === "service" && <div className="service-menu-options">
          {context.services.map((item) => <button key={item.id} onClick={() => { context.selectService(item.id); setMenu(null); }}>
            {item.id === context.selectedServiceSessionId && <FiCheck />}<span>{serviceDisplayLabel(item)}</span>
          </button>)}
        </div>}
      </div>
      {canViewCheckIn && <span className={`universal-open ${state === "LIVE" ? "" : "closed"}`} title={stateLabel}><i /><span className="status-full">{stateLabel}</span><span className="status-compact">{state === "LIVE" ? "Open" : state === "COMPLETED" ? "Done" : "Closed"}</span></span>}
      {canViewCheckIn && <button className="universal-qr" onClick={() => setQr(true)} title="View Check-In QR"><FiGrid /><span>View Check-In QR</span></button>}
      {canAssistedCheckIn && <Link className="universal-assist" href={isPickupPage ? "/account/pick-up#assisted" : "/account/check-in/assisted"}><span className="assist-full">{isPickupPage ? "Start Assisted Pick-Up" : "Assisted Check-In"}</span><span className="assist-compact">Assisted</span></Link>}
    </div>
    {canViewCheckIn && qr && <div className="modal-backdrop"><div className="qr-modal">
      <button className="close-modal" onClick={() => setQr(false)}><FiX /></button>
      <p className="eyebrow">Parent Check-In</p><h2>Scan to check in</h2>
      <p>Place this QR on the entrance poster. It opens the public, password-free form.</p>
      <img className="qr-image" src="/brand/TribePetra_Kids_CheckIn_QR.png" alt="TribePetra Kids parent check-in QR code" /><code>{link}</code>
      <div className="modal-actions">
      <button className="quiet-button" onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); }}><FiCopy />{copied ? "Link copied" : "Copy link"}</button>
        <Link className="solid-button" href="/account/check-in/assisted">Open parent form</Link>
      </div>
    </div></div>}
    <style jsx global>{`
      .content{position:relative}.universal-service-bar{height:0}.universal-meta{position:absolute;right:32px;top:16px;display:flex;align-items:center;gap:10px}.universal-meta time{height:32px;display:flex;align-items:center;gap:7px;color:#626a79;font-size:10px;font-weight:700}.universal-meta time svg{color:#e25130;font-size:14px}.universal-meta .notification-button{height:36px;width:36px;color:#272727;border-color:#ded9d1;background:#fffdfa;box-shadow:0 3px 10px #00000008}.universal-meta .notification-popover{left:auto;right:0}.universal-actions{position:absolute;right:32px;top:62px;display:flex;gap:10px;align-items:center}.service-menu{position:relative}.context-select{min-width:150px}.context-service-select{min-width:205px}.context-select .service-menu-trigger{min-width:100%}.universal-actions button,.universal-assist{height:41px;border:1px solid #dedbd5;border-radius:9px;padding:0 13px;background:#fffdfa;color:#171717;font:800 11px var(--font-body);display:flex;align-items:center;gap:8px;text-decoration:none;cursor:pointer;white-space:nowrap}.service-menu-trigger{min-width:205px;justify-content:space-between}.service-menu-trigger svg{font-size:15px}.service-menu-trigger:disabled{cursor:not-allowed;opacity:.75}.service-menu-options{position:absolute;z-index:24;left:0;top:47px;width:100%;padding:5px;background:#fffdfa;border:1px solid #dedbd5;border-radius:9px;box-shadow:0 12px 24px #2a1b101c}.service-menu-options button{height:36px;width:100%;border:0;background:transparent;padding:0 7px;text-align:left;font:700 11px var(--font-body);display:flex;gap:8px;align-items:center;border-radius:6px}.service-menu-options button:hover{background:#fff2eb}.service-menu-options svg{color:#e9512e;font-size:16px}.service-menu-options span{margin-left:24px}.service-menu-options svg+span{margin-left:0}.universal-open{height:41px;padding:0 13px;background:#f0f8f3;color:#087757;border-radius:9px;display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;white-space:nowrap}.universal-open i{width:10px;height:10px;border-radius:50%;background:#079161;box-shadow:0 0 0 3px #d7f0e2}.universal-open.closed{background:#f7f3eb;color:#74624a}.universal-open.closed i{background:#d79a26;box-shadow:0 0 0 3px #f6e7c6}.status-compact,.assist-compact{display:none}.universal-qr{border-color:#ff5d34!important;background:#ff5d34!important;color:#fff!important}.overview .service-controls,.checkin-page .checkin-actions{display:none}.overview-header{padding-top:0;margin-bottom:20px}.checkin-page{padding-top:0}.overview h1{font-size:32px;letter-spacing:-.8px}.overview h1 span{font-size:25px}.overview .intro{font-size:15px;margin-top:5px}.checkin-page h1{font-size:34px}.checkin-header>div>p:last-child{font-size:15px;margin-top:5px}.followup-detail td{white-space:normal!important;background:#fff8f3;padding:14px!important}.followup-detail b{display:block;color:#262626;margin-bottom:7px;font-size:11px}.followup-detail textarea{width:100%;min-height:64px;border:1px solid #e3d8ce;border-radius:7px;background:#fffdfa;padding:9px;font:12px var(--font-body);resize:vertical;margin-bottom:9px}.followup-detail .solid-button{height:35px;padding:0 11px}.followup-detail small{display:block;color:#687184;font-size:11px;margin-top:9px}@media(max-width:1220px){.universal-actions{right:24px;gap:7px}.universal-open{padding:0 10px}.context-select{min-width:132px}.context-service-select{min-width:180px}.service-menu-trigger{min-width:0}.universal-actions button,.universal-assist{padding:0 10px;font-size:10px}}@media(max-width:1040px){.universal-actions{flex-wrap:wrap;justify-content:flex-end}.overview-header,.checkin-page{padding-top:110px}}@media(max-width:590px){.universal-service-bar{height:auto;display:grid;gap:10px;margin-bottom:18px}.universal-meta,.universal-actions{position:static}.universal-meta{justify-content:flex-end}.universal-meta time{font-size:10px}.universal-actions{display:flex;flex-wrap:nowrap;width:100%;gap:5px}.service-menu,.context-select,.context-service-select{flex:1 1 0;min-width:0}.context-service-select{flex-grow:1.3}.service-menu-trigger{min-width:0;width:100%;padding:0 9px!important;font-size:9px!important;overflow:hidden;text-overflow:ellipsis}.universal-open{flex:0 0 59px;justify-content:center;gap:6px;padding:0 7px;font-size:9px}.universal-open i{width:8px;height:8px;box-shadow:none}.status-full,.assist-full{display:none}.status-compact,.assist-compact{display:inline}.universal-qr{flex:0 0 39px;justify-content:center;padding:0!important}.universal-qr span{display:none}.universal-qr svg{font-size:14px}.universal-assist{flex:0 0 68px;justify-content:center;padding:0 6px!important;font-size:9px!important}.overview-header,.checkin-page{padding-top:0}.overview h1{font-size:29px}.overview .intro{font-size:14px}}
      .qr-image{display:block;width:176px;height:176px;object-fit:contain;margin:20px auto;border:12px solid #fff}
      @media(max-width:590px){.universal-meta{width:100%;justify-content:flex-start}.universal-meta time{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.universal-meta .notification-wrap{display:none}}
    `}</style>
  </section>;
}

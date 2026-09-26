"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { FiCheck, FiChevronDown, FiClock, FiCopy, FiGrid, FiX } from "react-icons/fi";
import { NotificationBell } from "@/components/notification-bell";
import { apiBase, authHeaders, readTeacherSession } from "@/lib/session";
import { type ActiveService, readActiveService, setActiveService } from "@/lib/active-service";

type ServiceChoice = { id:number; name:string; serviceType?:string; serviceDate?:string; startsAt?:string|null };

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

function serviceLabel(service:ServiceChoice) { return service.startsAt ? `${service.name} · ${new Intl.DateTimeFormat("en-NG", { hour:"numeric", minute:"2-digit", hour12:true, timeZone:"Africa/Lagos" }).format(new Date(service.startsAt))}` : service.name; }

function currentLagosDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function currentSundaySessions(items: ServiceChoice[], requestedId?: number, savedId?: number) {
  const eligible = items.filter((item) => item.serviceType === "FIRST_SERVICE" || item.serviceType === "SECOND_SERVICE");
  const requested = eligible.find((item) => item.id === requestedId);
  const saved = eligible.find((item) => item.id === savedId);
  const dates = [...new Set(eligible.map((item) => item.serviceDate).filter(Boolean))] as string[];
  const today = currentLagosDate();
  const relevantDate = requested?.serviceDate || saved?.serviceDate || dates.find((date) => date >= today) || dates[0];
  const byType = new Map<string, ServiceChoice>();
  eligible.filter((item) => item.serviceDate === relevantDate).forEach((item) => {
    if (!byType.has(item.serviceType || "")) byType.set(item.serviceType || "", item);
  });
  return [...byType.values()].sort((left, right) => (left.serviceType === "FIRST_SERVICE" ? -1 : 1) - (right.serviceType === "FIRST_SERVICE" ? -1 : 1));
}

function dateTime(now: Date) {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: "Africa/Lagos", weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "numeric", minute: "2-digit", second: "2-digit",
  }).format(now);
}

export function AdminTopbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedServiceId = Number(searchParams.get("serviceSessionId")) || undefined;
  const [now, setNow] = useState<Date | null>(null);
  const [services, setServices] = useState<ServiceChoice[]>([]);
  const [service, setService] = useState<ActiveService | null>(null);
  const [menu, setMenu] = useState(false);
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [canAssistedCheckIn, setCanAssistedCheckIn] = useState(false);
  const session = readTeacherSession();

  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const id = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => { if (!session) return; void fetch(`${apiBase}/api/v1/service-sessions`, { headers:authHeaders(session) }).then(r => r.json()).then(result => {
    if (!result.success) return;
    const saved = readActiveService();
    const choices = currentSundaySessions(result.data || [], requestedServiceId, saved?.id);
    setServices(choices);
    const selected = choices.find(item => item.id === requestedServiceId) || choices.find(item => item.id === saved?.id) || choices[0];
    if (selected) { const next={ id:selected.id, label:serviceLabel(selected), serviceType:selected.serviceType, serviceDate:selected.serviceDate }; setService(next); setActiveService(next); }
  }).catch(() => undefined); }, [requestedServiceId, session]);

  useEffect(() => {
    if (!session || !service?.id) { setCanAssistedCheckIn(false); return; }
    let cancelled = false;
    fetch(`${apiBase}/api/v1/check-ins?serviceSessionId=${service.id}`, { headers: authHeaders(session) })
      .then((response) => response.json())
      .then((result) => { if (!cancelled) setCanAssistedCheckIn(Boolean(result.success && result.data?.canAssistedCheckin)); })
      .catch(() => { if (!cancelled) setCanAssistedCheckIn(false); });
    return () => { cancelled = true; };
  }, [service?.id, session?.staffUserId, session?.sessionToken]);

  const chooseService = (choice:ServiceChoice) => {
    const next={ id:choice.id, label:serviceLabel(choice), serviceType:choice.serviceType, serviceDate:choice.serviceDate };
    setService(next); setActiveService(next); setMenu(false);
    if (typeof window !== "undefined" && /^\/account\/(overview|check-in|pick-up|classrooms)/.test(pathname)) {
      const params = new URLSearchParams(window.location.search);
      params.set("serviceSessionId", String(choice.id));
      window.history.replaceState(null, "", `${pathname}?${params.toString()}`);
    }
  };

  const serviceOpen = now ? lagosParts(now).day === "Sun" && lagosParts(now).hour >= 6 : false;
  const link = typeof window === "undefined" ? "/check-in/parent" : `${window.location.origin}/check-in/parent`;
  const isPickupPage = pathname === "/account/pick-up";

  return <section className="universal-service-bar">
    <div className="universal-meta">
      <time dateTime={now?.toISOString()}><FiClock />{now ? dateTime(now) : "Loading current time…"}</time>
      <NotificationBell serviceSessionId={service?.id} />
    </div>
    <div className="universal-actions">
      <div className="service-menu">
        <button className="service-menu-trigger" onClick={() => setMenu(!menu)} aria-expanded={menu}>
          {service?.label || "Loading service…"}<FiChevronDown />
        </button>
        {menu && <div className="service-menu-options">
          {services.map((item) => <button key={item.id} onClick={() => chooseService(item)}>
            {item.id === service?.id && <FiCheck />}<span>{serviceLabel(item)}</span>
          </button>)}
        </div>}
      </div>
      <span className={`universal-open ${serviceOpen ? "" : "closed"}`} title={serviceOpen ? "Check-in open" : "Check-in closed · Opens Sunday 6:00 AM"}><i /><span className="status-full">{serviceOpen ? "Check-in open" : "Check-in closed · Opens Sunday 6:00 AM"}</span><span className="status-compact">{serviceOpen ? "Open" : "Closed"}</span></span>
      <button className="universal-qr" onClick={() => setQr(true)} title="View Check-In QR"><FiGrid /><span>View Check-In QR</span></button>
      {canAssistedCheckIn && <Link className="universal-assist" href={isPickupPage ? "/account/pick-up#assisted" : "/account/check-in/assisted"}><span className="assist-full">{isPickupPage ? "Start Assisted Pick-Up" : "Assisted Check-In"}</span><span className="assist-compact">Assisted</span></Link>}
    </div>
    {qr && <div className="modal-backdrop"><div className="qr-modal">
      <button className="close-modal" onClick={() => setQr(false)}><FiX /></button>
      <p className="eyebrow">Parent Check-In</p><h2>Scan to check in</h2>
      <p>Place this QR on the entrance poster. It opens the public, password-free form.</p>
      <img className="qr-image" src="/brand/TribePetra_Kids_CheckIn_QR.png" alt="TribePetra Kids parent check-in QR code" /><code>{link}</code>
      <div className="modal-actions">
        <button className="quiet-button" onClick={async () => { await navigator.clipboard?.writeText(link); setCopied(true); }}><FiCopy />{copied ? "Link copied" : "Copy link"}</button>
        <Link className="solid-button" href="/check-in/parent">Open parent form</Link>
      </div>
    </div></div>}
    <style jsx global>{`
      .content{position:relative}.universal-service-bar{height:0}.universal-meta{position:absolute;right:32px;top:16px;display:flex;align-items:center;gap:10px}.universal-meta time{height:32px;display:flex;align-items:center;gap:7px;color:#626a79;font-size:10px;font-weight:700}.universal-meta time svg{color:#e25130;font-size:14px}.universal-meta .notification-button{height:36px;width:36px;color:#272727;border-color:#ded9d1;background:#fffdfa;box-shadow:0 3px 10px #00000008}.universal-meta .notification-popover{left:auto;right:0}.universal-actions{position:absolute;right:32px;top:62px;display:flex;gap:10px;align-items:center}.service-menu{position:relative}.universal-actions button,.universal-assist{height:41px;border:1px solid #dedbd5;border-radius:9px;padding:0 13px;background:#fffdfa;color:#171717;font:800 11px var(--font-body);display:flex;align-items:center;gap:8px;text-decoration:none;cursor:pointer;white-space:nowrap}.service-menu-trigger{min-width:205px;justify-content:space-between}.service-menu-trigger svg{font-size:15px}.service-menu-options{position:absolute;z-index:24;left:0;top:47px;width:100%;padding:5px;background:#fffdfa;border:1px solid #dedbd5;border-radius:9px;box-shadow:0 12px 24px #2a1b101c}.service-menu-options button{height:36px;width:100%;border:0;background:transparent;padding:0 7px;text-align:left;font:700 11px var(--font-body);display:flex;gap:8px;align-items:center;border-radius:6px}.service-menu-options button:hover{background:#fff2eb}.service-menu-options svg{color:#e9512e;font-size:16px}.service-menu-options span{margin-left:24px}.service-menu-options svg+span{margin-left:0}.universal-open{height:41px;padding:0 13px;background:#f0f8f3;color:#087757;border-radius:9px;display:flex;align-items:center;gap:9px;font-size:11px;font-weight:800;white-space:nowrap}.universal-open i{width:10px;height:10px;border-radius:50%;background:#079161;box-shadow:0 0 0 3px #d7f0e2}.universal-open.closed{background:#f7f3eb;color:#74624a}.universal-open.closed i{background:#d79a26;box-shadow:0 0 0 3px #f6e7c6}.status-compact,.assist-compact{display:none}.universal-qr{border-color:#ff5d34!important;background:#ff5d34!important;color:#fff!important}.overview .service-controls,.checkin-page .checkin-actions{display:none}.overview-header{padding-top:0;margin-bottom:20px}.checkin-page{padding-top:0}.overview h1{font-size:32px;letter-spacing:-.8px}.overview h1 span{font-size:25px}.overview .intro{font-size:15px;margin-top:5px}.checkin-page h1{font-size:34px}.checkin-header>div>p:last-child{font-size:15px;margin-top:5px}.followup-detail td{white-space:normal!important;background:#fff8f3;padding:14px!important}.followup-detail b{display:block;color:#262626;margin-bottom:7px;font-size:11px}.followup-detail textarea{width:100%;min-height:64px;border:1px solid #e3d8ce;border-radius:7px;background:#fffdfa;padding:9px;font:12px var(--font-body);resize:vertical;margin-bottom:9px}.followup-detail .solid-button{height:35px;padding:0 11px}.followup-detail small{display:block;color:#687184;font-size:11px;margin-top:9px}@media(max-width:1220px){.universal-actions{right:24px;gap:7px}.universal-open{padding:0 10px}.service-menu-trigger{min-width:180px}.universal-actions button,.universal-assist{padding:0 10px;font-size:10px}}@media(max-width:1040px){.universal-actions{flex-wrap:wrap;justify-content:flex-end}.overview-header,.checkin-page{padding-top:110px}}@media(max-width:590px){.universal-service-bar{height:auto;display:grid;gap:10px;margin-bottom:18px}.universal-meta,.universal-actions{position:static}.universal-meta{justify-content:flex-end}.universal-meta time{font-size:10px}.universal-actions{display:flex;flex-wrap:nowrap;width:100%;gap:5px}.service-menu{flex:1 1 118px;min-width:0}.service-menu-trigger{min-width:0;width:100%;padding:0 9px!important;font-size:9px!important;overflow:hidden;text-overflow:ellipsis}.universal-open{flex:0 0 59px;justify-content:center;gap:6px;padding:0 7px;font-size:9px}.universal-open i{width:8px;height:8px;box-shadow:none}.status-full,.assist-full{display:none}.status-compact,.assist-compact{display:inline}.universal-qr{flex:0 0 39px;justify-content:center;padding:0!important}.universal-qr span{display:none}.universal-qr svg{font-size:14px}.universal-assist{flex:0 0 68px;justify-content:center;padding:0 6px!important;font-size:9px!important}.overview-header,.checkin-page{padding-top:0}.overview h1{font-size:29px}.overview .intro{font-size:14px}}
      .qr-image{display:block;width:176px;height:176px;object-fit:contain;margin:20px auto;border:12px solid #fff}
      @media(max-width:590px){.universal-meta{width:100%;justify-content:flex-start}.universal-meta time{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.universal-meta .notification-wrap{display:none}}
    `}</style>
  </section>;
}

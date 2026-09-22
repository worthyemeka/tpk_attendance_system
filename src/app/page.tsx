"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiChevronRight, FiClock, FiMessageSquare, FiPhone, FiPhoneCall, FiUsers, FiX } from "react-icons/fi";
import { UserGreeting } from "@/components/user-greeting";
import { QuickActions } from "@/components/quick-actions";

const classes = [["TribePetra Teens", "Ages 13 – 17", 32, 34], ["Tribe A", "Ages 9 – 12", 47, 55], ["Tribe B", "Ages 5 – 8", 58, 67], ["Tribe C", "Ages 3 – 4", 49, 55]] as const;
const recent = [["David A.", "Tribe A", "Adebayo Family", "8:42 AM", "Returning"], ["Joshua A.", "Tribe B", "Adebayo Family", "8:39 AM", "First Visit"], ["Sarah O.", "Tribe C", "Okafor Family", "8:35 AM", "Returning"], ["Favour E.", "Tribe A", "Emeka Family", "8:28 AM", "First Visit"], ["Daniel O.", "Tribe B", "Okoye Family", "8:21 AM", "Returning"]] as const;
const awaitingPickup = [
  { name: "David Adebayo", group: "Tribe A", guardian: "Grace Adebayo", phone: "08031234567" },
  { name: "Favour Emeka", group: "Tribe A", guardian: "Chinedu Emeka", phone: "08121234824" },
];
const followUp = [
  { name: "Mabel James", group: "Tribe A", guardian: "Tosin James", phone: "07031234920", missed: "3 Sundays" },
  { name: "David Nwosu", group: "Tribe A", guardian: "Chidi Nwosu", phone: "08021234221", missed: "2 Sundays" },
  { name: "Amara Obi", group: "Tribe A", guardian: "Nneka Obi", phone: "08051234901", missed: "2 Sundays" },
];
type ModalKind = "pickup" | "follow-up" | null;

function afterPickupDeadline(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
  const day = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return day === "Sun" && (hour > 13 || (hour === 13 && minute >= 30));
}

export default function Dashboard() {
  const [modal, setModal] = useState<ModalKind>(null);
  const [showPickupFollowUp, setShowPickupFollowUp] = useState(false);

  useEffect(() => {
    const update = () => setShowPickupFollowUp(afterPickupDeadline(new Date()));
    update();
    const id = window.setInterval(update, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return <div className="overview">
    <header className="overview-header">
      <div><p className="eyebrow">Petra Wuse</p><UserGreeting /><p className="intro">Here’s what’s happening at TribePetra Kids today.</p></div>
      <div className="service-controls" aria-hidden="true" />
    </header>
    <section className="metrics">
      <Metric icon={<FiUsers />} value="186" title="Checked In" sub="Children checked in this service" tone="orange" />
      <Metric icon={<FiCheckCircle />} value="131" title="Picked Up" sub="Children safely collected" tone="green" />
      <Metric icon={<FiClock />} value="55" title="Still Present" sub="Children currently in class" tone="yellow" />
      <Metric icon={<FiUsers />} value="4" title="Active Classes" sub="Classes receiving children today" tone="dark" />
    </section>
    <section className="dashboard-grid">
      <div className="left-column">
        <section className="panel attendance-panel">
          <div className="panel-heading"><div><h2>Attendance by Class</h2><p>Children currently checked in by class</p></div><Link href="/classes" className="outline-button">View classrooms <FiChevronRight /></Link></div>
          <div className="attendance-list">{classes.map(([name, ages, count, total]) => <div className="attendance-row" key={name}><div><b>{name}</b><span>{ages}</span></div><div className="progress"><i style={{ width: `${count / total * 100}%` }} /></div><strong>{count}</strong></div>)}</div>
        </section>
        <section className="panel recent-panel">
          <div className="panel-heading"><div><h2>Recent Check-Ins</h2><p>The latest children to arrive</p></div><Link href="/check-in" className="outline-button">View all check-ins <FiChevronRight /></Link></div>
          <div className="table-wrap"><table><thead><tr><th>Child</th><th>Class</th><th>Family</th><th>Time</th><th>Visit</th></tr></thead><tbody>{recent.map(([child, group, family, time, visit]) => <tr key={child}><td><b>{child}</b></td><td>{group}</td><td>{family}</td><td>{time}</td><td><span className={`visit ${visit === "First Visit" ? "first" : "returning"}`}>{visit}</span></td></tr>)}</tbody></table></div>
        </section>
      </div>
      <aside className="right-column">
        <QuickActions />
        <section className="panel attention-panel">
          <div className="panel-heading"><div><h2>Needs Attention</h2><p>Items that need your attention</p></div></div>
          <div className="attention-list">
            {showPickupFollowUp && <Attention icon={<FiAlertCircle />} text="2 children from Tribe A are yet to be picked up" tone="red" onClick={() => setModal("pickup")} />}
            <Attention icon={<FiAlertTriangle />} text="John from Tribe B needs class assignment" tone="amber" />
            <Attention icon={<FiPhoneCall />} text="3 children from Tribe A missed church for 2 weeks — call now" tone="red" onClick={() => setModal("follow-up")} />
          </div>
        </section>
      </aside>
    </section>
    {modal && <AttentionModal type={modal} close={() => setModal(null)} />}
    <style jsx global>{`
      .overview .service-controls{display:none}.attention-item{width:100%;border:0;background:transparent;text-align:left;padding:0;cursor:default}.attention-item.actionable{cursor:pointer}.attention-item.actionable:hover span{text-decoration:underline}.attention-modal{width:min(610px,100%);text-align:left}.attention-modal h2{font:27px Georgia,serif;margin:0}.attention-modal>p{font-size:12px;color:#687184;margin:7px 0 17px}.attention-people{display:grid;gap:8px}.attention-person{border:1px solid #e7e1d8;border-radius:8px;padding:12px;display:flex;align-items:center;gap:12px}.attention-person>div:first-child{flex:1}.attention-person b,.attention-person small{display:block}.attention-person b{font-size:12px}.attention-person small{font-size:10px;color:#687184;margin-top:3px}.contact-actions{display:flex;gap:7px}.contact-actions a{height:32px;padding:0 10px;border-radius:6px;display:flex;align-items:center;gap:5px;text-decoration:none;background:#fff0ea;color:#d94d2e;font-size:10px;font-weight:900}.contact-actions a:last-child{background:#eef6f1;color:#087757}.attention-note{margin-top:15px;padding:10px;border-radius:7px;background:#fff7ed;color:#715340;font-size:10px;line-height:1.5}@media(max-width:590px){.attention-person{align-items:flex-start;flex-direction:column}.contact-actions{width:100%}.contact-actions a{flex:1;justify-content:center}}
    `}</style>
  </div>;
}

function Metric({ icon, value, title, sub, tone }: { icon: React.ReactNode; value: string; title: string; sub: string; tone: "orange" | "green" | "yellow" | "dark" }) { return <article className={`metric-card ${tone}`}><span className="metric-icon">{icon}</span><div><strong>{value}</strong><h3>{title}</h3><p>{sub}</p></div></article>; }
function Attention({ icon, text, tone, onClick }: { icon: React.ReactNode; text: string; tone: "red" | "amber"; onClick?: () => void }) { const content = <><i className={tone}>{icon}</i><span>{text}</span><FiChevronRight /></>; return onClick ? <button className="attention-item actionable" onClick={onClick}>{content}</button> : <div className="attention-item">{content}</div>; }
function AttentionModal({ type, close }: { type: Exclude<ModalKind, null>; close: () => void }) {
  const pickup = type === "pickup";
  const people = pickup ? awaitingPickup : followUp;
  return <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="qr-modal attention-modal"><button className="close-modal" onClick={close}><FiX /></button><h2>{pickup ? "Children awaiting pick-up" : "Attendance follow-up"}</h2><p>{pickup ? "These children are still checked in after 1:30 PM. Contact their parent or guardian now." : "These children have missed two or more Sundays. Reach out to their guardian with a call or message."}</p><div className="attention-people">{people.map((person) => <div className="attention-person" key={person.name}><div><b>{person.name} · {person.group}</b><small>{person.guardian}{"missed" in person ? ` · ${person.missed}` : " · Awaiting collection"}</small></div><div className="contact-actions"><a href={`tel:${person.phone}`}><FiPhone />Call</a><a href={`sms:${person.phone}?body=${encodeURIComponent(`Hello, this is TribePetra Kids Wuse. We are checking in regarding ${person.name}. Please let us know how you are doing.`)}`}><FiMessageSquare />Message</a></div></div>)}</div><div className="attention-note">Calls and messages open the device&apos;s phone or SMS app, so the staff member remains in control of the contact.</div></div></div>;
}

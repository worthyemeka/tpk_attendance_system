"use client";

import Link from "next/link";
import { useState } from "react";
import { FiBell, FiCheck, FiChevronRight } from "react-icons/fi";

const initialNotifications = [
  { id: 1, title: "First Service attendance report is ready", detail: "8 regularly attending children were absent today.", href: "/check-in?tab=records", unread: true },
  { id: 2, title: "3 Tribe A children need follow-up", detail: "They have not attended in two weeks.", href: "/check-in?tab=follow-up", unread: true },
  { id: 3, title: "2 children are still awaiting pickup", detail: "Tribe A · Second Service", href: "/pick-up", unread: true },
  { id: 4, title: "John A. needs a class assignment", detail: "Review the new child registration.", href: "/check-in?tab=follow-up", unread: false },
];

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const unread = notifications.filter((item) => item.unread).length;
  const markAllRead = () => setNotifications((items) => items.map((item) => ({ ...item, unread: false })));
  return <div className="notification-wrap">
    <button className="notification-button" type="button" aria-label="Open notifications" onClick={() => setOpen(!open)}><FiBell />{unread > 0 && <b>{unread}</b>}</button>
    {open && <div className="notification-popover"><div className="notification-heading"><div><strong>Notifications</strong><span>{unread} unread</span></div><button type="button" onClick={markAllRead}><FiCheck /> Mark all read</button></div><div className="notification-items">{notifications.map((item) => <Link href={item.href} key={item.id} onClick={() => { setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, unread: false } : entry)); setOpen(false); }}><i className={item.unread ? "unread" : ""} /><span><b>{item.title}</b><small>{item.detail}</small></span><FiChevronRight /></Link>)}</div></div>}
    <style jsx>{`.notification-wrap{position:relative}.notification-button{position:relative;width:36px;height:36px;border:1px solid #454541;background:transparent;border-radius:8px;color:#fff;display:grid;place-items:center;cursor:pointer}.notification-button svg{font-size:18px}.notification-button b{position:absolute;right:-7px;top:-7px;min-width:17px;height:17px;border-radius:10px;display:grid;place-items:center;background:#ff5d34;color:#fff;font:700 9px Arial}.notification-popover{position:absolute;z-index:20;top:45px;left:0;width:350px;background:#fffdfa;color:#161616;border:1px solid #e7e1d8;border-radius:10px;box-shadow:0 16px 40px #0003;overflow:hidden}.notification-heading{padding:14px 15px;border-bottom:1px solid #eee9e1;display:flex;justify-content:space-between;align-items:center}.notification-heading strong,.notification-heading span{display:block}.notification-heading strong{font-family:Georgia,serif;font-size:18px}.notification-heading span{font-size:10px;color:#6c7280;margin-top:2px}.notification-heading button{border:0;background:none;color:#d94d2e;font-size:10px;font-weight:800;cursor:pointer;display:flex;gap:5px;align-items:center}.notification-items a{color:#171717;text-decoration:none;display:flex;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid #f0ece5}.notification-items a:hover{background:#fff8f2}.notification-items> a>i{width:8px;height:8px;border-radius:50%;background:transparent;flex:none}.notification-items> a>i.unread{background:#ff5d34}.notification-items span{display:grid;gap:3px;flex:1}.notification-items b{font-size:11px}.notification-items small{font-size:10px;color:#697083}.notification-items>a>svg{color:#777;font-size:15px}@media(max-width:590px){.notification-popover{left:auto;right:0;width:min(350px,calc(100vw - 32px))}}`}</style>
  </div>;
}

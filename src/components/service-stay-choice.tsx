"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Service = "first" | "second" | "both";
const labels: Record<Service, string> = { first: "1st service", second: "2nd service", both: "Both services" };

export function ServiceStayChoice() {
  const [host, setHost] = useState<Element | null>(null);
  const [service, setService] = useState<Service>("first");

  useEffect(() => {
    const locate = () => setHost(document.querySelector(".pc-pickup-options"));
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!host) return;
    localStorage.setItem("tpk-service-stay", JSON.stringify({ service, label: labels[service], selectedAt: new Date().toISOString(), autoSecondServiceAt: service === "both" ? "Sunday 11:00" : null }));
  }, [host, service]);

  if (!host) return null;
  return createPortal(
    <fieldset className="pc-service-stay">
      <legend>Which service will your child(ren) be staying for?</legend>
      <div>{(["first", "second", "both"] as Service[]).map((option) => <button className={service === option ? "selected" : ""} key={option} onClick={() => setService(option)} type="button">{labels[option]}</button>)}</div>
      <small>Children staying for both services are automatically marked into second service at 11:00 AM.</small>
    </fieldset>,
    host,
  );
}

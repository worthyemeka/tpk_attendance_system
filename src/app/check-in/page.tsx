"use client";

import { useEffect, useState } from "react";
import { CheckInMonitor } from "@/components/check-in-monitor";

export default function CheckInPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  useEffect(() => {
    if (!ready) return;
    const syncService = (value: string | null) => {
      if (!value) return;
      const select = document.querySelector<HTMLSelectElement>(".checkin-actions select");
      if (select && select.value !== value) {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    };
    syncService(window.localStorage.getItem("tpk:selected-service"));
    const handleService = (event: Event) => syncService((event as CustomEvent<string>).detail);
    window.addEventListener("tpk:service", handleService);
    return () => window.removeEventListener("tpk:service", handleService);
  }, [ready]);

  useEffect(() => {
    if (!ready || new URLSearchParams(window.location.search).get("tab") !== "follow-up") return;
    const frame = window.requestAnimationFrame(() => {
      Array.from(document.querySelectorAll<HTMLButtonElement>(".checkin-tabs button"))
        .find((button) => button.textContent?.includes("Follow-Up"))?.click();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready]);

  if (!ready) return <div className="checkin-page" aria-busy="true" />;
  return <CheckInMonitor />;
}

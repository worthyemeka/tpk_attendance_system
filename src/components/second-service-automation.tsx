"use client";

import { useEffect, useState } from "react";

export function SecondServiceAutomation() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem("tpk-service-stay");
      if (!saved) return;
      const preference = JSON.parse(saved) as { service: string };
      const now = new Date();
      const lagos = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
      if (preference.service === "both" && lagos.getDay() === 0 && (lagos.getHours() > 11 || lagos.getHours() === 11)) {
        localStorage.setItem("tpk-second-service-sync", JSON.stringify({ completedAt: now.toISOString(), status: "checked-in" }));
        setMessage("Second-service attendance has been updated for children staying all day.");
      }
    };
    sync();
    const timer = window.setInterval(sync, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return message ? <p className="second-service-toast">{message}</p> : null;
}

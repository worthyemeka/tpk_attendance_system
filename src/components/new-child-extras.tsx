"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FiInfo, FiPlus, FiTrash2, FiUsers } from "react-icons/fi";

type Screen = "child" | "pickup" | "none";
type ExtraChild = { id: number };

export function NewChildExtras() {
  const [screen, setScreen] = useState<Screen>("none");
  const [host, setHost] = useState<Element | null>(null);
  const [moreChildren, setMoreChildren] = useState<ExtraChild[]>([]);
  const [otherPicker, setOtherPicker] = useState(false);

  useEffect(() => {
    const locate = () => {
      const heading = document.querySelector(".new-reg-card h1")?.textContent || "";
      if (heading.includes("Tell us about your child")) { setScreen("child"); setHost(document.querySelector(".new-form-grid")); return; }
      if (heading.includes("Who will be picking up")) { setScreen("pickup"); setHost(document.querySelector(".new-pickup")); return; }
      setScreen("none"); setHost(null);
    };
    const handleClick = (event: MouseEvent) => { const button = (event.target as HTMLElement).closest(".new-pickup button"); if (button) setOtherPicker((button.textContent || "").includes("Someone else")); };
    locate(); const observer = new MutationObserver(locate); observer.observe(document.body, { childList: true, subtree: true }); document.addEventListener("click", handleClick);
    return () => { observer.disconnect(); document.removeEventListener("click", handleClick); };
  }, []);

  if (!host) return null;
  if (screen === "child") return createPortal(<>
    {moreChildren.map((child, index) => <section className="new-extra-child" key={child.id}><header><b>Additional child {index + 2}</b><button aria-label={`Remove additional child ${index + 2}`} onClick={() => setMoreChildren((items) => items.filter((item) => item.id !== child.id))} type="button"><FiTrash2 /> Remove</button></header><div className="new-extra-child-grid"><label>Child’s First Name *<input placeholder="e.g. Sarah" /></label><label>Child’s Last Name *<input placeholder="e.g. Adebayo" /></label><label>Date of Birth *<input type="date" /></label><label>Gender *<span><button type="button">Male</button><button type="button">Female</button></span></label><label className="new-extra-full">Anything we should know?<textarea placeholder="Important care information — allergies, medical needs or accessibility needs (optional)" rows={3} /></label></div></section>)}
    <button className="new-add-child" onClick={() => setMoreChildren((items) => [...items, { id: Date.now() }])} type="button"><FiPlus /> Add another child</button>
  </>, host);
  if (screen === "pickup" && otherPicker) return createPortal(<section className="new-other-picker"><h3><FiUsers /> Picker’s Details</h3><p>Please enter the details of the authorised person collecting your child.</p><div><label>Full Name<input placeholder="e.g. Michael Adebayo" /></label><label>Relationship to Child<select defaultValue=""><option disabled value="">Select relationship</option><option>Father</option><option>Mother</option><option>Guardian</option><option>Other</option></select></label><label>Phone Number<input inputMode="tel" placeholder="0805 123 4567" /></label></div><small><FiInfo />This person must be an authorised guardian. We’ll verify their details at pickup.</small></section>, host);
  return null;
}

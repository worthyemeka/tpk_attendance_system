"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

export function ParentFormNavigation() {
  const searchParams = useSearchParams();
  const isNewChildFlow = searchParams.get("flow") === "new";

  useEffect(() => {
    const openRegistration = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest(".pc-register button");
      if (!button) return;
      event.preventDefault();
      window.location.assign("/check-in/parent?flow=new");
    };
    document.addEventListener("click", openRegistration);
    return () => document.removeEventListener("click", openRegistration);
  }, []);

  return isNewChildFlow ? null : <Link className="parent-form-back" href="/">← Back</Link>;
}

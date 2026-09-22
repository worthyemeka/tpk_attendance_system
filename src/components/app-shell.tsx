"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AdminTopbar } from "@/components/admin-topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (!pathname.startsWith("/account")) return <main className="parent-shell">{children}</main>;
  return <><Sidebar /><main className="content"><AdminTopbar />{children}</main></>;
}

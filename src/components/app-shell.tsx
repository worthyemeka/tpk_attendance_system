"use client";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
export function AppShell({children}:{children:React.ReactNode}){const path=usePathname();if(path.startsWith("/check-in/parent"))return <main className="parent-shell">{children}</main>;return <><Sidebar/><main className="content"><AdminTopbar/>{children}</main></>}

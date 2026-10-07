"use client";

import { AdminTopbar } from "@/components/admin-topbar";
import { PagePreloader } from "@/components/page-preloader";
import { Sidebar } from "@/components/sidebar";
import { AccountGuard, PeopleRecordsGuard } from "@/components/account-guard";
import { SundayContextProvider } from "@/lib/sunday-context";
import { usePathname } from "next/navigation";
import { useEffect,useState } from "react";
import { readTeacherSession } from "@/lib/session";
import { DashboardAppearance } from "./dashboard-appearance";
import { VolunteerNavigation } from "./event-volunteer-dashboard";

function AccountShell({children}:{children:React.ReactNode}){
  const[volunteer,setVolunteer]=useState<boolean|null>(null);
  useEffect(()=>setVolunteer(readTeacherSession()?.accessLevel==="EVENT_VOLUNTEER"),[]);
  if(volunteer===null)return <main className="route-loading"/>;
  return <><DashboardAppearance/>{volunteer?<main className="volunteer-shell"><VolunteerNavigation/>{children}</main>:<SundayContextProvider><Sidebar/><main className="content"><AdminTopbar/>{children}</main></SundayContextProvider>}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAccountPage = pathname.startsWith("/account");
  const peoplePage = /^\/account\/(children|guardians|families|check-in|pick-up|relations)(\/|$)/.test(pathname);

  return (
    <>
      <PagePreloader />
      {isAccountPage ? <AccountGuard><AccountShell>{peoplePage ? <PeopleRecordsGuard key={pathname}>{children}</PeopleRecordsGuard> : children}</AccountShell></AccountGuard> : <main className="parent-shell">{children}</main>}
      <style jsx global>{`
        .page-preloader { position: fixed; z-index: 10000; inset: 0; display: grid; place-items: center; background: #fffdf9; animation: page-preloader-fade .2s ease .25s forwards; }
        .page-preloader-mark, .route-loading { display: flex; align-items: end; justify-content: center; gap: 6px; min-height: 46px; }
        .page-preloader-mark span, .route-loading span { width: 9px; height: 9px; border-radius: 99px; background: #ff4c28; animation: page-preloader-bounce .72s ease-in-out infinite alternate; }
        .page-preloader-mark span:nth-child(2), .route-loading span:nth-child(2) { animation-delay: .14s; background: #00a66b; }
        .page-preloader-mark span:nth-child(3), .route-loading span:nth-child(3) { animation-delay: .28s; background: #f6bd48; }
        .route-loading { min-height: 100vh; background: #fffdf9; }
        @keyframes page-preloader-bounce { to { transform: translateY(-13px); } }
        @keyframes page-preloader-fade { to { opacity: 0; pointer-events: none; } }
      `}</style>
    </>
  );
}

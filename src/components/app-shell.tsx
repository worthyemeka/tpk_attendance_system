"use client";

import { AdminTopbar } from "@/components/admin-topbar";
import { PagePreloader } from "@/components/page-preloader";
import { Sidebar } from "@/components/sidebar";
import { AccountGuard } from "@/components/account-guard";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAccountPage = pathname.startsWith("/account");

  return (
    <>
      <PagePreloader />
      {isAccountPage ? <AccountGuard><Sidebar /><main className="content"><AdminTopbar />{children}</main></AccountGuard> : <main className="parent-shell">{children}</main>}
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

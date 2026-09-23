import { SecondServiceAutomation } from "@/components/second-service-automation";

export default function AccountOverviewLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<SecondServiceAutomation /><style>{`.second-service-toast{position:fixed;z-index:30;right:28px;bottom:28px;max-width:340px;margin:0;padding:14px 17px;border-radius:10px;background:#e7f8ef;color:#08734e;box-shadow:0 12px 30px #0b2b1c24;font:700 13px var(--font-body,Arial,sans-serif)}@media(max-width:560px){.second-service-toast{right:16px;bottom:16px;left:16px;max-width:none;font-size:12px}}`}</style></>;
}

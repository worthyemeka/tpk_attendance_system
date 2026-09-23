import { ParentFormNavigation } from "@/components/parent-form-navigation";
import "./phone-fix.css";
import "./pickup-service.css";
import "./service-card-fix.css";
import "./restored-back.css";

export default function ParentCheckInLayout({ children }: { children: React.ReactNode }) {
  return <><ParentFormNavigation />{children}</>;
}

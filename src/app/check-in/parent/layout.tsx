import "./phone-fix.css";
import "./pickup-service.css";
import "./service-card-fix.css";
import "./restored-back.css";

export default function ParentCheckInLayout({ children }: { children: React.ReactNode }) {
  // Each parent journey provides its own contextual Back control. Rendering
  // another one in the route layout caused the duplicate Back link.
  return children;
}

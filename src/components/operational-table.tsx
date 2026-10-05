import { RecordBadge } from "./record-badge";
import "./operational-table.css";

export function OperationalChild({ firstName, lastName }: { firstName: string; lastName: string }) {
  return <span className="operational-child"><i aria-hidden="true">{`${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase()}</i><b>{firstName} {lastName}</b></span>;
}

export function OperationalStatus({ status }: { status: string }) {
  const label = status === "PICKED_UP" ? "Picked up" : status === "PICKUP_REQUESTED" ? "Pickup requested" : status === "CHECKED_IN" ? "In class" : status === "PRESENT" ? "Still present" : status.replaceAll("_", " ").toLowerCase();
  return <RecordBadge tone={status === "PICKED_UP" || status === "CHECKED_IN" ? "green" : status === "PICKUP_REQUESTED" || status === "PRESENT" ? "amber" : "neutral"} dot>{label}</RecordBadge>;
}
